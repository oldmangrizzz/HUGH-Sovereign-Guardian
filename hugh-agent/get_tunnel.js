const { spawn } = require('child_process');
const cloudflared = spawn('cloudflared', ['tunnel', '--url', 'http://[::1]:8787']);
cloudflared.stderr.on('data', (data) => {
  const output = data.toString();
  const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    console.log(match[0]);
    process.exit(0);
  }
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 30000);
