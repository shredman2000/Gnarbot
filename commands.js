// commands.js
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN);
console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('GUILD_ID:', process.env.GUILD_ID);


const commandBuilders = [];

try {
    const play = new SlashCommandBuilder()
        .setName('play')
        .setDescription('Request a song to play')
        .addStringOption(option => option.setName('song').setDescription('Youtube URL or name + artist').setRequired(true))
        .addBooleanOption(option => 
            option.setName('bassboost')
                .setDescription('Enable bass boost for this song')
                .setRequired(false)
        )
        .addBooleanOption(option => 
            option.setName('eightd')
                .setDescription('Enable 8D audio for this song')
                .setRequired(false)
        )
        .addBooleanOption(option => 
            option.setName('latenight')
                .setDescription('Enable late night smoothing for this song')
                .setRequired(false)
        )
        .addBooleanOption(option => 
            option.setName('lofi')
                .setDescription('Enable lofi for this song')
                .setRequired(false)
        )
        .addBooleanOption(option => 
            option.setName('slowed')
                .setDescription('Enable slowed + reverb for this song')
                .setRequired(false)
        )
    commandBuilders.push(play.toJSON());

    const playNext = new SlashCommandBuilder()
        .setName('playnext')
        .setDescription('Request a song to play next')
        .addStringOption(option => option.setName('song').setDescription('Youtube URL or name + artist').setRequired(true))
        .addBooleanOption(option => 
            option.setName('bassboost')
                .setDescription('Enable bass boost for this song')
                .setRequired(false)
        )
        .addBooleanOption(option => 
            option.setName('eightd')
                .setDescription('Enable 8D audio for this song')
                .setRequired(false)
        )
        .addBooleanOption(option => 
            option.setName('latenight')
                .setDescription('Enable late night smoothing for this song')
                .setRequired(false)
        )
        .addBooleanOption(option => 
            option.setName('lofi')
                .setDescription('Enable lofi for this song')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('slowed')
                .setDescription('Enable slowed + reverb for this song')
                .setRequired(false)
        );
    commandBuilders.push(playNext.toJSON());

    const skip = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip current song');
    commandBuilders.push(skip.toJSON());

    const getQueue = new SlashCommandBuilder()
        .setName('getqueue')
        .setDescription('Get the current queue')
    commandBuilders.push(getQueue.toJSON())

    const playlist = new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Paste URL to a spotify playlist')
        .addStringOption(option => option.setName('url').setDescription('Paste spotify playlist URL'))
        .addIntegerOption(option => option.setName('songs').setDescription('How many songs to retrieve from the playlist (Integer) max 30'))
    commandBuilders.push(playlist.toJSON())

    const getCommands = new SlashCommandBuilder()
        .setName('gnar')
        .setDescription('Retrieve a list of available commands')
    commandBuilders.push(getCommands.toJSON())

    const stats = new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Retrieve a leaderboard of how many songs each user has played')
    commandBuilders.push(stats.toJSON())

    const dj = new SlashCommandBuilder()
        .setName('dj')
        .setDescription('Play music using the GnarBot DJ')
    commandBuilders.push(dj.toJSON())

} catch (err) {
  console.error("Error building commands:", err);
}

const commands = commandBuilders;


// setup REST service
const rest = new REST({ version: '10'}).setToken(process.env.DISCORD_TOKEN);

console.log('Script started');
// register commands with discord api
async function registerCommands() {
    console.log("in async");
    try {
        const res = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('successfully registered commands');
        console.log(res);
    } catch (err) {
        console.error(err);
    }
}

registerCommands();