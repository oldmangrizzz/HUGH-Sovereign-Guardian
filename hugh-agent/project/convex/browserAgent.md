# Browser Agent — Deploy to VPS

Save this as `/root/browser-agent/server.js` on your VPS, then run with PM2.

```js
const http = require('http');
const { chromium } = require('playwright');

const SECRET = process.env.BROWSER_AGENT_SECRET || 'changeme';
const PORT = process.env.PORT || 7735;

let browser = null;
let page = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  return page;
}

async function handleBrowser(body) {
  const pg = await getBrowser();
  const { action, url, selector, text, waitFor, screenshot } = body;

  switch (action) {
    case 'navigate':
      await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (waitFor) await pg.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
      break;
    case 'click':
      await pg.click(selector, { timeout: 10000 });
      break;
    case 'type':
      await pg.fill(selector, text, { timeout: 10000 });
      break;
    case 'getText':
      const el = selector ? await pg.$(selector) : null;
      const txt = el ? await el.innerText() : await pg.innerText('body');
      return { success: true, text: txt.slice(0, 8000) };
    case 'screenshot':
      break;
    default:
      return { success: false, errorMessage: 'Unknown action: ' + action };
  }

  const result = {
    success: true,
    url: pg.url(),
    title: await pg.title(),
  };

  if (screenshot !== false) {
    const buf = await pg.screenshot({ type: 'jpeg', quality: 60 });
    result.screenshotBase64 = buf.toString('base64');
  }

  return result;
}

http.createServer((req, res) => {
  if (req.headers['x-agent-secret'] !== SECRET) {
    res.writeHead(401); res.end('Unauthorized'); return;
  }
  if (req.url === '/ping') {
    res.writeHead(200); res.end('pong'); return;
  }
  if (req.method === 'POST' && req.url === '/browser') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const result = await handleBrowser(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, errorMessage: err.message }));
      }
    });
  } else {
    res.writeHead(404); res.end();
  }
}).listen(PORT, () => console.log('Browser agent listening on', PORT));
```

## Install & run on VPS:

```bash
mkdir -p /root/browser-agent && cd /root/browser-agent
npm init -y
npm install playwright
npx playwright install chromium --with-deps
# save server.js above
BROWSER_AGENT_SECRET=your-secret pm2 start server.js --name browser-agent
pm2 save
```

Then set in Convex env vars:
- `BROWSER_AGENT_URL` = `http://187.124.28.147:7735`
- `BROWSER_AGENT_SECRET` = your secret
