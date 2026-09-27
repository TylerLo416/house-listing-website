import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chooseMediaPolicy, nextLowerQuality, filterPhotos, categories, photoSource, videoSource } from '../media-policy.js';

test('good and unknown connections start at 1080p', () => {
  assert.equal(chooseMediaPolicy().quality, '1080');
  assert.equal(chooseMediaPolicy(null).quality, '1080');
  assert.equal(chooseMediaPolicy({ effectiveType: '4g', downlink: 10 }).quality, '1080');
});
test('bandwidth, Save-Data and reduced motion choose appropriate media', () => {
  assert.equal(chooseMediaPolicy({ downlink: 3 }).quality, '720');
  assert.equal(chooseMediaPolicy({ effectiveType: '3g' }).quality, '540');
  assert.equal(chooseMediaPolicy({ downlink: 1.5 }).quality, '540');
  assert.deepEqual(chooseMediaPolicy({ saveData: true }), { quality: 'photos', saveData: true, autoplay: false });
  for (const connection of [{ effectiveType: '2g' }, { effectiveType: 'slow-2g' }, { downlink: 0.2 }, { downlink: 0 }]) {
    assert.deepEqual(chooseMediaPolicy(connection), { quality: 'photos', saveData: false, autoplay: false });
  }
  assert.equal(chooseMediaPolicy({ effectiveType: '3g', downlink: 1.5 }).saveData, false);
  assert.equal(chooseMediaPolicy({}, true).autoplay, false);
  assert.equal(chooseMediaPolicy({}, true).quality, '1080');
  assert.equal(chooseMediaPolicy({ downlink: NaN }).quality, '1080');
});
test('buffering steps down through video qualities to photos', () => {
  assert.equal(nextLowerQuality('1080'), '720');
  assert.equal(nextLowerQuality('720'), '540');
  assert.equal(nextLowerQuality('540'), 'photos');
});
test('every supplied photo has valid categories and three real WebP files', async () => {
  const photos = JSON.parse(await fs.readFile(new URL('../assets/photos.json', import.meta.url)));
  assert.equal(photos.length, 99);
  for (const id of ['acre-048', 'acre-057', 'acre-066', 'acre-104']) assert.ok(!photos.some(photo => photo.id === id), `Empty-room photo ${id} is listed`);
  assert.equal(new Set(photos.map(photo => photo.id)).size, photos.length);
  assert.equal(filterPhotos(photos, 'staged').length, 5);
  assert.equal(filterPhotos(photos, 'all').length, photos.length);
  for (const [id] of categories) assert.ok(filterPhotos(photos, id).length > 0, `Empty category: ${id}`);
  for (const photo of photos) {
    assert.ok(categories.some(([id]) => id === photo.category));
    assert.ok(photo.alt && photo.width > 0 && photo.height > 0);
    for (const width of [400, 800, 1600]) {
      const data = await fs.readFile(new URL(`../${photoSource(photo, width)}`, import.meta.url));
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.toString('ascii', 8, 12), 'WEBP');
      assert.equal(data.length, photo.bytes[width]);
    }
  }
});
test('1080p streams from the supplied tour URL; lower qualities are self-hosted', () => {
  assert.equal(videoSource('1080'), 'https://media.memowishcards.com/7741-1st-ave-ne-seattle-1080p.mp4');
  assert.equal(videoSource('720'), 'assets/video/tour-720.mp4');
  assert.equal(videoSource('540'), 'assets/video/tour-540.mp4');
  assert.throws(() => videoSource('photos'));
});
