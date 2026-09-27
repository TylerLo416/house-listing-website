import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer } from '../scripts/serve.mjs';

test('static hosting serves pages, MIME types and video byte ranges', async () => {
  const server = createStaticServer('.');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /7741 Green Lake/);
    const photo = await fetch(`${base}/assets/photos/twilight-1-400.webp`);
    assert.equal(photo.headers.get('content-type'), 'image/webp');
    for (const quality of [720, 540]) {
      const range = await fetch(`${base}/assets/video/tour-${quality}.mp4`, { headers: { Range: 'bytes=0-1023' } });
      assert.equal(range.status, 206);
      assert.equal(range.headers.get('content-type'), 'video/mp4');
      assert.match(range.headers.get('content-range'), /^bytes 0-1023\/\d+$/);
      assert.equal((await range.arrayBuffer()).byteLength, 1024);
    }
    assert.equal((await fetch(`${base}/basefiles/contactinfo`)).status, 403);
    assert.equal((await fetch(`${base}/BASEFILES/contactinfo`)).status, 403);
    assert.equal((await fetch(`${base}/.git/config`)).status, 403);
    assert.equal((await fetch(`${base}/assets/missing.webp`)).status, 404);
    const invalid = await fetch(`${base}/assets/video/tour-540.mp4`, { headers: { Range: 'bytes=9999999999-' } });
    assert.equal(invalid.status, 416);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
