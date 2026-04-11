const express = require('express');
const auth = require('basic-auth');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;

// THE LOCK: Middleware for protected routes
const secure = (req, res, next) => {
    const user = auth(req);
    if (user && user.name === 'lucius' && user.pass === 'Valhalla55730!') {
        return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="The Forge"');
    return res.status(401).send('Authentication required.');
};

// Public Assets
app.use('/web_assets', express.static(path.join(__dirname, 'public/web_assets')));

// Public Broadcast Route (The Kiosk View)
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>The Forge | Broadcast</title>
        <style>
            body { background: #050505; color: #39ff14; font-family: monospace; padding: 50px; line-height: 1.6; }
            h1 { color: #ffffff; border-bottom: 1px solid #1a1a20; padding-bottom: 10px; }
            .status { color: #ff4466; font-weight: bold; }
            .telemetry { color: #0080ff; }
        </style>
        </head>
        <body>
            <h1>[ THE FORGE : LIVE BROADCAST ]</h1>
            <p>> System Head: Lucius Fox</p>
            <p>> Substrate Status: <span class="status">IDLE</span></p>
            <p class="telemetry">> External Ingress: workshop.grizzlymedicine.icu</p>
            <hr style="border: 1px solid #1a1a20;">
            <p style="color: #666;">Waiting for blueprint ingestion...</p>
        </body>
        </html>
    `);
});

// Locked Management Routes
app.get('/fabricate', secure, (req, res) => {
    res.send('Access Granted: Fabrication protocols active.');
});

app.listen(port, () => console.log(`Forge running on port ${port}`));
