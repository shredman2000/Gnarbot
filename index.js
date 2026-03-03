//index.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Shoukaku, Connectors } = require("shoukaku");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const nodes = [
    {
        name: "Localhost",
        url: "localhost:2333",
        auth: "youshallnotpass"
    }
];
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes);

shoukaku.on('ready', (name) => console.log(`Lavalink node ${name} ready`));
shoukaku.on('error', (name, error) => console.error(`Lavalink node ${name} error:`, error));
shoukaku.on('close', (name, code, reason) => console.log(`Node ${name} closed: ${code} ${reason}`));
shoukaku.on('disconnect', (name, players, moved) => console.log(`Node ${name} disconnected`));

client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag}`);


    for (const guild of client.guilds.cache.values()) {
        const botMember = guild.members.cache.get(client.user.id);
        if (botMember?.voice?.channelId) {
            await botMember.voice.disconnect().catch(() => {});
        }
    }

    require('./music')(client, shoukaku);
});

client.login(process.env.DISCORD_TOKEN);