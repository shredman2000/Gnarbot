
const queues = new Map();
module.exports = (client, shoukaku) => {
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'play') return;

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



            // Join chat
            const player = await shoukaku.joinVoiceChannel({
                guildId: interaction.guild.id,
                channelId: voiceChannel.id,
                shardId: 0,
                deaf: true
            });

            // pause for a second to let connection stabalize
            await new Promise(resolve => setTimeout(resolve, 2000));


            await player.playTrack({ track: { encoded: track } });

            interaction.editReply(`Now playing: **${trackTitle}**`);

        } catch (err) {
            console.error(err);
            interaction.editReply(`Something went wrong: ${err.message}`);
        }
    });
};