const http = require('http');

// Replace these with your actual values from the last Lavalink log
const SESSION_ID = '924jv37k4nt8jgxz'; // grab latest from Lavalink logs
const GUILD_ID = '1478102527898685584';
const PASSWORD = 'youshallnotpass';

const body = JSON.stringify({
    encodedTrack: "QAAAywMAMUxpbCBVemkgVmVydCAtIFNhbmd1aW5lIFBhcmFkaXNlIFtPZmZpY2lhbCBBdWRpb10ADExJTCBVWkkgVkVSVAAAAAAAA70IAAtJTnNWWjNBQ3dhcwABACtodHRwczovL3d3dy55b3V0dWJlLmNvbS93YXRjaD92PUlOc1ZaM0FDd2FzAQAwaHR0cHM6Ly9pLnl0aW1nLmNvbS92aS9JTnNWWjNBQ3dhcy9tcWRlZmF1bHQuanBnAAAHeW91dHViZQAAAAAAAAAA"
});

const options = {
    hostname: 'localhost',
    port: 2333,
    path: `/v4/sessions/${SESSION_ID}/players/${GUILD_ID}?noReplace=false`,
    method: 'PATCH',
    headers: {
        'Authorization': PASSWORD,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
    });
});

req.on('error', (err) => console.error('Request error:', err));
req.write(body);
req.end();