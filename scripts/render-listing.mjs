import fs from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdf = await getDocument({ data: new Uint8Array(await fs.readFile('basefiles/Lo & Tan ACTIVE MLS Listing.pdf')), useSystemFonts: true }).promise;
await fs.mkdir('tmp', { recursive: true });
for (const number of [1, 2]) {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale: 1.4 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  await fs.writeFile(`tmp/listing-page-${number}.png`, await canvas.encode('png'));
}
