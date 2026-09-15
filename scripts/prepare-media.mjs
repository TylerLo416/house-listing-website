import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const source = 'basefiles/photos';
await fs.mkdir('assets/photos', { recursive: true });
await fs.mkdir('assets/video', { recursive: true });
const files = (await fs.readdir(source, { recursive: true })).filter(file => /\.jpg$/i.test(file));
const descriptions = [
  [1, 5, 'exterior', 'Front exterior and garden'],
  [6, 10, 'living', 'Sunlit entry with original woodwork'],
  [11, 16, 'living', 'Living room with hardwood floors and large windows'],
  [17, 21, 'outdoor', 'Upper composite deck with white railing'],
  [22, 27, 'kitchen', 'Dining area opening onto the deck'],
  [28, 30, 'kitchen', 'Main kitchen with wood cabinets and granite counters'],
  [31, 37, 'living', 'Additional living and dining space'],
  [38, 39, 'kitchen', 'Additional kitchen with breakfast bar'],
  [40, 40, 'living', 'Upstairs landing'],
  [41, 43, 'bedrooms', 'Bedroom with hardwood floors and large windows'],
  [44, 44, 'bedrooms', 'Walk-in closet with shelving'],
  [45, 46, 'bedrooms', 'Bedroom with wood floors'],
  [47, 47, 'bedrooms', 'Bedroom closet'],
  [48, 50, 'bedrooms', 'Unfurnished room with hardwood floors'],
  [51, 52, 'bathrooms', 'Bathroom with white subway tile and pedestal sink'],
  [53, 57, 'bedrooms', 'Unfurnished bedroom and closet'],
  [58, 61, 'living', 'Bright additional living area'],
  [62, 63, 'bathrooms', 'Bathroom with bathtub and vanity'],
  [64, 64, 'bedrooms', 'Closet beneath the pitched roof'],
  [65, 65, 'living', 'Window-side desk nook'],
  [66, 72, 'studio', 'Lower-level space with kitchenette and closets'],
  [73, 73, 'bathrooms', 'Lower-level shower'],
  [74, 74, 'studio', 'Lower-level kitchenette'],
  [75, 75, 'bathrooms', 'Lower-level bathroom'],
  [76, 76, 'utility', 'Stacked washer and dryer'],
  [77, 77, 'utility', 'Garage loft'],
  [78, 79, 'utility', 'Detached garage interior'],
  [80, 82, 'exterior', 'Side garden and exterior'],
  [83, 88, 'outdoor', 'Backyard, lower deck and detached garage'],
  [89, 91, 'exterior', 'House and grounds'],
  [92, 94, 'neighborhood', 'Aerial view toward Green Lake'],
  [95, 96, 'exterior', 'Separate lower-level entrance'],
  [97, 99, 'outdoor', 'Exterior landing and stairs'],
  [100, 102, 'living', 'Window-side desk nook and landing'],
  [103, 104, 'studio', 'Lower-level room and kitchenette'],
  [105, 108, 'exterior', 'Aerial view of the house, decks and garden'],
];
const staged = {
  1: ['outdoor', 'Upper deck with virtual outdoor furniture'],
  2: ['living', 'Living and dining area with virtual furniture'],
  3: ['bedrooms', 'Bedroom with virtual furniture'],
  4: ['bedrooms', 'Bedroom with virtual furniture, second view'],
  5: ['studio', 'Lower-level space with virtual furniture'],
};
const manifest = [];
for (const file of files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
  const filename = path.basename(file);
  const n = Number(filename.match(/\d+/)[0]);
  const isStaged = file.includes('Virtual Staging');
  const isTwilight = /^\d/.test(filename);
  const id = isStaged ? `staged-${n}` : isTwilight ? `twilight-${n}` : `acre-${String(n).padStart(3, '0')}`;
  const [, , category, alt] = isStaged ? [0, 0, ...staged[n]] : isTwilight
    ? [0, 0, n === 2 ? 'outdoor' : 'exterior', n === 2 ? 'Upper deck at twilight' : 'House exterior at twilight']
    : descriptions.find(([start, end]) => n >= start && n <= end);
  const metadata = await sharp(path.join(source, file)).metadata();
  const sizes = {};
  for (const [width, quality] of [[400, 55], [800, 73], [1600, 82]]) {
    const output = `assets/photos/${id}-${width}.webp`;
    let regenerate = false;
    try { regenerate = (await fs.stat(output)).mtimeMs < (await fs.stat(path.join(source, file))).mtimeMs; }
    catch { regenerate = true; }
    if (regenerate) await sharp(path.join(source, file)).rotate().resize({ width, withoutEnlargement: true }).webp({ quality, effort: 4 }).toFile(output);
    sizes[width] = (await fs.stat(output)).size;
  }
  manifest.push({ id, category, alt, staged: isStaged, width: metadata.width, height: metadata.height, bytes: sizes, source: file.replaceAll('\\', '/') });
}
// Curated opening sequence; every supplied photograph remains available.
const featured = ['twilight-1', 'acre-015', 'acre-028', 'acre-041', 'acre-018', 'acre-092', 'acre-051', 'acre-045', 'acre-009', 'acre-025', 'acre-087', 'acre-031'];
manifest.sort((a, b) => {
  const ai = featured.indexOf(a.id), bi = featured.indexOf(b.id);
  return (ai < 0 ? 1000 : ai) - (bi < 0 ? 1000 : bi);
});
await fs.writeFile('assets/photos.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${manifest.length} photos in three WebP sizes.`);

if (!process.argv.includes('--photos-only')) {
  for (const [height, crf, maxrate, bufsize] of [[1080, 23, '4500k', '9000k'], [720, 25, '2200k', '4400k'], [540, 27, '1000k', '2000k']]) {
    const output = `assets/video/tour-${height}.mp4`;
    try { if ((await fs.stat(output)).size > 0) { console.log(`Keeping ${output}`); continue; } } catch {}
    const input = `basefiles/videos/7741_1st_ave_ne,_seattle,_wa_98115_-_unbranded (${height}p).mp4`;
    const temporary = `assets/video/tour-${height}.pending.mp4`;
    console.log(`Encoding ${height}p tour…`);
    await new Promise((resolve, reject) => {
      const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf), '-maxrate', maxrate, '-bufsize', bufsize, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', temporary], { stdio: 'inherit', windowsHide: true });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    });
    await fs.rename(temporary, output);
    console.log(`${output}: ${((await fs.stat(output)).size / 1024 / 1024).toFixed(1)} MB`);
  }
}
