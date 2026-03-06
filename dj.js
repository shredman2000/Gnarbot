// dj.js
const db = require('./database.js')



// function to retrieve the text for the TTS dj.
async function getDjText(songTitle, artist) {
    console.log("IN DJ.JS getting A TEXT__________")

    const templates = [
        `Alright everyone, up next we've got ${songTitle}${artist ? ` by ${artist}` : ""}. Enjoy!`,
        `Coming up next is ${songTitle}${artist ? ` from ${artist}` : ""}. Turn it up.`,
        `Let's keep the vibes rolling with ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `Next track in the queue: ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `Alright chat, here's ${songTitle}${artist ? ` from ${artist}` : ""}.`,
        `You’re listening to GnarBot Radio, and up next is ${songTitle}${artist ? ` by ${artist}` : ""}.`
    ];

    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
}


module.exports = { getDjText}