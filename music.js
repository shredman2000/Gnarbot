const { EQList } = require("lavalink-client");
const queues = new Map();
const path = require('path');
const { incrementUserStats, getUserStats, getLeaderBoard } = require('./database.js')
const { getDjText, playTTS, getTempFilePath, getTTSTempFile} = require('./dj.js')
const fs = require('fs');

const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch);
const {EmbedBuilder} = require('discord.js')
const db = require('./database.js')
module.exports = (client, shoukaku) => {

// helper function for finding or creating new queue, avoid race conditions
    async function getOrCreateQueue(guildId, voiceChannel, textChannel) {
        let queue = queues.get(guildId);

        console.log('getOrCreateQueue called');
        console.log('queue exists:', !!queue);
        console.log('shoukaku.players has guild:', shoukaku.players.has(guildId));
        console.log('shoukaku.players keys:', [...shoukaku.players.keys()]);

        if (!queue || !queue.player || queue.player.connection?.disconnected) {
                // Manually clear Shoukaku's internal maps since destroy() isn't doing it
            try {
                const stale = shoukaku.players.get(guildId);
                if (stale) await stale.destroy();
            } catch {}
            
            // Force remove from both internal maps
            shoukaku.players.delete(guildId);
            shoukaku.connections.delete(guildId);

            console.log('attempting joinVoiceChannel...');

                const player = await shoukaku.joinVoiceChannel({
                    guildId,
                    channelId: voiceChannel.id,
                    shardId: 0,
                    deaf: true
                });

                queue = {
                    player,
                    tracks: [],
                    playing: false,
                    textChannel,
                    djMode: false
                };

                queues.set(guildId, queue);
                player.on('end', () => {
                    if (queue.suppressNextEnd) {
                        queue.suppressNextEnd = false;
                        return;
                    }
                    playNextFromQueue(guildId);
                });
            }

        return queue;
    }

    async function playNextFromQueue(guildId) {

        const queue = queues.get(guildId);
        if (!queue) return;

        let nextTrack = queue.tracks.shift();

        if (!nextTrack && queue.djMode) {

            const djSong = await db.getDjSong(guildId);
            
            if (!djSong) { 
                console.log("NO DJ SONG FOUND")
                queue.playing = false;
                return;
            }
            const node = [...shoukaku.nodes.values()][0]

            const result = await node.rest.resolve(`ytsearch:${djSong.song_artist} ${djSong.song_name}`)

            if (!result?.data?.length) {
                queue.playing = false;
                return;
            }

            const track = result.data[0]

            nextTrack = {
                encoded: track.encoded,
                title: djSong.song_name,
                artist: djSong.song_artist,
            }
        }

        if (!nextTrack) {
            queue.playing = false;

            return;
        }

        // dj commentary
        if (queue.djMode) {
            queue.playing = true;
            try {
                const node = shoukaku.nodes.get("Lavalink");

                let ttsFilePath;
                let djText;

                if (queue.pregenTTS) {
                    ttsFilePath = queue.pregenTTS.filePath;
                    djText = queue.pregenTTS.text;
                    nextTrack = queue.pregenTTS.nextTrack; // use the pre-resolved track
                    queue.pregenTTS = null;
                } else {
                    djText = await getDjText(nextTrack.title, nextTrack.artist);
                    ttsFilePath = await getTTSTempFile(djText);
                }

                // Resolve both in parallel
                const ttsUrl = `http://gnarbot:3001/tts/${path.basename(ttsFilePath)}`;
                const ttsResult = await node.rest.resolve(ttsUrl);

                if (!ttsResult || !ttsResult.data) {
                    await queue.player.playTrack({ track: { encoded: nextTrack.encoded } });
                    await queue.textChannel.send(`Now playing: **${nextTrack.title}**`);
                    return;
                }

                let ttsEncoded;
                if (ttsResult.loadType === 'track') {
                    ttsEncoded = ttsResult.data.encoded;
                } else {
                    await queue.player.playTrack({ track: { encoded: nextTrack.encoded } });
                    await queue.textChannel.send(`Now playing: **${nextTrack.title}**`);
                    return;
                }

                queue.suppressNextEnd = true;
                await queue.player.playTrack({ track: { encoded: ttsEncoded } });

                // Kick off pre-generation for the NEXT song while TTS is playing
                pregenerateTTS(guildId);

                queue.player.once("end", async () => {
                    await queue.player.playTrack({ track: { encoded: nextTrack.encoded } });
                    await queue.textChannel.send(`Now playing: **${nextTrack.title}**`);
                    fs.unlink(ttsFilePath, () => {});
                });

                return;
            } catch (err) {
                console.error("DJ TEXT ERROR: ", err);
            }
        }

        const lofi = nextTrack.lofi || false;
        const slowed = nextTrack.slowed || false;
        const bassBoosted = nextTrack.bassBoosted || false;
        const eightD = nextTrack.eightD || false;
        const lateNight = nextTrack.lateNight || false;
        const activeFilters = []
        await incrementUserStats(guildId, nextTrack.requestedBy);
        queue.playing = true;

        try {
            const playOptions = {track : {encoded: nextTrack.encoded}}
            const filters = {}
        
            if (lofi) {
                activeFilters.push("Lofi")
                // EQ: smooth highs, boost lows/mids a bit
                filters.equalizer = [
                    { band: 0, gain: 0.1 },
                    { band: 1, gain: 0.08 },
                    { band: 2, gain: 0.05 },
                    { band: 3, gain: 0 },
                    { band: 4, gain: -0.05 },
                    { band: 5, gain: -0.08 },
                    { band: 6, gain: -0.1 },
                    { band: 7, gain: -0.12 },
                    { band: 8, gain: -0.12 },
                    { band: 9, gain: -0.15 },
                    { band: 10, gain: -0.15 },
                    { band: 11, gain: -0.15 },
                    { band: 12, gain: -0.12 },
                    { band: 13, gain: -0.1 },
                    { band: 14, gain: -0.08 },
                ];

                // Slight lowpass filter to soften highs (classic lofi muffled effect)
                filters.lowPass = {
                    smoothing: 20, // higher = softer
                    cutoff: 2000 // cut off frequencies above ~2kHz
                };

                // Optional gentle distortion or bitcrusher for vinyl/hiss effect
                filters.karaoke = {
                    level: 0.1,   // subtly simulates “mono” or narrow sound
                    monoLevel: 0.1,
                    filterBand: 220,
                    filterWidth: 100
                };

                // Slight volume reduction for smoother sound
                filters.volume = 0.95;
            }
            if (slowed) {
                activeFilters.push("Slowed")
                // timescale slows down and lowers pitch slightly
                filters.timescale = {
                    speed: 0.9,   // slower
                    pitch: 0.9,    // lower pitch
                    rate: 1.0
                };

                // subtle vibrato for space/reverb-like effect
                filters.vibrato = {
                    frequency: 5.0,
                    depth: 0.2
                };

                // subtle tremolo for lofi wobble
                filters.tremolo = {
                    frequency: 4.0,
                    depth: 0.1
                };

                // EQ tweak: cut high frequencies, boost lows a bit
                filters.equalizer = [
                    { band: 0, gain: 0.1 },
                    { band: 1, gain: 0.05 },
                    { band: 2, gain: 0 },
                    { band: 3, gain: -0.05 },
                    { band: 4, gain: -0.05 },
                    { band: 5, gain: -0.1 },
                    { band: 6, gain: -0.1 },
                    { band: 7, gain: -0.15 },
                    { band: 8, gain: -0.15 },
                    { band: 9, gain: -0.15 },
                    { band: 10, gain: -0.1 },
                    { band: 11, gain: -0.1 },
                    { band: 12, gain: -0.05 },
                    { band: 13, gain: 0 },
                    { band: 14, gain: 0 },
                ];

                // slightly reduce overall volume for smoothness
                filters.volume = 0.9;
            }
            if (bassBoosted) {
                filters.equalizer = [
                    { band: 0, gain: 0.15 },
                    { band: 1, gain: 0.12 },
                    { band: 2, gain: 0.08 },
                    { band: 3, gain: 0.05 },
                    { band: 4, gain: 0.03 },
                    { band: 5, gain: 0 },
                    { band: 6, gain: -0.02 },
                    { band: 7, gain: -0.05 },
                    { band: 8, gain: 0 },
                    { band: 9, gain: 0 },
                    { band: 10, gain: 0 },
                    { band: 11, gain: 0 },
                    { band: 12, gain: 0 },
                    { band: 13, gain: 0 },
                    { band: 14, gain: 0 },
                ];

            }

            if (eightD) {
                activeFilters.push("8D Audio")
                filters.rotation = {
                    rotationHz: 0.1,
                    rotationMode: "surround", // if supported
                    rotationAngle: 0.8 // wide but not extreme
                };
            }

            if (lateNight) {
                activeFilters.push("Late Night")
                filters.equalizer = filters.equalizer || []; 

                filters.equalizer.push(
                    { band: 3, gain: -0.05 },
                    { band: 4, gain: -0.05 },
                    { band: 5, gain: 0.03 }
                );

                filters.volume = 0.9;
            }
            if (Object.keys(filters).length > 0) {
                await queue.player.setFilters(filters);
            } else {
                await queue.player.setFilters({}); // clears all filters
            }
            await queue.player.playTrack(playOptions);
            let nowPlayingMsg = `Now playing: **${nextTrack.title}**`;
            if (activeFilters.length > 0) {
                nowPlayingMsg += ` | Filters: ${activeFilters.join(", ")}`;
            }

            await queue.textChannel.send(nowPlayingMsg);
        } catch (err) {
            console.error('playNextFromQueue error:', err);
            queues.delete(guildId);
        }
    }
    async function pregenerateTTS(guildId) {
        const queue = queues.get(guildId);
        if (!queue || !queue.djMode) return;

        try {
            const node = shoukaku.nodes.get("Lavalink");
            const djSong = await db.getDjSong(guildId);
            if (!djSong) return;

            // Resolve the actual track at the same time so they're tied together
            const [djText, trackResult] = await Promise.all([
                getDjText(djSong.song_name, djSong.song_artist),
                node.rest.resolve(`ytsearch:${djSong.song_artist} ${djSong.song_name}`)
            ]);

            if (!trackResult?.data?.length) return;

            const ttsFilePath = await getTTSTempFile(djText);

            // Store everything together so the song and TTS are always in sync
            queue.pregenTTS = {
                filePath: ttsFilePath,
                text: djText,
                nextTrack: {
                    encoded: trackResult.data[0].encoded,
                    title: djSong.song_name,
                    artist: djSong.song_artist,
                }
            };
            console.log('TTS pre-generated for next track:', djSong.song_name);
        } catch (err) {
            console.error('TTS pre-generation error:', err);
            queue.pregenTTS = null;
        }
    }

    async function skipCurrent(guildId) {
        const queue = queues.get(guildId);
        if (!queue) { return; }
        await queue.player.stopTrack(); // plays next because play next happens on song 'end'
    }

    function insertNext(guildId, trackObj) {
        const queue = queues.get(guildId);
        if (!queue) { return; }
        queue.tracks.unshift(trackObj);
        queue.textChannel.send(`Added to play next: **${trackObj.title}**`)
    }
    async function addToQueue(guildId, trackObj, suppressMessage = false, interaction = null) {
        const queue = queues.get(guildId);
        if (!queue) {
            const member = interaction?.member;
            const voiceChannel = member?.voice.channel;
            if (!voiceChannel) { return; }
            queue = await getOrCreateQueue(guildId, voiceChannel, interaction.channel) // if errors change this to: let queue = queues.get(guildId); TODO:
        }
        queue.tracks.push(trackObj);
        const position = queue.tracks.length;
        
        if (interaction) {
            await interaction.editReply(`Added to queue: **${trackObj.title}** in position: **${position}**`);
        }
        else {
            await queue.textChannel.send(`Added to queue: **${trackObj.title}** in position: **${position}**`);
        }
        if (!queue.playing) {
            await playNextFromQueue(guildId);
        }
        
    }

    function showQueue(guildId, interaction) {
        const queue = queues.get(guildId);
        if (!queue || queue.tracks.length === 0) {
            return interaction.reply("The queue is empty.");
        }
        const queueList = queue.tracks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
        interaction.reply(`Current queue:\n${queueList}`);
    }

    // handle the commands
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'play' || interaction.commandName === 'playnext') {
            const bassBoosted = interaction.options.getBoolean('bassboost') || false;
            const eightD = interaction.options.getBoolean('eightd') || false;
            const lateNight = interaction.options.getBoolean('latenight') || false;
            const lofi = interaction.options.getBoolean('lofi') || false;
            const slowed = interaction.options.getBoolean('slowed') || false;

            const song = interaction.options.getString('song');
            const voiceChannel = interaction.member.voice.channel;

            if (!voiceChannel)
                return interaction.reply("You must be in a voice channel first");

            await interaction.reply(`Searching for: "${song}"...`);

            try {
                const node = [...shoukaku.nodes.values()][0];
                if (!node) return interaction.editReply("No Lavalink nodes available.");

                const result = await node.rest.resolve(`ytsearch:${song}`);

                if (!result || !result.data || result.loadType === 'empty' || result.loadType === 'error') {
                    return interaction.editReply("No results found.");
                }

                let track, trackTitle, trackArtist;
                switch (result.loadType) {
                    case 'search':
                        track = result.data[0].encoded;
                        trackTitle = result.data[0].info.title;
                        trackArtist = result.data[0].info.author;
                        break;
                    case 'track':
                        track = result.data.encoded;
                        trackTitle = result.data.info.title;
                        trackArtist = result.data[0].info.author;
                        break;
                    case 'playlist':
                        track = result.data.tracks[0].encoded;
                        trackTitle = result.data.tracks[0].info.title;
                        trackArtist = result.data[0].info.author;
                        break;
                    default:
                        return interaction.editReply("Unexpected response from Lavalink.");
                }

                // CLEANUP SONG NAME
                let [artistGuess, songGuess] = trackTitle.split(" - ")
                if (!songGuess) songGuess = trackTitle; // fallback if no "-"
                if (!artistGuess) artistGuess = trackArtist; // fallback to video author

                songGuess = songGuess.replace(/\s*(ft\.?|feat\.?|featuring)\s.*$/i, '').trim(); // remove ft or featuring or feat
                songGuess = songGuess.replace(/\[.*?\]|\(.*?\)/g, '').trim(); // removing anything like [official music video]
                songGuess = songGuess.replace(/\s+/g, ' '); // cleanup any leftover spaces
                artistGuess = artistGuess.trim()

                db.addToDJ(interaction.guild.id, songGuess, artistGuess, interaction.user.id)

                const trackObj = {
                    encoded: track,
                    title: trackTitle,
                    requestedBy: interaction.user.id,
                    artist: trackArtist,
                    bassBoosted,
                    eightD,
                    lateNight,
                    lofi,
                    slowed
                };
                const voiceChannel = interaction.member.voice.channel;          

                const queue = await getOrCreateQueue(interaction.guild.id, voiceChannel, interaction.channel);

                if (interaction.commandName === 'play') { 
                    const queueWasEmpty = queue.tracks.length === 0;
                    await addToQueue(interaction.guild.id, trackObj, queueWasEmpty ? true : false, interaction);
                    queue.djMode = false;
                    if (!queue.playing) {
                        await playNextFromQueue(interaction.guild.id);
                    } 
                } else if (interaction.commandName === 'playnext') {
                    insertNext(interaction.guild.id, trackObj);

                    if (!queue.playing) {
                        await playNextFromQueue(interaction.guild.id);
                    } 
                }



            } catch (err) {
                console.error(err);
                interaction.editReply(`Something went wrong: ${err.message}`);
            }
        }
        if (interaction.commandName === 'skip') {
            const queue = queues.get(interaction.guild.id);
            if (!queue || !queue.playing) {
                return interaction.reply("Nothing is playing.");
            }
            await skipCurrent(interaction.guild.id);
            interaction.reply("Skipped the current song.");
        }
        if (interaction.commandName === 'getqueue') {
            showQueue(interaction.guild.id, interaction);
        }
        if (interaction.commandName === 'playlist') {
            //await interaction.deferReply();
            const url = interaction.options.getString('url');
            const voiceChannel = interaction.member.voice.channel;
            const numSongs = interaction.options.getInteger('songs')

            if (!voiceChannel) {
                return interaction.reply("You must be in a voice channel first");
            }

            await interaction.reply("Fetching Spotify playlist...");

            try {
                console.log("Memory before fetch:", process.memoryUsage());
                let tracks = await getTracks(url);
                console.log("Memory after fetching Spotify tracks:", process.memoryUsage());
                interaction.channel.send(`Memory before resolving multi-batch playlist: \`\`\`json
                        ${JSON.stringify(process.memoryUsage(), null, 2)}
                        \`\`\``);
                if (!tracks || tracks.length === 0) {
                    return interaction.editReply("Error fetching tracks, either URL is incorrect, or playlist is empty.");
                }

                // Pick 15 random tracks from the full playlist
                const selectedTracks = [];
                const indicesUsed = new Set();
                const maxTracks = Math.min(numSongs || tracks.length, 30);

                while (selectedTracks.length < maxTracks) {
                    const randomIndex = Math.floor(Math.random() * tracks.length);
                    if (!indicesUsed.has(randomIndex)) {
                        indicesUsed.add(randomIndex);
                        selectedTracks.push(tracks[randomIndex]);
                    }
                }
                const queue = await getOrCreateQueue(interaction.guild.id, voiceChannel, interaction.channel);

                const node = [...shoukaku.nodes.values()][0];

                // Resolve in small batches
                const batchSize = 3; // change this to control parallelism
                let addedCount = 0;

                for (let i = 0; i < selectedTracks.length; i += batchSize) {
                    const batch = selectedTracks.slice(i, i + batchSize);

                    console.log(`Memory before resolving batch ${i / batchSize + 1}:`, process.memoryUsage());
                    const batchPromises = batch.map(async t => {
                        const artistNames = t.artists?.map(a => a.name).join(' ') || t.artist || '';
                        const songName = `${t.name || t.track} ${artistNames}`.trim();

                        try {
                            const result = await node.rest.resolve(`ytsearch:${songName}`);
                            if (!result || !result.data || result.loadType === 'empty' || result.loadType === 'error') return null;

                            let track, trackTitle;
                            switch (result.loadType) {
                                case 'search':
                                    track = result.data[0].encoded;
                                    trackTitle = result.data[0].info.title;
                                    break;
                                case 'track':
                                    track = result.data.encoded;
                                    trackTitle = result.data.info.title;
                                    break;
                                case 'playlist':
                                    track = result.data.tracks[0].encoded;
                                    trackTitle = result.data.tracks[0].info.title;
                                    break;
                            }

                            return { encoded: track, title: trackTitle, requestedBy: interaction.user.id };
                        } catch {
                            return null;
                        }
                    });

                    const resolvedTracks = await Promise.allSettled(batchPromises);

                    for (const r of resolvedTracks) {
                        if (r.status === 'fulfilled' && r.value) {
                            await addToQueue(interaction.guild.id, r.value);
                            addedCount++;
                        }
                    }
                    console.log(`Memory after resolving batch ${i / batchSize + 1}:`, process.memoryUsage());
                }
                const memoryAfter = process.memoryUsage();
                await interaction.channel.send(`Memory after resolving playlist:\`\`\`json
                    ${JSON.stringify(memoryAfter, null, 2)}
                    \`\`\``);
                interaction.editReply(`Added ${addedCount} tracks from the Spotify playlist to the queue`);

                if (!queue.playing) {
                    await playNextFromQueue(interaction.guild.id);
                }

            } catch (err) {
                console.error(err);
                interaction.editReply(`Something went wrong: ${err.message}`);
            }
        }
        if (interaction.commandName === 'gnar') {
            const embed = new EmbedBuilder()
                .setTitle('GnarBot Commands')
                .setColor('#8A2BE2')
                .setDescription('List of available commands')
                .addFields(
                    { name: '/play [`song name or youtube URL`]', value: 'Plays the requested song', inline: false },
                    { name: '/playnext [`song name or youtube URL`]', value: 'Inserts a song in queue to play next', inline: false },
                    { name: '/playlist [`Spotify playlist URL`] [`number of songs to queue - optional`]' , value: 'Retrieves songs from a spotify playlist', inline: false },
                    { name: '/skip', value: 'Skips current song', inline: false },
                    { name: '/getqueue', value: 'Returns current queue', inline: false},
                    { name: '/stats', value: 'Returns leaderboard of how many songs each user has played', inline: false}
                )
                .setFooter({ text: 'Planned features: /stats - add each users most played song, /playlist apple music support'})


            interaction.channel.send({embeds: [embed]})

        }
        if (interaction.commandName === 'stats') {
            const guildId = interaction.guild.id;

            const stats = await getLeaderBoard(guildId);

            const embed = new EmbedBuilder()
                .setTitle('Server stats')
                .setColor('#8A2BE2')
                .setDescription('How many songs each user has played')
                    .addFields(
                        stats.map(stat => {
                            const user = interaction.guild.members.cache.get(stat.user_id);
                            const username = user ? user.user.username : `Unknown User (${stat.user_id})`;
                            return { name: username, value: `${stat.songs_played} songs`, inline: false}
                        })
                    )

            interaction.reply({ embeds: [embed]})
        }

        if (interaction.commandName === 'dj') {
            await interaction.deferReply({ ephemeral: true });
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply("You must be in a voice channel first")
            }

            const queue = await getOrCreateQueue(
                interaction.guild.id,
                voiceChannel,
                interaction.channel,
            );
            
            queue.djMode = true;

            if (!queue.playing) {
                await playNextFromQueue(interaction.guild.id);
            }
            await interaction.editReply("DJ mode enabled!");

        }
    });
    // dont remember what this does other than clears stale bot states, but DONT DELETE
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (!oldState.guild) return;

        const guildId = oldState.guild.id;
        const botId = client.user.id;
        const botLeft = !newState.channelId && oldState.member?.id === botId;

        if (botLeft) {
            const queue = queues.get(guildId);
            queues.delete(guildId);
            if (queue) {
                try { await queue.player.stopTrack(); } catch {}
                try { await queue.player.destroy(); } catch {}
            }
            // Force clear Shoukaku internals
            shoukaku.players.delete(guildId);
            shoukaku.connections.delete(guildId);
        }
    });
};