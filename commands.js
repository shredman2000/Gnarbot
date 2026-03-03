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
        .addStringOption(option => option.setName('song').setDescription('Youtube URL or name + artist').setRequired(true));
    commandBuilders.push(play.toJSON());

    const playNext = new SlashCommandBuilder()
        .setName('playnext')
        .setDescription('Request a song to play next')
        .addStringOption(option => option.setName('song').setDescription('Youtube URL or name + artist').setRequired(true));
    commandBuilders.push(playNext.toJSON());

    const skip = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip current song');
    commandBuilders.push(skip.toJSON());

    const getQueue = new SlashCommandBuilder()
        .setName('getqueue')
        .setDescription('Get the current queue')
    commandBuilders.push(getQueue.toJSON())

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