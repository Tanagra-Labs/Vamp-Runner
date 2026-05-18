const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Vamp-Runner listening on port ${PORT}`));

// Keep Railway from sleeping the dyno
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  setInterval(() => {
    https.get(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`, (res) => {
      console.log(`Keep-alive ping: ${res.statusCode}`);
    }).on('error', (e) => console.error('Ping failed:', e.message));
  }, 5 * 60 * 1000);
}
