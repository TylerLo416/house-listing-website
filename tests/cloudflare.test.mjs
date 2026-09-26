import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.js';
import videos from '../cloudflare/video-manifest.json' with { type: 'json' };

function fixture() {
  const bytes = new TextEncoder().encode('0123456789');
  const calls = [];
  const object = { size: bytes.length, httpEtag: '"tour-etag"', uploaded: new Date('2026-09-18T12:00:00Z') };
  const env = {
    ASSETS: { fetch: async () => new Response('static page') },
    VIDEOS: {
      head: async key => { calls.push(['head', key]); return object; },
      get: async (key, options) => {
        calls.push(['get', key, options]);
        const range = options?.range;
        const body = range ? bytes.slice(range.offset, range.offset + range.length) : bytes;
        return { body: new Response(body).body };
      },
    },
  };
  const fetch = (headers = {}, method = 'GET', path = '/assets/video/tour-1080.mp4') =>
    worker.fetch(new Request(`https://7741greenlake.com${path}`, { headers, method }), env);
  return { fetch, env, calls };
}

test('Cloudflare streams all three videos and serves ordinary files through assets', async () => {
  const { fetch, calls } = fixture();
  for (const [path, video] of Object.entries(videos)) {
    const response = await fetch({}, 'GET', path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'video/mp4');
    assert.equal(response.headers.get('Content-Length'), '10');
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(await response.text(), '0123456789');
    assert.equal(calls.at(-1)[1], video.key);
  }
  assert.equal(await (await fetch({}, 'GET', '/')).text(), 'static page');
});

test('Cloudflare supports video seeking, suffix ranges and HEAD requests', async () => {
  const { fetch, calls } = fixture();
  for (const [range, text, contentRange] of [
    ['bytes=0-1', '01', 'bytes 0-1/10'],
    ['bytes=6-', '6789', 'bytes 6-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=8-999', '89', 'bytes 8-9/10'],
    ['bytes=-999', '0123456789', 'bytes 0-9/10'],
  ]) {
    const response = await fetch({ Range: range });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('Content-Range'), contentRange);
    assert.equal(Number(response.headers.get('Content-Length')), text.length);
    assert.equal(await response.text(), text);
  }
  calls.length = 0;
  const head = await fetch({ Range: 'bytes=0-1' }, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), '10');
  assert.equal(await head.text(), '');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'head');
});

test('Cloudflare rejects unsatisfiable ranges and ignores unsupported range syntax', async () => {
  const { fetch, calls } = fixture();
  for (const range of ['bytes=10-', 'bytes=9-1', 'bytes=-0']) {
    const response = await fetch({ Range: range });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */10');
  }
  assert.ok(calls.every(call => call[0] === 'head'));
  for (const range of ['bytes=0-1,4-5', 'invalid', 'bytes=-']) {
    const response = await fetch({ Range: range });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '0123456789');
  }
});

test('Cloudflare honors conditional caching and If-Range when resuming video', async () => {
  const { fetch, calls } = fixture();
  for (const headers of [
    { 'If-None-Match': '"tour-etag"' },
    { 'If-None-Match': 'W/"tour-etag", "other"' },
    { 'If-None-Match': '*' },
    { 'If-Modified-Since': 'Fri, 18 Sep 2026 12:00:00 GMT' },
  ]) assert.equal((await fetch(headers)).status, 304);
  assert.ok(calls.every(call => call[0] === 'head'));
  assert.equal((await fetch({ 'If-None-Match': '"old"', 'If-Modified-Since': 'Fri, 18 Sep 2026 12:00:00 GMT' })).status, 200);
  for (const [value, status] of [
    ['"tour-etag"', 206], ['"old"', 200], ['W/"tour-etag"', 200],
    ['Fri, 18 Sep 2026 12:00:00 GMT', 206], ['Thu, 17 Sep 2026 12:00:00 GMT', 200],
  ]) assert.equal((await fetch({ Range: 'bytes=0-1', 'If-Range': value })).status, status);
});

test('Cloudflare only exposes the listed tour files and permits read requests', async () => {
  const { fetch, env, calls } = fixture();
  assert.equal((await fetch({}, 'GET', '/assets/video/private.mp4')).status, 404);
  const post = await fetch({}, 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  assert.equal(calls.length, 0);
  env.VIDEOS.head = async () => null;
  assert.equal((await fetch()).status, 404);
});
