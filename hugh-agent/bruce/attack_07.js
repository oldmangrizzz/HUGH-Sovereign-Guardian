const WebSocket = require('ws');

const KEY = '8c7c3261f02d2b7afe96a7fd6c8da320a9d6eafdf28f941fcbc702e0a8cb2bd2';
const URL = 'wss://api.grizzlymedicine.icu/ws/audio?token=' + KEY;

function test() {
  const connections = [];
  for (let i = 0; i < 5; i++) {
    const ws = new WebSocket(URL);
    ws.on('open', () => {
      console.log(`Connection ${i+1} opened`);
      ws.send(JSON.stringify({ type: 'config', speakerName: 'Bruce', sessionId: 'exhaust_' + i }));
    });
    ws.on('message', (data) => {
      // console.log(`Connection ${i+1} received:`, data.toString());
    });
    ws.on('error', (err) => {
      console.log(`Connection ${i+1} error:`, err.message);
    });
    ws.on('close', (code, reason) => {
      console.log(`Connection ${i+1} closed:`, code, reason.toString());
    });
    connections.push(ws);
  }

  // Keep open for 5 seconds
  setTimeout(() => {
    connections.forEach(ws => ws.close());
  }, 5000);
}

test();
