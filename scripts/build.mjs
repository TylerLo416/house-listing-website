import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const destination = path.resolve(root, 'dist');
if (destination !== path.join(root, 'dist')) throw new Error('Invalid build destination');
const files = ['index.html', 'styles.css', 'app.js', 'media-policy.js', 'listing-config.js'];
const manifest = JSON.parse(await fs.readFile('assets/photos.json', 'utf8'));
for (const photo of manifest) for (const width of [400, 800, 1600]) await fs.access(`assets/photos/${photo.id}-${width}.webp`);
for (const quality of [1080, 720, 540]) await fs.access(`assets/video/tour-${quality}.mp4`);
await fs.mkdir(destination, { recursive: true });
for (const file of files) await fs.copyFile(file, path.join(destination, file));
await fs.cp('assets', path.join(destination, 'assets'), { recursive: true, filter: file => !file.endsWith('.pending.mp4') });
console.log(`Built self-contained static website in ${destination}`);
console.log(`${manifest.length} photos × 3 WebP sizes; 1080p / 720p / 540p video. Upload only the contents of dist/.`);
