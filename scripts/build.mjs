import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { preparePromotion } from './prepare-promotion.mjs';
import { tourVideoUrl } from '../media-policy.js';

const root = process.cwd();
const cloudflare = process.argv.includes('--cloudflare');
const output = cloudflare ? 'dist-cloudflare' : 'dist';
const destination = path.resolve(root, output);
if (destination !== path.join(root, output) || !['dist', 'dist-cloudflare'].includes(output)) throw new Error('Invalid build destination');
await preparePromotion();
const files = ['index.html', 'styles.css', 'app.js', 'share.js', 'media-policy.js', 'listing-config.js', 'robots.txt', 'sitemap.xml', 'indexnow-key.txt', 'property-summary.html', '_headers'];
const manifest = JSON.parse(await fs.readFile('assets/photos.json', 'utf8'));
for (const photo of manifest) for (const width of [400, 800, 1600]) await fs.access(`assets/photos/${photo.id}-${width}.webp`);
for (const quality of [720, 540]) await fs.access(`assets/video/tour-${quality}.mp4`);
// Only remove the verified build directory, never the repository or source assets.
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
for (const file of files) await fs.copyFile(file, path.join(destination, file));
await fs.cp('assets', path.join(destination, 'assets'), {
  recursive: true,
  filter: file => !file.endsWith('.pending.mp4') && !(cloudflare && path.resolve(file) === path.join(root, 'assets', 'video')),
});
if (cloudflare) {
  const videos = {};
  for (const quality of [720, 540]) {
    const file = `assets/video/tour-${quality}.mp4`;
    const data = await fs.readFile(file);
    const sha256 = createHash('sha256').update(data).digest('hex');
    videos[`/${file}`] = { key: `7741greenlake/tour-${quality}-${sha256}.mp4`, size: data.length, sha256 };
  }
  await fs.mkdir('cloudflare', { recursive: true });
  await fs.writeFile('cloudflare/video-manifest.json', JSON.stringify(videos, null, 2) + '\n');
  console.log(`Built Cloudflare assets in ${destination}; versioned video files will be uploaded to R2 by npm run deploy.`);
} else {
  console.log(`Built self-contained static website in ${destination}`);
  console.log(`${manifest.length} photos × 3 WebP sizes; 720p / 540p video (1080p streams from ${tourVideoUrl}). Upload only the contents of dist/.`);
}
