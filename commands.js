// commands.js
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();


// available commands
const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Request a song to play')
        .addStringOption(option => 
            option.setName('song')
                .setDescription('Youtube URL or name + artist')
                .setRequired(true)
        )
].map(command => command.toJSON());


// setup REST service
const rest = new REST({ version: '10'}).setToken(process.env.DISCORD_TOKEN);


// register commands with discord api
(async () => {
    try {
        console.log('Registering slash commands...');

        const res = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('successfully registered commands')
        console.log(res)
    
    } catch (err) {
        console.error(err);
    }
})