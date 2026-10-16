// Local development server: `npm start` (real data) or `npm run mock` (demo data, no internet needed).
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const fpl = require('./api/fpl');
const elite = require('./api/elite');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

http
  .createServer(async (req, res) => {
    const u = url.parse(req.url, true);
    req.query = u.query;
    if (u.pathname === '/api/fpl') return fpl(req, res);
    if (u.pathname === '/api/elite') return elite(req, res);

    let file = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
    if (!file.startsWith(ROOT)) {
      res.statusCode = 403;
      return res.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) file = path.join(ROOT, 'index.html');
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`FPL Elite running on http://localhost:${PORT}${process.env.FPL_MOCK === '1' ? '  (demo data)' : ''}`);
  });
