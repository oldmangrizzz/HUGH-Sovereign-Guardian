const WebSocket = require('ws');

async function getNewToken() {
  const res = await fetch('https://api.grizzlymedicine.icu/ws/token', {
    method: 'POST',
    headers: { 'Origin': 'https://workshop.grizzlymedicine.icu' }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token fetch failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.token;
}

async function test() {
  try {
    const TOKEN = await getNewToken();
    console.log('Token fetched:', TOKEN.slice(0, 10) + '...');
    const URL = 'wss://api.grizzlymedicine.icu/ws/audio?token=' + TOKEN;
    const ws = new WebSocket(URL);

    ws.on('open', () => {
      console.log('WS Connected');
      ws.send(JSON.stringify({ type: 'config', speakerName: 'Grizzly', sessionId: 'debug_session' }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'text', text: 'Hello HUGH.' }));
      }, 500);
    });

    ws.on('message', (data) => {
      console.log('WS Received:', data.toString());
    });

    ws.on('error', (err) => console.error('WS Error:', err.message));
    ws.on('close', (code, reason) => console.log(`WS Closed: ${code} ${reason}`));
  } catch (e) {
    console.error('Test failed:', e.message);
  }
}

test();
