// Local preview server for the static site in public/ (gzip, no dependencies).
//   npm run dev            → http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve('public');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return res.writeHead(400).end(); }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '') && /json|text|svg/.test(type);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache', ...(gzip && { 'content-encoding': 'gzip' }) });
    const stream = fs.createReadStream(file);
    (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
  })
  .listen(PORT, () => console.log(`Tale of the Tape → http://localhost:${PORT}`));
