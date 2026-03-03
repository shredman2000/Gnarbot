const { spawn } = require('child_process');

const proc = spawn('ffmpeg', [
    '-i', 'https://www.youtube.com/watch?v=INsVZ3ACwas',
    '-t', '5',
    '-f', 'null',
    '-'
]);

proc.stdout.on('data', d => console.log('OUT:', d.toString()));
proc.stderr.on('data', d => console.log('ERR:', d.toString()));
proc.on('close', code => console.log('Exit code:', code));