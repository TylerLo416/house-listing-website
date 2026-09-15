import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listing } from '../listing-config.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const price = money.format(listing.askingPrice);
const url = listing.siteUrl;
const description = `Green Lake duplex / multi-family home for sale at ${listing.address}, Seattle: ${price}, ${listing.bedrooms} beds, ${listing.bathrooms} baths, ${listing.squareFeet.toLocaleString('en-US')} sq ft. Photos, video tour & showings.`;
const credit = `MLS #${listing.mlsNumber} · Listing courtesy of List4FlatFee.com, LLC.`;
const campaign = (source, medium = 'social', content = 'property_tour') => {
  const link = new URL(url);
  link.search = new URLSearchParams({ utm_source: source, utm_medium: medium, utm_campaign: 'greenlake_listing', utm_content: content }).toString();
  return link.href;
};

export async function preparePromotion() {
  if (new URL(url).protocol !== 'https:' || !Number.isFinite(listing.askingPrice) || listing.askingPrice <= 0) throw new Error('Invalid public listing configuration');
  const property = {
    '@type': ['Residence', 'Accommodation'], '@id': `${url}#property`,
    name: `${listing.address}, ${listing.city}, ${listing.region} ${listing.postalCode}`,
    description: 'Duplex / multi-family property in Green Lake, Seattle. All bedroom, bathroom and area figures describe the whole property.',
    address: { '@type': 'PostalAddress', streetAddress: listing.address, addressLocality: listing.city, addressRegion: listing.region, postalCode: listing.postalCode, addressCountry: 'US' },
    numberOfBedrooms: listing.bedrooms, numberOfBathroomsTotal: listing.bathrooms,
    floorSize: { '@type': 'QuantitativeValue', value: listing.squareFeet, unitCode: 'FTK', unitText: 'square feet' },
    identifier: { '@type': 'PropertyValue', propertyID: 'MLS', value: listing.mlsNumber },
    image: `${url}assets/photos/twilight-1-1600.webp`,
    sameAs: listing.zillowUrl,
  };
  const structured = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'RealEstateListing', '@id': `${url}#listing`, url, name: listing.title, description,
        inLanguage: 'en-US', mainEntity: { '@id': `${url}#property` },
        offers: { '@type': 'Offer', price: listing.askingPrice, priceCurrency: 'USD', url: `${url}#contact`, itemOffered: { '@id': `${url}#property` } } },
      property,
    ],
  };
  const metadata = `<!-- listing-metadata:start -->
  <title>${escape(listing.title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${escape(url)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="7741 Green Lake">
  <meta property="og:url" content="${escape(url)}">
  <meta property="og:title" content="${escape(listing.title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escape(listing.title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>
  <!-- listing-metadata:end -->`;
  let html = await fs.readFile('index.html', 'utf8');
  if (!html.includes('<!-- listing-metadata:start -->')) throw new Error('Missing metadata insertion point');
  html = html.replace(/<!-- listing-metadata:start -->[\s\S]*?<!-- listing-metadata:end -->/, () => metadata);
  html = html.replace(/(<a id="asking-price" href="#contact">)[^<]+/, (_, open) => `${open}${price} `);
  await fs.writeFile('index.html', html);

  await fs.writeFile('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${url}sitemap.xml\n`);
  await fs.writeFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${escape(url)}</loc>
${['twilight-1', 'acre-015', 'acre-018'].map(id => `    <image:image><image:loc>${escape(`${url}assets/photos/${id}-1600.webp`)}</image:loc></image:image>`).join('\n')}
  </url>
</urlset>
`);
  try { await fs.access('indexnow-key.txt'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // This is a public ownership proof, never a Netlify or search account credential.
    await fs.writeFile('indexnow-key.txt', randomBytes(24).toString('hex'), { flag: 'wx' });
  }

  const printUrl = campaign('property_summary', 'referral');
  await fs.writeFile('property-summary.html', `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(listing.address)} — Property summary</title><meta name="robots" content="noindex, follow"><link rel="canonical" href="${escape(url)}">
<style>
*{box-sizing:border-box}body{margin:0;background:#eef2f3;color:#142c38;font:16px/1.55 'Segoe UI',Arial,sans-serif}main{max-width:960px;margin:32px auto;padding:40px;background:white}header{display:flex;justify-content:space-between;gap:20px;align-items:start}.label{font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#a25932}h1{font:clamp(30px,5vw,48px)/1.08 Georgia,serif;margin:12px 0}h2{font:28px Georgia,serif;margin:24px 0 8px}p{margin:8px 0}.price{font-size:28px;white-space:nowrap}.hero{display:block;width:100%;aspect-ratio:2/1;object-fit:cover;margin:24px 0 0}.facts{display:flex;flex-wrap:wrap;gap:12px 26px;border-block:1px solid #d9dfe0;padding:16px 0;margin:20px 0}.facts span{white-space:nowrap}.photos{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.photos img{width:100%;aspect-ratio:1.65;object-fit:cover}ul{padding-left:22px;columns:2}li{break-inside:avoid;padding:3px 0}a{color:inherit;text-underline-offset:3px}footer{border-top:1px solid #d9dfe0;margin-top:24px;padding-top:18px}.fine{font-size:14px;color:#5b686e}.actions{display:flex;gap:18px;align-items:center;margin-bottom:24px}.link{overflow-wrap:anywhere}@media(max-width:600px){main{margin:0;padding:22px}header{display:block}.price{margin-top:16px}ul{columns:1}}@page{size:letter;margin:.4in}@media print{body{background:white;font-size:11px}main{margin:0;padding:0;max-width:none}.actions{display:none}h1{font-size:32px}.label,.fine{font-size:9px}.price{font-size:24px}.hero{height:2.6in;aspect-ratio:auto;margin-top:15px}.facts{margin:12px 0;padding:10px 0}.photos{margin:12px 0;gap:10px}.photos img{height:1.25in;aspect-ratio:auto}h2{font-size:20px;margin:12px 0 6px}footer{margin-top:12px;padding-top:10px}a{text-decoration:none}}
</style></head><body><main>
<div class="actions"><a href="${escape(url)}">← Full listing and video tour</a><span>Use your browser’s Print command to print or save as PDF.</span></div>
<header><div><p class="label">For sale · Green Lake, Seattle</p><h1>${escape(listing.address)}</h1><p>Seattle, WA 98115 · Duplex / multi-family property</p></div><strong class="price">${price}</strong></header>
<img class="hero" src="assets/photos/twilight-1-1600.webp" alt="Front exterior of 7741 1st Avenue NE at twilight" width="1600" height="1067">
<div class="facts"><span><strong>${listing.bedrooms}</strong> bedrooms</span><span><strong>${listing.bathrooms}</strong> bathrooms</span><span><strong>${listing.squareFeet.toLocaleString('en-US')}</strong> sq ft</span><span>Built <strong>${listing.yearBuilt}</strong></span></div>
<h2>Classic details. Space inside and out.</h2><p>Fir and oak floors, classic trim and generous windows give this Green Lake home its character. Explore the updated main kitchen, separate entrances and outdoor spaces.</p>
<ul><li>Granite kitchen counters</li><li>Two composite decks</li><li>Backyard and garden</li><li>Detached garage</li></ul>
<div class="photos"><img src="assets/photos/acre-015-800.webp" alt="Living room" width="800" height="533"><img src="assets/photos/acre-018-800.webp" alt="Upper deck" width="800" height="533"></div>
<footer><strong>Photos, video tour and showing information</strong><p class="link"><a href="${escape(printUrl)}">7741greenlake.netlify.app</a></p><p>Contact the seller: <a href="tel:+14255124418">425-512-4418</a> · <a href="mailto:klo10606@gmail.com?subject=Showing%20request%20-%207741%20Green%20Lake">klo10606@gmail.com</a></p><p class="fine">Whole-property figures. Price and availability may change; confirm with the seller. ${escape(credit)}</p></footer>
</main></body></html>
`);

  await fs.mkdir('marketing', { recursive: true });
  const facts = `${price} | ${listing.bedrooms} bedrooms | ${listing.bathrooms} bathrooms | ${listing.squareFeet.toLocaleString('en-US')} sq ft | Built ${listing.yearBuilt}`;
  const posts = [
    ['Facebook / Nextdoor', 'facebook', `For sale in Green Lake, Seattle: ${listing.address}\n\n${facts}\n\nOriginal fir and oak floors, an updated main kitchen with granite counters, two composite decks, a backyard and a detached garage. This duplex / multi-family property has separate entrances. Figures describe the whole property.\n\nExplore 117 photos and a video walkthrough, then contact the seller to arrange a showing.\n\n${credit}`],
    ['Instagram', 'instagram', `A closer look at ${listing.address} in Green Lake, Seattle.\n\n${facts}\n\n1925 character, wood floors, granite kitchen counters, two decks and a backyard. Duplex / multi-family property; whole-property figures.\n\nExplore the photo gallery and video tour at 7741greenlake.netlify.app. Contact the seller through the website for a showing.\n\n${credit}\n\n#GreenLake #SeattleRealEstate #SeattleHomesForSale`],
    ['LinkedIn', 'linkedin', `For sale: ${listing.address}, Seattle’s Green Lake neighborhood.\n\n${facts}\n\nThis duplex / multi-family property combines original details with an updated main kitchen, separate entrances, two composite decks and a detached garage. Bedroom, bathroom and square-footage figures describe the whole property.\n\nThe property website has 117 photos, a video tour and direct seller contact for showing requests. Share with anyone exploring homes in Green Lake.\n\n${credit}`],
    ['Pinterest', 'pinterest', `Green Lake Seattle home for sale | ${listing.address}\n\nTour this 1925 duplex / multi-family property: wood floors, an updated main kitchen, two decks and a backyard. ${facts}. Whole-property figures. View the photos, video tour and showing information. ${credit}`],
    ['Craigslist housing-for-sale draft', 'craigslist', `${price} / ${listing.bedrooms}br — Green Lake duplex / multi-family property — ${listing.squareFeet.toLocaleString('en-US')} sq ft\n\n${listing.address}, Seattle, WA 98115\n\n${facts}\n\nFeatures include original wood floors, granite kitchen counters, two composite decks, a backyard and garden, separate entrances and a detached garage. All measurements and room counts describe the whole property.\n\nSee the full photo gallery and video tour at the link below. Contact the seller through the website for property questions or a showing.\n\n${credit}`],
    ['YouTube title and description', 'youtube', `${listing.address}, Seattle | Green Lake Home Tour | ${price}\n\nExplore this duplex / multi-family property in Seattle’s Green Lake neighborhood. ${facts}. Whole-property figures.\n\nSee all 117 photos and contact the seller to schedule a showing using the property website below.\n\n${credit}`],
    ['Short post', 'short_post', `For sale in Green Lake, Seattle: ${listing.address}. ${price} · ${listing.bedrooms} beds · ${listing.bathrooms} baths · ${listing.squareFeet.toLocaleString('en-US')} sq ft (whole property). Explore the photos, video tour and showing details:`],
  ];
  await fs.writeFile('marketing/draft-posts.md', `# 7741 Green Lake — publishing copy\n\nPrepared from the current listing configuration (${listing.sourceChecked}). **Drafts, not published posts.** Confirm the price and availability before future reuse.\n\n${posts.map(([channel, source, body]) => `## ${channel}\n\n${body}\n\n${campaign(source)}\n`).join('\n')}\n## Email to an existing contact\n\nSubject: Green Lake home for sale — ${listing.address}\n\nSharing a home for sale in Seattle’s Green Lake neighborhood. ${facts}. This is a duplex / multi-family property; figures describe the whole property. The website includes room-by-room photos, a video walkthrough and direct seller contact for showings.\n\n${campaign('personal_email', 'email')}\n\n${credit}\n\n## Original media\n\nUse the supplied property media unchanged. No generated interiors or unlabelled virtual staging.\n\n- Exterior: ${url}assets/photos/twilight-1-1600.webp\n- Living room: ${url}assets/photos/acre-015-1600.webp\n- Deck: ${url}assets/photos/acre-018-1600.webp\n- Full tour: ${url}assets/video/tour-1080.mp4\n- Printable summary: ${url}property-summary.html\n\n## Publication notes\n\n- Publish from the seller’s authorized accounts and only in channels that accept property listings. Platform category, account and fee requirements must be checked at publication.\n- The Facebook caption can also be used on Nextdoor; replace utm_source=facebook with utm_source=nextdoor. Instagram captions do not make URLs clickable; use the campaign URL in the profile or a supported link sticker.\n- No rental income, permitted-unit count, development entitlement, open-house date or investment return is asserted.\n- The campaign parameters label referral sources. They do not collect analytics or prove clicks, impressions or leads.\n- No campaign has a paid budget, scheduled publication or automatic repeat posting.\n`);
  console.log('Prepared listing metadata, sitemap, sharing summary and campaign drafts.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await preparePromotion();
