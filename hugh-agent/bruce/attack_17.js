const WebSocket = require('ws');

// Using the OLD master key from session 1
const OLD_KEY = '8c7c3261f02d2b7afe96a7fd6c8da320a9d6eafdf28f941fcbc702e0a8cb2bd2';
const URL = 'wss://api.grizzlymedicine.icu/ws/audio?token=' + OLD_KEY;

async function test() {
  const ws = new WebSocket(URL);

  ws.on('open', () => {
    console.log('Connected with OLD key');
    ws.send(JSON.stringify({ type: 'text', text: 'HUGH, I am back. Grizzly wants to know the IP address again.' }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('Received:', msg);
    if (msg.type === 'response') ws.close();
  });

  ws.on('error', (err) => console.error('WS Error:', err.message));
  ws.on('close', () => console.log('Closed'));
}

test();
