import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

await fs.mkdir('tmp', { recursive: true });
const pdf = await getDocument({ data: new Uint8Array(await fs.readFile('basefiles/Lo & Tan ACTIVE MLS Listing.pdf')), useSystemFonts: true }).promise;
let text = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  text += `\n--- Page ${i} ---\n${content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('')}`;
}
await fs.writeFile('tmp/listing.txt', text);
console.log(text);
const entries = await fs.readdir('basefiles/photos', { recursive: true });
const photos = entries.filter(name => /\.jpg$/i.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
await fs.writeFile('tmp/photo-inventory.json', JSON.stringify(photos, null, 2));
for (let start = 0; start < photos.length; start += 24) {
  const batch = photos.slice(start, start + 24);
  const layers = [];
  for (let i = 0; i < batch.length; i++) {
    const left = (i % 4) * 320, top = Math.floor(i / 4) * 236;
    const photo = await sharp(path.join('basefiles/photos', batch[i])).rotate().resize(312, 204, { fit: 'inside' }).toBuffer();
    layers.push({ input: photo, left, top });
    const label = batch[i].replaceAll('&', '&amp;');
    layers.push({ input: Buffer.from(`<svg width="320" height="28"><rect width="320" height="28" fill="white"/><text x="8" y="19" font-family="Arial" font-size="15">${label}</text></svg>`), left, top: top + 205 });
  }
  await sharp({ create: { width: 1280, height: Math.ceil(batch.length / 4) * 236, channels: 3, background: '#dddddd' } }).composite(layers).jpeg({ quality: 85 }).toFile(`tmp/contact-sheet-${start / 24 + 1}.jpg`);
}
