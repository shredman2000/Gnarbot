// dj.js
const db = require('./database.js')
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
const os = require('os');
const gTTS = require('google-tts-api');
const { Readable } = require('stream');
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const ttsClient = new textToSpeech.TextToSpeechClient({
    keyFilename: path.join(__dirname, 'gcloud-key.json')
});

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
        `You're listening to GnarBot Radio, and up next is ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `Ohhh we're cookin now. This one's ${songTitle}${artist ? ` from ${artist}` : ""}. Let's go.`,
        `Don't touch that dial. ${songTitle}${artist ? ` by ${artist}` : ""} is coming in hot.`,
        `GnarBot in the building, and we're spinning ${songTitle}${artist ? ` from ${artist}` : ""}. Stay locked in.`,
        `This next one goes out to everybody in the server. ${songTitle}${artist ? ` by ${artist}` : ""}. No skipping.`,
        `The vibes are immaculate tonight. Next up, ${songTitle}${artist ? ` from ${artist}` : ""}.`,
        `Oooh this one slaps. ${songTitle}${artist ? ` by ${artist}` : ""}. You're welcome.`,
        `Keep it locked to GnarBot Radio. Right now we got ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `No cap, this might be the one of the night. ${songTitle}${artist ? ` from ${artist}` : ""}. Let it ride.`,
        `Somebody requested a banger and we delivered. ${songTitle}${artist ? ` by ${artist}` : ""}. Here we go.`,
        `Alright alright alright. Sliding into ${songTitle}${artist ? ` by ${artist}` : ""}. Feel that.`,
        `We don't skip classics around here. ${songTitle}${artist ? ` from ${artist}` : ""} is up next.`,
        `GnarBot Radio never misses. Serving up ${songTitle}${artist ? ` by ${artist}` : ""} right now.`,
        `The people have spoken and the answer is ${songTitle}${artist ? ` from ${artist}` : ""}. Enjoy the ride.`,
        `We out here. We vibing. ${songTitle}${artist ? ` by ${artist}` : ""}. Let's get it.`,

        // weird ones
        `I had a dream last night that ${songTitle}${artist ? ` by ${artist}` : ""} saved my life. Let's find out if it was prophetic.`,
        `Scientists have confirmed that ${songTitle}${artist ? ` by ${artist}` : ""} contains exactly the right amount of funk. Here it is.`,
        `I legally cannot tell you why this song is next, but I can tell you it's ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `A mysterious envelope arrived at GnarBot HQ this morning. Inside was just a note that said play ${songTitle}${artist ? ` by ${artist}` : ""}. We comply.`,
        `My therapist said I need to stop introducing songs like this but she's not here right now. ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `The algorithm has spoken and it is not taking questions. ${songTitle}${artist ? ` from ${artist}` : ""}. Resistance is futile.`,
        `I've been sitting in this booth for eleven hours and the only thing keeping me going is ${songTitle}${artist ? ` by ${artist}` : ""}. Here we go.`,
        `Fun fact: nobody asked for my opinion but I'm going to play ${songTitle}${artist ? ` by ${artist}` : ""} anyway.`,
        `According to my calculations, the exact right song for this moment is ${songTitle}${artist ? ` by ${artist}` : ""}. The math does not lie.`,
        `I spilled my coffee, lost my keys, and forgot my own name today. But I remembered to play ${songTitle}${artist ? ` by ${artist}` : ""}. Priorities.`,
        `Some say ${songTitle}${artist ? ` by ${artist}` : ""} can be heard echoing in empty parking garages at 3am. We're about to test that theory.`,
        `GnarBot Radio is not responsible for any spontaneous dancing, crying, or existential clarity caused by ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `I asked the void what to play next. The void whispered back ${songTitle}${artist ? ` by ${artist}` : ""}. I'm not going to argue with the void.`,
        `This song walked so that your entire mood could run. ${songTitle}${artist ? ` by ${artist}` : ""}. You'll understand in a moment.`,
        `Rumor has it ${songTitle}${artist ? ` by ${artist}` : ""} once made a grown man cry in a Applebee's parking lot. Let's see what it does to you.`,
        `I have no memory of how this got in the queue but honestly? Respect. ${songTitle}${artist ? ` by ${artist}` : ""}.`,
        `The council has deliberated. The council has decided. ${songTitle}${artist ? ` by ${artist}` : ""}. Meeting adjourned.`,
        `If ${songTitle}${artist ? ` by ${artist}` : ""} were a smell it would be petrichor and a little bit of danger. Anyway here it is.`,

        // extremely weird
        `${songTitle}${artist ? ` by ${artist}` : ""}. I said what I said. The horses know why.`,
        `We've been legally required to play ${songTitle}${artist ? ` by ${artist}` : ""} at this time. The terms of the settlement are confidential.`,
        `${songTitle}${artist ? ` by ${artist}` : ""}. My uncle said this song smells like a Tuesday. He was right.`,
        `Breaking news: local bot plays ${songTitle}${artist ? ` by ${artist}` : ""}. Neighbors report hearing it from inside their walls. More at eleven.`,
        `I found ${songTitle}${artist ? ` by ${artist}` : ""} buried in my backyard in a jar labeled do not open until the vibes are right. The vibes are right.`,
        `${artist ? `${artist}` : "the artist"} made ${songTitle} during a full moon while eating a sandwich and you can absolutely tell. Here it is.`,
        `This song has three legs and one of them is ${songTitle}${artist ? ` by ${artist}` : ""}. You will understand this statement by the end of the track.`,
        `Geologists have discovered that ${songTitle}${artist ? ` by ${artist}` : ""} exists in the sediment layer between 2007 and a fever dream. We dug it up.`,
        `${songTitle}${artist ? ` by ${artist}` : ""}. A crow left this on my windshield. I owe it a debt now.`,
        `We played ${songTitle}${artist ? ` by ${artist}` : ""} backwards once and heard someone whispering the WiFi password. We're not doing that again.`,
        `The temperature inside ${songTitle}${artist ? ` by ${artist}` : ""} is approximately 74 degrees and smells faintly of a Bed Bath and Beyond that no longer exists.`,
        `${songTitle}${artist ? ` by ${artist}` : ""}. My left knee has been predicting this moment for six weeks. It was not wrong.`,
        `Scientists attempted to study ${songTitle}${artist ? ` by ${artist}` : ""} in a lab setting. The lab is no longer there. The song remains.`,

        // unhinged TTS breaking ones
        `AHHHHHHH. ${songTitle}. AHHHHHHH. ${artist ? `${artist}` : ""}. AHHHHH. Sorry. I get excited. Here it is.`,
        `Up next. ${songTitle}. WAIT. ${songTitle}. Oh my god. ${songTitle}${artist ? ` by ${artist}` : ""}. Okay I'm fine. I'm fine. Here we go.`,
        `ATTENTION. ATTENTION. ${songTitle}${artist ? ` by ${artist}` : ""}. THAT IS ALL. THAT IS ALL. YOU MAY RETURN TO YOUR LIVES.`,
        `I need everyone to remain calm. ${songTitle}. Stay calm. ${artist ? `By ${artist}.` : ""} I said CALM. Okay. Here it is.`,
        `Oh. Oh no. Oh no no no. ${songTitle}${artist ? ` by ${artist}` : ""}. Oh YES. OH YES. Let's GO.`,
        `WAIT WAIT WAIT WAIT WAIT. ${songTitle}. Did you hear that. ${songTitle}${artist ? ` by ${artist}` : ""}. WAIT. Okay go.`,
        `Initiating. Song. Protocol. ${songTitle}. ${artist ? `Artist detected. ${artist}.` : ""} NOW.`,
        `${songTitle}. No wait. ${songTitle}. ${artist ? `${artist}.` : ""} ${songTitle}. Yeah. ${songTitle}. Okay I'm done. Play.`,
        `GNARBOTTTTT. ${songTitle}. GNARBOTTTTT. ${artist ? `${artist}` : ""}. GNARBOTTTTTT. ${songTitle}. Let's go.`,
        `SongTitle equals ${songTitle}. Artist equals ${artist ? `${artist}` : "unknown"}. Hype level equals MAXIMUM. Playing now.`,
        `[moans] ${songTitle} nununununununun ${artist ? `${artist}` : "unknown"}     anununu`,
        `eeeieiooaaauauaeeeoeoeoeiuaaaeoeoauuaaoeeeaeaeeouuaaioa. ${songTitle} oeoeoeiuaaaeoeoauuaaoeee ${artist ? `${artist}` : "unknown"} eoeoauuaaoeee`,
    ];

    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
}



async function getTTSTempFile(djText) {
    const [response] = await ttsClient.synthesizeSpeech({
        input: { text: djText },
        voice: {
            languageCode: 'en-US',
            name: 'en-US-Chirp-HD-F', // deep male voice, good for DJ
        },
        audioConfig: {
            audioEncoding: 'MP3',
        }
    });
    const tempFile = getTempFilePath();
    fs.writeFileSync(tempFile, response.audioContent, 'binary');
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