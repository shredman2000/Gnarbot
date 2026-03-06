const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('gnarbot.db')

db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
        guild_id TEXT,
        user_id TEXT,
        songs_played INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
    );
`);

db.exec(`
CREATE TABLE IF NOT EXISTS dj_songs (
    guild_id TEXT,
    song_name TEXT,
    song_artist TEXT, 
    requested_by TEXT,
    play_count INTEGER default 0,
    PRIMARY KEY (guild_id, song_name, song_artist)
);
`, (err) => {
    if (err) console.error(err);
    else console.log("dj_songs table ensured!");
});

function addToDJ(guildId, songName, songArtist, userId) {
    console.log("ADDING SONG TO DJ")
    db.run(`INSERT INTO dj_songs (guild_id, song_name, song_artist, requested_by, play_count)
        VALUES(?, ?, ?, ?, 1)
        ON CONFLICT(guild_id, song_name, song_artist)
        DO UPDATE SET
            play_count = play_count + 1,
            requested_by = ?
        `, [guildId, songName, songArtist, userId, userId])
}

function getDjSong(guildId) {
    console.log("IN DATABSE GETTING DJ SONG________________")
    return new Promise((resolve, reject) => {
        db.get(`SELECT song_name, song_artist
                            FROM dj_songs
                            WHERE guild_id = ?
                            ORDER BY RANDOM()
                            LIMIT 1`, [guildId],
                            (err, row) => {
                                if (err) { reject(err) }
                                else {resolve(row) }
                            }                    
            )
    })
    
}

function incrementUserStats(guild_id, userId) {
    db.run(`
        INSERT INTO user_stats (guild_id, user_id, songs_played)
        VALUES (?, ?, 1)
        ON CONFLICT(guild_id, user_id)
        DO UPDATE SET songs_played = songs_played + 1
    `, [guild_id, userId]);
}

function getUserStats(guild_id, userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT songs_played FROM user_stats WHERE guild_id = ? AND user_id = ?`,
            [guild_id, userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.songs_played : 0);
            }
        );
    });
}

function getLeaderBoard(guild_id, limit = 10) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT user_id, songs_played
             FROM user_stats
             WHERE guild_id = ?
             ORDER BY songs_played DESC
             LIMIT ?`,
            [guild_id, limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = {
    incrementUserStats,
    getUserStats,
    getLeaderBoard,
    addToDJ,
    getDjSong
};