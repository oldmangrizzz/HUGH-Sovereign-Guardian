const http = require("http");
const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT      = 5173;
const ROOT      = path.join(__dirname, "dist");
const LOOM_HOST = "192.168.4.152";
const LOOM_PORT = 7777;
const LOOM_KEY  = process.env.LOOM_API_KEY || "1f43f776d71ce94280336153d8614cb9a742ea2ce0b21c5a682181386cfcb5a4";
const ALLOWED_ORIGIN = "https://workshop.grizzlymedicine.icu";

// Rate limiting state
const rates = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 10;

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2":"font/woff2",
  ".woff": "font/woff",
  ".ttf":  "font/ttf",
};

// T-L02: Read-Only Cypher Whitelist
function isSafeCypher(cypher) {
  if (!cypher) return true; // Let the downstream API handle empty
  const c = cypher.toUpperCase();
  // Block mutation keywords
  const dangerous = ["CREATE", "DELETE", "MERGE", "SET", "DETACH", "DROP", "REMOVE"];
  for (const keyword of dangerous) {
    if (c.includes(keyword)) return false;
  }
  return true;
}

const server = http.createServer((req, res) => {

  // ── LOOM PROXY ─────────────────────────────────────────────────────────────
  if (req.url.startsWith("/api/loom")) {
    // T-L01: Origin Validation
    const origin = req.headers.origin;
    if (origin && origin !== ALLOWED_ORIGIN) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden Origin" }));
      return;
    }

    // T-L01: Rate Limiting
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const now = Date.now();
    if (!rates.has(ip)) rates.set(ip, []);
    let requests = rates.get(ip);
    requests = requests.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (requests.length >= MAX_REQUESTS) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Too Many Requests" }));
      return;
    }
    requests.push(now);
    rates.set(ip, requests);

    const loomPath = req.url.replace("/api/loom", "") || "/";
    let body = Buffer.alloc(0);
    req.on("data", c => { body = Buffer.concat([body, c]); });
    req.on("end", () => {
      // T-L02: Cypher Injection Protection
      if (loomPath === "/query/graph" && req.method === "POST") {
        try {
          const jsonBody = JSON.parse(body.toString());
          if (!isSafeCypher(jsonBody.cypher)) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Destructive Cypher queries are forbidden." }));
            return;
          }
        } catch (e) {
          // If JSON is invalid, let the downstream handle it, or block it. We block for safety.
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }
      }

      const opts = {
        hostname: LOOM_HOST,
        port:     LOOM_PORT,
        path:     loomPath,
        method:   req.method,
        headers: {
          "content-type":  req.headers["content-type"] || "application/json",
          "content-length": body.length,
          "x-loom-key":    LOOM_KEY,
        },
      };
      const proxy = http.request(opts, pr => {
        res.writeHead(pr.statusCode, {
          "content-type":                pr.headers["content-type"] || "application/json",
          "access-control-allow-origin": ALLOWED_ORIGIN,
        });
        pr.pipe(res);
      });
      proxy.on("error", e => {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "LOOM unreachable", detail: e.message }));
      });
      if (body.length) proxy.write(body);
      proxy.end();
    });
    return;
  }

  // ── STATIC FILES ───────────────────────────────────────────────────────────
  const urlPath = req.url === "/" ? "index.html" : req.url.split("?")[0];
  let filePath  = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const dirIndex = path.join(filePath, "index.html");
    filePath = fs.existsSync(dirIndex) ? dirIndex : path.join(ROOT, "index.html");
  }

  const ext         = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type":                contentType,
      "Cache-Control":               ext === ".html" ? "no-cache" : "public, max-age=31536000",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Workshop serving on port " + PORT + " [SECURED]");
});
