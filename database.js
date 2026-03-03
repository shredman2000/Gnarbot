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
    getLeaderBoard
};