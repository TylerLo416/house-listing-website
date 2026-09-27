# Cloudflare hosting and 7741greenlake.com

The site is hosted entirely on Cloudflare: Workers serves the website and photos; an R2 binding streams the three video qualities from the existing `property-videos` bucket. Netlify is not part of this deployment.

## Current status — September 18, 2026

- Live Cloudflare address: **https://7741greenlake.photy.workers.dev**.
- The updated page, photos, phone contact, printable summary, and all three video qualities have been verified over HTTPS. Video seeking, HEAD requests and conditional caching work.
- The source uses **https://7741greenlake.com/** for canonical links, sharing, structured data, the sitemap and campaign drafts. The custom domain is not connected yet.
- The domain still uses Namecheap's `dns1.registrar-servers.com` and `dns2.registrar-servers.com` nameservers. The Cloudflare token cannot see the zone, and creating it was rejected for missing `com.cloudflare.api.account.zone.create` permission.
- The previous Netlify deployment has not been deleted. Its deployment configuration has been removed from this repository.
- GitHub automatic deployment has not been connected. The current Cloudflare deployment was published from this working copy.

## Connect the domain

1. In the **same Cloudflare account as the `7741greenlake` Worker**, add **7741greenlake.com** as a domain and select the Free plan. Review the imported DNS records and preserve any records used for email or other services. Cloudflare will assign two nameservers. [Cloudflare domain setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)

2. In Namecheap, open **Domain List → Manage → Nameservers → Custom DNS** for **7741greenlake.com**. Enter the exact two nameservers Cloudflare assigned and save. Wait for Cloudflare to mark the domain **Active**. [Namecheap instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/)

3. In Cloudflare, open **Workers & Pages → 7741greenlake → Settings → Domains & Routes → Add → Custom Domain**. Add **7741greenlake.com** and then **www.7741greenlake.com**. Cloudflare creates the DNS records and manages HTTPS. Replace conflicting parking records at these two names if Cloudflare requests it; preserve unrelated DNS records. [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

4. Verify both domain names over HTTPS, including the photos, video and owner contact. The canonical domain is **7741greenlake.com**. A Cloudflare redirect rule can send `www` to the canonical host while preserving the path and query string.

5. After the custom domain works, set `"workers_dev": false` in `wrangler.json`, leaving `route` and `routes` absent when managing domains through the dashboard. This is Cloudflare's documented setup for preserving dashboard-managed routes on future deployments. Deploy again to retire the temporary `workers.dev` address. Alternatively, put both domains in `routes` using `custom_domain: true` and manage them through Wrangler with a token authorized for the zone. [Wrangler configuration ownership](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)

6. Only after the custom domain serves the listing should you run `npm run submit:indexnow` or start using the new address in campaign posts. The earlier Netlify project can then be retired in its dashboard.

The current local token can publish the Worker and access R2, but it cannot add the DNS zone. Cloudflare credentials also cannot change Namecheap nameservers. The dashboard steps above complete those account-specific requirements.

## Publish updates from this repository

Use Node.js 22 or newer. `.env.example` lists the four required credential names; keep actual values in your existing local `.env`.

```sh
npm install
npm test
npm run deploy
```

On Windows PowerShell, use `npm.cmd` if script execution is restricted.

`npm run deploy` builds `dist-cloudflare/`, uploads missing video versions to R2, then publishes the `7741greenlake` Worker with Wrangler. Unchanged videos are skipped. Video object names include a content hash so changing a video does not break an older deployment. Uploads use only the `7741greenlake/` prefix; other bucket objects are untouched.

The 1080p file is about 39.5 MiB, above Workers' 25 MiB static asset limit. Keeping videos in R2 preserves all quality options. The bucket does not need public access: the Worker exposes only the three listed tour paths. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

`npm run build` still creates a self-contained `dist/` for local preview. Cloudflare uses `npm run build:cloudflare` and `dist-cloudflare/`, which excludes video files. Both builds copy an explicit public file list and prepared assets. `.env`, source documents, marketing files and credentials are excluded.

## Connect GitHub for automatic updates

After these repository changes are committed and pushed, open **Workers & Pages → 7741greenlake → Settings → Builds → Connect** and connect **TylerLo416/house-listing-website**, branch **main**. Use:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `npm run build:cloudflare` |
| Deploy command | `node scripts/deploy-cloudflare.mjs` |
| Worker name | `7741greenlake` |

Use the build API token Cloudflare generates, and supply `CLOUDFLARE_ACCOUNT_ID` if it is not already provided. Add `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` as secret **build variables**, scoped to the video bucket. These are deployment credentials, not Worker runtime bindings. Account-owned API tokens are currently unsupported by Workers Builds; the local account token works for the manual deployment command. [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/), [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

The only deployed runtime bindings are `ASSETS` and `VIDEOS`. `.env` and `.dev.vars*` are ignored by Git; the deployment wrapper disables importing `.env` values as Worker bindings.
