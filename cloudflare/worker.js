import videos from './video-manifest.json' with { type: 'json' };

function byteRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  // Ignore malformed or multipart ranges; a complete response is allowed.
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return false;
  return { offset: start, length: end - start + 1 };
}

function unchanged(request, object) {
  const tags = request.headers.get('If-None-Match');
  if (tags !== null) return tags.split(',').some(tag => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === object.httpEtag);
  const since = Date.parse(request.headers.get('If-Modified-Since'));
  return Number.isFinite(since) && Math.floor(object.uploaded.getTime() / 1000) <= since / 1000;
}

function canUseRange(request, object) {
  const value = request.headers.get('If-Range');
  if (!value) return true;
  if (value.startsWith('"') || value.startsWith('W/')) return value === object.httpEtag;
  const since = Date.parse(value);
  return Number.isFinite(since) && Math.floor(object.uploaded.getTime() / 1000) <= since / 1000;
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith('/assets/video/')) return env.ASSETS.fetch(request);
    const video = Object.hasOwn(videos, pathname) && videos[pathname];
    if (!video) return new Response('Not found', { status: 404 });
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    // Content-addressed R2 keys keep each deployment consistent when media changes.
    const object = await env.VIDEOS.head(video.key);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
      'ETag': object.httpEtag,
      'Last-Modified': object.uploaded.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    if (unchanged(request, object)) return new Response(null, { status: 304, headers });
    const range = request.method === 'GET' && canUseRange(request, object)
      ? byteRange(request.headers.get('Range'), object.size) : null;
    if (range === false) {
      headers.set('Content-Range', `bytes */${object.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Length', String(range ? range.length : object.size));
    if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    if (request.method === 'HEAD') return new Response(null, { headers });
    const result = await env.VIDEOS.get(video.key, range ? { range } : undefined);
    if (!result) return new Response('Not found', { status: 404 });
    return new Response(result.body, { status: range ? 206 : 200, headers });
  },
};
