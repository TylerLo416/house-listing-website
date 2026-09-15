# 7741 Green Lake — home for sale

[**View the home, photos and video tour**](https://7741greenlake.netlify.app/)

7741 1st Avenue NE, Seattle, WA 98115. Green Lake duplex / multi-family property, offered at **$1,079,000**. Whole-property figures: **4 bedrooms · 3 bathrooms · 2,160 sq ft**. [Contact the seller for a showing](https://7741greenlake.netlify.app/#contact).

A responsive, self-hosted website using plain HTML, CSS and JavaScript. There is no framework, hosted service, database or runtime dependency to deploy.

## Promotion and search discovery

- `npm run build` refreshes the canonical URL, search description, Open Graph/X text, structured listing data, robots.txt, an image sitemap, a printable property summary and campaign copy from `listing-config.js`.
- [Campaign drafts](marketing/draft-posts.md) include Facebook/Nextdoor, Instagram, LinkedIn, Pinterest, Craigslist, YouTube, short-post and email copy. These files are not copied to the public website and are not published to social accounts by the build.
- Visitors can use native sharing, copy a link, email the home or open the [printable summary](https://7741greenlake.netlify.app/property-summary.html).
- Shared URLs include campaign source labels. No analytics service or advertising pixel is installed, so these parameters alone do not report traffic or leads.
- `netlify.toml` publishes only `dist/`. Keep that publish directory to exclude source documents and broker-only information.
- After a successful production deployment, `npm run submit:indexnow` verifies the live ownership file and updated page, then notifies IndexNow once. It saves the actual response to `marketing/indexnow-receipt.json`. A received submission does not guarantee crawling or indexing. See [IndexNow documentation](https://www.indexnow.org/documentation).
- Google discovers the sitemap through robots.txt. A direct Google indexing request requires a verified Search Console account; a sitemap is not proof of Google indexing. See [Google’s crawl-request guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
- Update the price and sale status before reusing campaign copy. Rebuild and redeploy changes; notify IndexNow after significant updates rather than repeatedly submitting an unchanged page.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:4173**. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is restricted. Use an HTTP server; opening `index.html` with `file://` prevents the gallery JSON and JavaScript modules from loading in many browsers.

## Deploy on your hosting

```sh
npm run build
```

Upload **the contents of `dist/`** to your website's public directory. The generated files are already present. They work at a domain root or in a subdirectory. No Node.js process is needed on the production host.

The host should serve `.webp` as `image/webp`, `.mp4` as `video/mp4`, and `.js` as JavaScript. Enable HTTP byte-range requests for video playback and seeking (standard on most static servers). The local preview server implements byte ranges as well. The site is approximately 105 MB, including every video quality and all photo sizes; a visitor only downloads the selected media and lazily loaded photos.

Do not upload the repository root or `basefiles/`: the original MLS PDF includes broker-only and owner information. The build copies only the public website and prepared assets.

## Asking price and listing facts

The website presents the full property for sale at **$1,079,000**, with purchase inquiries and showing requests sent directly to the seller. The property is listed as a duplex / multi-family home, MLS #2581382.

To update the asking price, edit `listing-config.js`:

```js
askingPrice: 1079000,
```

The build updates the static asking price in `index.html`, metadata and promotional copy so they agree before JavaScript loads. `scopeNote` contains the property type and MLS number. Contact links and other page copy are in `index.html`; styles are in `styles.css`. Re-run `npm run build` after changes.

Sources checked September 15, 2026:

- [Zillow property listing](https://www.zillow.com/homedetails/7741-1st-Ave-NE-Seattle-WA-98115/49008472_zpid/) and the supplied MLS PDF report a **$1,079,000 asking price**, 4 bedrooms, 3 bathrooms, 2,160 square feet and a 1925 construction date.
- The page uses the whole-property area of 2,160 square feet from the listing. The MLS unit areas sum to a different figure, so individual unit measurements are not displayed.
- The email and phone number come directly from `basefiles/contactinfo`.

## Video and photo behavior

- **Auto:** 1080p on a good or unknown connection; 720p below 5 Mbps; 540p below 2 Mbps or on an effective 3G connection.
- **Photos first:** Save-Data, 2G, or bandwidth below 0.8 Mbps prevents the initial video request and uses small WebP photos. Pressing Play explicitly starts the 540p tour.
- **Buffering fallback:** In Auto, sustained loading/buffering steps down from 1080p → 720p → 540p → photos, including on browsers that do not expose network estimates.
- **Manual controls:** Auto, 1080p, 720p, 540p, or Photos only. Changing quality preserves playback position. Native video controls provide pause, seek, volume and fullscreen. Photos only aborts the video request.
- **Motion and autoplay:** The tour starts muted and inline when allowed. Reduced-motion preference suppresses autoplay. If autoplay is blocked, a play button is shown. Scrolling the tour offscreen or hiding the tab pauses it.
- **Images:** All 117 supplied photographs are converted to 400px, 800px and 1600px WebP. Responsive images, lazy loading and a manual “Lighter photos” switch limit downloads. Five virtual staging images are labeled in cards and the viewer.
- **Gallery:** Room categories, load-more pagination, a full-screen viewer, arrow-key navigation, touch swipes and focus restoration. Preferences persist only in the current browser tab's session.

Connection quality is an estimate, not direct Wi-Fi signal measurement. Some browsers do not expose it; the buffering fallback and manual controls cover that case. See [MDN's Network Information documentation](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation).

## Regenerate media

Prepared files are included under `assets/`. To recreate them from `basefiles/`, install dependencies and make FFmpeg available on your PATH:

```sh
npm run media
```

Photo-only rebuild:

```sh
node scripts/prepare-media.mjs --photos-only
```

The script keeps up-to-date WebP files and completed video encodes. To re-encode a video after replacing its original, remove only the corresponding `assets/video/tour-QUALITY.mp4` first. All video outputs use H.264/AAC with the MP4 metadata moved to the beginning for progressive streaming.

`scripts/inspect-assets.mjs` extracts the source PDF and creates photo contact sheets in ignored `tmp/`; `scripts/render-listing.mjs` renders the relevant MLS pages. These are local inspection utilities, excluded from deployment.

## Validation

```sh
npm test
npm run build
```

Tests cover connection policies, sustained-buffering fallback, photo categories and generated WebP files, gallery filters and pagination, lightbox interaction and staging labels, reduced-motion/Save-Data behavior, manual quality selection, playback-position preservation, file serving and MP4 byte-range responses. DOM tests simulate media events; they do not replace testing real video playback in your target browsers. A connected browser was unavailable for visual preview during implementation.
