
const queues = new Map();
const fetch = require('isomorphic-unfetch');
const { incrementUserStats, getUserStats, getLeaderBoard } = require('./database.js')

const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch);
const {EmbedBuilder} = require('discord.js')
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
                textChannel
            };

            queues.set(guildId, queue);
            player.on('end', () => playNextFromQueue(guildId));
        }

        return queue;
    }

    async function playNextFromQueue(guildId) {
        const queue = queues.get(guildId);
        if (!queue) return;

        const nextTrack = queue.tracks.shift();
        if (!nextTrack) {
            queue.playing = false;
                
            return;
        }

        await incrementUserStats(guildId, nextTrack.requestedBy);
        queue.playing = true;

        try {
            await queue.player.playTrack({ track: { encoded: nextTrack.encoded } });
            await queue.textChannel.send(`Now playing: **${nextTrack.title}**`);
        } catch (err) {
            console.error('playNextFromQueue error:', err);
            queues.delete(guildId);
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
            queue = await getOrCreateQueue(guildId, voiceChannel, interaction.channel)
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
                    default:
                        return interaction.editReply("Unexpected response from Lavalink.");
                }

                const trackObj = {
                    encoded: track,
                    title: trackTitle,
                    requestedBy: interaction.user.id
                };
                const voiceChannel = interaction.member.voice.channel;          

                const queue = await getOrCreateQueue(interaction.guild.id, voiceChannel, interaction.channel);

                if (interaction.commandName === 'play') { 
                    const queueWasEmpty = queue.tracks.length === 0;
                    await addToQueue(interaction.guild.id, trackObj, queueWasEmpty ? true : false, interaction);

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
                const maxTracks = Math.min(15, tracks.length);

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