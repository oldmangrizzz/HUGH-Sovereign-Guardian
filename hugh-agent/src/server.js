const http = require('http');
const { exec } = require('child_process');
const os = require('os');
const axios = require('axios');
const { setupTunnel } = require('./tunnel');
const { runUpdate } = require('./updater');

const packageJson = require('../package.json');

async function registerNode(config, agentUrl) {
  if (!config.convexSiteUrl) {
    console.log('[hugh-agent] Skip registration: CONVEX_SITE_URL not set');
    return;
  }

  const registrationUrl = `${config.convexSiteUrl}/api/agent/register`;
  console.log(`[hugh-agent] Registering with Convex: ${registrationUrl}`);

  try {
    const payload = {
      nodeId: config.nodeId,
      label: config.label,
      agentUrl: agentUrl,
      agentSecret: config.secret,
      platform: process.platform,
      hostname: os.hostname(),
      nodeVersion: process.version,
      agentVersion: packageJson.version
    };

    await axios.post(registrationUrl, payload);
    console.log(`[hugh-agent] Registration successful for node: ${config.nodeId}`);
    
    // Start heartbeat after successful registration
    startHeartbeat(config, agentUrl);
  } catch (err) {
    console.error(`[hugh-agent] Registration failed: ${err.message}`);
    // Retry registration in 10s if it fails
    setTimeout(() => registerNode(config, agentUrl), 10000);
  }
}

function startHeartbeat(config, agentUrl) {
  const heartbeatUrl = `${config.convexSiteUrl}/api/agent/heartbeat`;
  
  setInterval(async () => {
    try {
      await axios.post(heartbeatUrl, {
        nodeId: config.nodeId,
        agentSecret: config.secret,
        agentUrl: agentUrl
      });
      console.log(`[hugh-agent] Heartbeat successful for node: ${config.nodeId}`);
    } catch (err) {
      console.error(`[hugh-agent] Heartbeat failed for node ${config.nodeId}: ${err.response?.data?.error || err.message}`);
    }
  }, 30000); // Every 30s
}

function startServer(config) {
  const { port, secret } = config;

  const server = http.createServer((req, res) => {
    // ── AUTH ──────────────────────────────────────────────────────────────────
    if (req.headers['x-agent-secret'] !== secret && req.url !== '/ping') {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return;
    }

    // ── EXEC ──────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && req.url === '/exec') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let command, cwd;
        try {
          ({ command, cwd } = JSON.parse(body));
        } catch {
          res.writeHead(400); res.end('Bad JSON'); return;
        }

        exec(
          command,
          {
            cwd: cwd || process.env.HOME || '/root',
            timeout: 55000,
            maxBuffer: 1024 * 1024,
            shell: process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash',
          },
          (err, stdout, stderr) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              stdout: stdout || '',
              stderr: stderr || '',
              exitCode: err ? (err.code || 1) : 0,
            }));
          }
        );
      });

    // ── UPDATE (Self-Repair) ─────────────────────────────────────────────────
    } else if (req.method === 'POST' && req.url === '/update') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        let script;
        try {
          ({ script } = JSON.parse(body));
        } catch {
          res.writeHead(400); res.end('Bad JSON'); return;
        }

        const result = await runUpdate(script);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });

    // ── PING ──────────────────────────────────────────────────────────────────
    } else if (req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('pong');

    // ── INFO ──────────────────────────────────────────────────────────────────
    } else if (req.url === '/info') {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const cpus = os.cpus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        nodeId: config.nodeId,
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        hostname: os.hostname(),
        uptime: process.uptime(),
        resources: {
          memory: {
            total: Math.round(totalMem / (1024 * 1024 * 1024)) + 'GB',
            free: Math.round(freeMem / (1024 * 1024 * 1024)) + 'GB',
            usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100) + '%'
          },
          cpu: {
            model: cpus[0].model,
            cores: cpus.length,
            loadAvg: os.loadavg() // [1min, 5min, 15min]
          },
          os: {
            release: os.release(),
            type: os.type()
          }
        }
      }));

    } else {
      res.writeHead(404); res.end('Not found');
    }
  });

  server.listen(port, '127.0.0.1', async () => {
    console.log(`[hugh-agent] listening on 127.0.0.1:${port}`);
    console.log(`[hugh-agent] platform: ${process.platform} | node: ${process.version}`);

    let agentUrl = `http://localhost:${port}`;

    if (config.useTunnel) {
      console.log('[hugh-agent] Spawning spontaneous tunnel...');
      try {
        const tunnelUrl = await setupTunnel(config);
        console.log(`[hugh-agent] Tunnel active: ${tunnelUrl}`);
        agentUrl = tunnelUrl;
      } catch (err) {
        console.error(`[hugh-agent] Tunnel failed: ${err.message}`);
      }
    }

    // Register with Convex
    await registerNode(config, agentUrl);
  });
}

module.exports = { startServer };
