import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

export function createStaticServer(directory) {
  const root = path.resolve(directory);
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
  return http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); return response.end(); }
    try {
      const url = new URL(request.url, 'http://localhost');
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(root, relative);
      const publicPath = ['index.html', 'styles.css', 'app.js', 'share.js', 'media-policy.js', 'listing-config.js', 'robots.txt', 'sitemap.xml', 'indexnow-key.txt', 'property-summary.html'].includes(relative)
        || file.startsWith(path.join(root, 'assets') + path.sep);
      // Development should never publish the source listing or repository metadata.
      if (!file.startsWith(root + path.sep) || !publicPath || relative.split(/[\\/]/).some(segment => segment.startsWith('.') || ['basefiles', 'node_modules', 'tmp', 'scripts', 'tests'].includes(segment.toLowerCase()))) {
        response.writeHead(403); return response.end('Forbidden');
      }
      const stat = await fsp.stat(file);
      if (!stat.isFile()) { response.writeHead(404); return response.end('Not found'); }
      const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
      let start = 0, end = stat.size - 1, status = 200;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!match || (!match[1] && !match[2])) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return response.end(); }
        if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
        else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
        if (start > end || start >= stat.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return response.end(); }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length'] = Math.max(0, end - start + 1);
      response.writeHead(status, headers);
      if (request.method === 'HEAD' || !stat.size) return response.end();
      pipeline(fs.createReadStream(file, { start, end }), response, () => {});
    } catch (error) {
      if (!response.headersSent) response.writeHead(error.code === 'ENOENT' ? 404 : 400);
      response.end('File unavailable');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createStaticServer(process.argv[2] || '.');
  const port = Number(process.env.PORT || 4173);
  server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
