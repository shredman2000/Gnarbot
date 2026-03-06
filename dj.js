// dj.js
const db = require('./database.js')
const fs = require('fs');
const path = require('path');
const os = require('os');
const gTTS = require('google-tts-api');
const { Readable } = require('stream');
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

function getTempFilePath() {
    const fileName = `gnarbot_tts_${Date.now()}.mp3`;
    return path.join(tmpDir, fileName);
}

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



async function getTTSTempFile(djText) {
    const url = gTTS.getAudioUrl(djText, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com'
    });

    const res = await fetch(url); // Node 18+ has this globally
    if (!res.ok) throw new Error(`Failed to fetch TTS: ${res.status}`);

    const buffer = await res.arrayBuffer();
    const tempFile = getTempFilePath();
    fs.writeFileSync(tempFile, Buffer.from(buffer));
    return tempFile;
}


async function playTTS(player, djText, requestedBy) {
    const tempFile = await getTTSTempFile(djText);
    const fileName = path.basename(tempFile);

    const ttsTrack = {
        encoded: `http://gnarbot:3001/tts/${fileName}`, 
        title: `DJ Commentary: ${djText}`,
        requestedBy,
        isDJSnippet: true
    };

    await player.update({ track: ttsTrack });

    // Delete after 1 minute
    setTimeout(() => fs.unlink(tempFile, () => {}), 60_000);
}


module.exports = { getDjText, playTTS, getTempFilePath, getTTSTempFile}