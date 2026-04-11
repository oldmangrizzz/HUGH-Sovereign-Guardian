const { spawn } = require('child_process');

/**
 * Spawns a cloudflared tunnel and parses the output for the URL.
 */
function setupTunnel(config) {
  return new Promise((resolve, reject) => {
    const args = ['tunnel', '--url', `http://localhost:${config.port}`];
    
    // If domain is provided, we might want to use it, but that usually requires
    // a pre-configured tunnel or specific flags. 
    // For "spontaneous", the ephemeral tunnel is the easiest first step.
    
    const cloudflared = spawn('cloudflared', args);
    let urlFound = false;

    cloudflared.stderr.on('data', (data) => {
      const output = data.toString();
      // Look for the .trycloudflare.com URL in the logs
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !urlFound) {
        urlFound = true;
        resolve(match[0]);
      }
    });

    cloudflared.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error('cloudflared is not installed in PATH'));
      } else {
        reject(err);
      }
    });

    // Auto-timeout after 30s if no URL is found
    setTimeout(() => {
      if (!urlFound) {
        reject(new Error('Timed out waiting for Cloudflare tunnel URL'));
      }
    }, 30000);
  });
}

module.exports = { setupTunnel };
