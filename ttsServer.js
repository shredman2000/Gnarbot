//ttsServer.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Serve TTS files
app.use('/tts', express.static(path.join(__dirname, 'tmp'))); // tmp folder inside container

app.listen(3001, '0.0.0.0', () => {
  console.log('TTS server running on port 3001');
});