#GnarBot
Gnarbot is a Discord music bot built with Lavalink and Google TTS/GenAI integration. It supports slash commands for playing songs, queue management, Spotify playlist imports, statistics, and an AI-powered DJ voice introduction.

## Features

- Play songs from YouTube and search terms
- Queue management with `/play`, `/playnext`, `/skip`, and `/getqueue`
- Import tracks from Spotify playlists with `/playlist`
- Track user song play counts with `/stats`
- AI DJ voice announcements via `/dj`
- Lavalink for audio streaming
- SQLite persistence

## Setup

1. Clone the repository:


git clone https://github.com/shredman2000/Gnarbot.git
cd Gnarbot


2. Install dependencies:


npm install


3. Add your `.env` file and place `gcloud-key.json` in the project root.

4. Start Lavalink and the bot with Docker Compose:


docker-compose up --build


## Running Locally

If you prefer to run without Docker Compose:

1. Start a Lavalink instance separately and configure `LAVALINK_HOST`, `LAVALINK_PORT`, and `LAVALINK_PASSWORD`.
2. Start the bot:


node index.js


## Command Registration

The bot registers slash commands via `commands.js`, which loads `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` from `.env` and deploys the following commands to a specific guild.

## Available Slash Commands

- `/play <song>` - Play a song by URL or search query
- `/playnext <song>` - Queue a song to play next
- `/skip` - Skip the current track
- `/getqueue` - Show the current queue
- `/playlist <url> [songs]` - Load a Spotify playlist into the queue
- `/gnar` - Show available commands and help text
- `/stats` - Show the server leaderboard of played songs
- `/dj` - Trigger AI DJ voice commentary for the next track

## Database

The bot uses SQLite via `sqlite3` and stores data in `gnarbot.db`.

- `database.js` creates and manages the database
- `seeddb.js` can be used for database initialization or seeding

## Lavalink Configuration

The repository includes:

- `docker-compose.yml` for running Lavalink and the bot together
- `LavaLink/application.yml` with Lavalink settings and password

## TTS / DJ Service

- `ttsServer.js` serves generated TTS MP3 files from `tmp/` on port `3001`
- `dj.js` uses Google Gemini TTS to generate DJ announcements and plays them through Lavalink
