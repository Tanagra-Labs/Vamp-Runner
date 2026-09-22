const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

// Serve game assets only; repository metadata and server code are not assets.
const ASSETS = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/game.js", ["game.js", "text/javascript; charset=utf-8"]],
  ["/rules.js", ["rules.js", "text/javascript; charset=utf-8"]],
  ["/levels.js", ["levels.js", "text/javascript; charset=utf-8"]],
  ["/audio.js", ["audio.js", "text/javascript; charset=utf-8"]],
  ["/bat.js", ["bat.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(req.method === "HEAD" ? undefined : "ok");
      return;
    }
    if (pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    const asset = ASSETS.get(pathname);
    if (!asset) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    fs.readFile(path.join(__dirname, asset[0]), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Could not load asset");
        return;
      }
      res.writeHead(200, {
        "Content-Type": asset[1],
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer().listen(port, () =>
    console.log(`Vamp-Runner listening on port ${port}`),
  );
  // Preserve the existing Railway keep-alive behavior.
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    setInterval(
      () => {
        https
          .get(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`, (res) => {
            res.resume();
            console.log(`Keep-alive ping: ${res.statusCode}`);
          })
          .on("error", (e) => console.error("Ping failed:", e.message));
      },
      5 * 60 * 1000,
    ).unref();
  }
}
module.exports = { createServer };
