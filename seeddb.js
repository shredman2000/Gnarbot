require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('gnarbot.db');

const GUILD_ID = process.env.GUILD_ID;
const songs = [
    { name: 'Guwop', artist: 'Young Thug' },
    { name: 'Envy Me', artist: 'Calboy' },
    { name: 'Hate Me', artist: 'Trippie Redd' },
    { name: "Perky's Calling", artist: 'Future' },
    { name: 'Opposite of Adults', artist: 'Chiddy Bang' },
    { name: 'March Madness', artist: 'Future' },
    { name: 'Day for Day', artist: 'Kodak Black' },
    { name: 'Lemonade', artist: 'Tayk' },
    { name: 'Documentary', artist: 'YFN Lucci' },
    { name: 'Red Dot Music', artist: 'Mac Miller' },
    { name: 'Broke as Fuck', artist: 'Cordae' },
    { name: 'Empire State of Mind', artist: 'Jay-Z' },
    { name: 'Power Trip', artist: 'J. Cole' },
    { name: 'Runaway', artist: 'J. Cole' },
    { name: 'All In', artist: 'NBA YoungBoy' },
];

const stmt = db.prepare(`
    INSERT INTO dj_songs (guild_id, song_name, song_artist, requested_by, play_count)
    VALUES (?, ?, ?, 'system', 1)
    ON CONFLICT(guild_id, song_name, song_artist) DO NOTHING
`);

songs.forEach(song => {
    stmt.run(GUILD_ID, song.name, song.artist);
    console.log(`Inserted: ${song.name} by ${song.artist}`);
});

stmt.finalize();
db.close(() => console.log('Done!'));