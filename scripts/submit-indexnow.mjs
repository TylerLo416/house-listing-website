import fs from 'node:fs/promises';
import { listing } from '../listing-config.js';

// Run only after publishing. Submitting is a notification, not an indexing guarantee.
const key = (await fs.readFile('indexnow-key.txt', 'utf8')).trim();
if (!/^[a-f0-9]{48}$/.test(key)) throw new Error('Invalid IndexNow key');
const keyLocation = new URL('indexnow-key.txt', listing.siteUrl).href;
const proof = await fetch(keyLocation, { signal: AbortSignal.timeout(20000) });
if (!proof.ok || (await proof.text()).trim() !== key) throw new Error('Ownership key is not live; publish before submitting.');
const page = await fetch(listing.siteUrl, { signal: AbortSignal.timeout(20000) });
const html = await page.text();
if (!page.ok || !html.includes('listing-metadata:start') || !html.includes('rel="canonical"')) throw new Error('The updated listing is not live.');
const endpoint = 'https://api.indexnow.org/indexnow';
const response = await fetch(endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(listing.siteUrl).host, key, keyLocation, urlList: [listing.siteUrl] }),
  signal: AbortSignal.timeout(30000),
});
const responseBody = (await response.text()).slice(0, 1000);
const receipt = { submittedAt: new Date().toISOString(), endpoint, urls: [listing.siteUrl], status: response.status,
  outcome: response.status === 200 ? 'URL received; indexing is not guaranteed' : response.status === 202 ? 'URL received; ownership validation pending' : 'Submission failed', responseBody };
await fs.mkdir('marketing', { recursive: true });
await fs.writeFile('marketing/indexnow-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (![200, 202].includes(response.status)) process.exitCode = 1;
