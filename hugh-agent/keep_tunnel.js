const { spawn } = require('child_process');
const cloudflared = spawn('cloudflared', ['tunnel', '--url', 'http://[::1]:8787']);
cloudflared.stderr.on('data', (data) => {
  const output = data.toString();
  const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    console.log('TUNNEL_URL:' + match[0]);
  }
});
cloudflared.on('exit', (code) => {
  console.log('cloudflared exited with code ' + code);
  process.exit(code);
});
