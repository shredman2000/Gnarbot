const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./gnarbot.db');

db.all("SELECT * FROM dj_songs", (err, rows) => {
    if (err) return console.error(err);
    console.log(rows);
    db.close();
});