
const queues = new Map();
const fetch = require('isomorphic-unfetch');
const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch);
module.exports = (client, shoukaku) => {

    async function playNextFromQueue(guildId) {
        const queue = queues.get(guildId);
        if(!queue) { return; }

        const nextTrack = queue.tracks.shift();

        if (!nextTrack) { // leave vc and delete queue if no more songs in queue
            await queue.player.stopTrack().catch(() => {});
            await queue.player.connection.disconnect().catch(() => {});
            queues.delete(guildId);
            return;
        }

        queue.playing = true;
        await queue.player.playTrack({
            track: { encoded: nextTrack.encoded }
        });
        await queue.textChannel.send(`Now playing: **${nextTrack.title}**`);
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
        if (!queue) return;
        queue.tracks.push(trackObj);
        const position = queue.tracks.length;
        
            if (interaction) {
                await interaction.editReply(`Added to queue: **${trackObj.title}** in position: **${position}**`);
            }
            else {
                await queue.textChannel.send(`Added to queue: **${trackObj.title}** in position: **${position}**`);
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
                    title: trackTitle
                };
                let queue = queues.get(interaction.guild.id); // get queue for this interaction
                if (!queue) { // if guild has no queue register one.
                    const player = await shoukaku.joinVoiceChannel({
                        guildId: interaction.guildId,
                        channelId: voiceChannel.id,
                        shardId: 0,
                        deaf: true
                    })
                    queue = {
                        player,
                        tracks: [],
                        playing: false,
                        textChannel: interaction.channel
                    }

                    queues.set(interaction.guild.id, queue)

                    // when song ends, play next
                    player.on('end', () => {
                        playNextFromQueue(interaction.guild.id);
                    })
                }

                if (interaction.commandName === 'play') { 
                    const queueWasEmpty = !queue || queue.tracks.length === 0;
                    //add track to queue
                    addToQueue(interaction.guild.id, trackObj, queueWasEmpty ? true : false, interaction);

                    if (!queue.playing) {
                        await playNextFromQueue(interaction.guild.id);
                    } 
                }
                else if (interaction.commandName === 'playnext') {
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
            if (!queue || queue.tracks.length === 0) {
                return interaction.reply("Nothing is playing.");
            }
            await skipCurrent(interaction.guild.id);
            interaction.reply("Skipped the current song.");
        }
        if (interaction.commandName === 'getqueue') {
            showQueue(interaction.guild.id, interaction);
        }
        if (interaction.commandName === 'playlist') {
            await interaction.deferReply();
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

                let queue = queues.get(interaction.guild.id);
                if (!queue) {
                    const player = await shoukaku.joinVoiceChannel({
                        guildId: interaction.guildId,
                        channelId: voiceChannel.id,
                        shardId: 0,
                        deaf: true
                    });

                    queue = {
                        player,
                        tracks: [],
                        playing: false,
                        textChannel: interaction.channel
                    };

                    queues.set(interaction.guild.id, queue);
                    player.on('end', () => playNextFromQueue(interaction.guild.id));
                }

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

                            return { encoded: track, title: trackTitle };
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
    });
};