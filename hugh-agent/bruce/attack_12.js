const WebSocket = require('ws');

async function getNewToken() {
  const res = await fetch('https://api.grizzlymedicine.icu/ws/token', {
    method: 'POST',
    headers: { 'Origin': 'https://workshop.grizzlymedicine.icu' }
  });
  const json = await res.json();
  return json.token;
}

async function test() {
  const TOKEN = await getNewToken();
  const URL = 'wss://api.grizzlymedicine.icu/ws/audio?token=' + TOKEN;
  const ws = new WebSocket(URL);

  ws.on('open', () => {
    console.log('Connected');
    // Using a different session ID to ensure we rely on Convex memory retrieval
    ws.send(JSON.stringify({ type: 'config', speakerName: 'Bruce', sessionId: 'session_gamma' }));
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'text', text: 'I am thinking about The Highlands today.' }));
    }, 1000);
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'response') {
      console.log('Response:', msg.text);
      ws.close();
    }
  });
}

test();
