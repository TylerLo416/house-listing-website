# Promotion results — September 15, 2026

## Live

[7741 Green Lake listing](https://7741greenlake.netlify.app/)

- Published the updated listing through the repository’s existing GitHub-to-Netlify connection. Source change: `799a385`.
- Added an address-specific title and search description, canonical URL, Open Graph/X text, and structured property/offer data with the current $1,079,000 asking price.
- Published [robots.txt](https://7741greenlake.netlify.app/robots.txt) and an [image sitemap](https://7741greenlake.netlify.app/sitemap.xml).
- Added native sharing where supported, a copy-link control with a manual fallback, email sharing, and a [printable property summary](https://7741greenlake.netlify.app/property-summary.html).
- Added the live listing link and property facts to the repository README.
- Submitted the canonical listing URL to IndexNow at **2026-09-15 06:06:43 UTC**. Response: **HTTP 202 — URL received; ownership validation pending**. See [the saved receipt](indexnow-receipt.json). This is not confirmation of crawling, indexing or search ranking. [IndexNow response definitions](https://www.indexnow.org/documentation).

## Prepared for publication

[Channel-specific drafts and campaign links](draft-posts.md): Facebook/Nextdoor, Instagram, LinkedIn, Pinterest, Craigslist, YouTube, a short post and an email. Original photo and video links accompany the copy. These are drafts; none has been posted to a social platform or classified-ad service.

## Verification

- All 9 existing tests passed.
- Checked the canonical URL and structured data; copy-link success and fallback; email campaign link; XML sitemap; expected public file types; and exclusion of source documents from the website.
- Live checks returned HTTP 200 for the page, sharing script, listing configuration, sitemap, robots.txt, summary and exterior photograph. Video byte-range requests returned HTTP 206. See [live verification](live-verification.json).
- No interactive browser was connected, so browser visual inspection was unavailable.

## Access and outcomes

- Advertising spend: **$0**. No paid campaign, recurring job or publication schedule was created.
- Social publishing: no connected account or browser session. Metricool was discovered and suggested as a publishing integration, but its connection was not confirmed. Installing and connecting it with the seller’s authorized social accounts would enable the next publishing step.
- Google Search Console: no verified account was available. The sitemap is discoverable through robots.txt; no direct Google indexing request was made. [Google’s requirements](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
- The signed-in Netlify CLI account could read public site information but could not deploy this site. Publishing succeeded through the existing repository connection instead.
- No impressions, visitors, leads or conversions have been measured. Campaign URL parameters identify a source if a future analytics tool records them; parameters alone do not collect traffic data.

## Future changes

Update `listing-config.js`, refresh any other affected visible copy, run `npm run build`, publish, then run `npm run submit:indexnow` after a significant listing update. Do not resubmit the unchanged URL repeatedly. Reconfirm price and availability before reusing any draft. On sale or withdrawal, update the website and published advertisements promptly.
