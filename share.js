import { listing } from './listing-config.js';

export function campaignUrl(source, medium = 'referral') {
  const url = new URL(listing.siteUrl);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', 'greenlake_listing');
  return url.href;
}

const shareButton = document.querySelector('#share-home');
const copyButton = document.querySelector('#copy-home');
const emailLink = document.querySelector('#email-home');
const status = document.querySelector('#share-status');
const fallback = document.querySelector('#share-link-fallback');
const summary = `${listing.address}, Seattle · ${listing.bedrooms} bedrooms · ${listing.bathrooms} bathrooms · ${listing.squareFeet.toLocaleString('en-US')} sq ft. Photos, video tour and showing information.`;

if (emailLink) emailLink.href = `mailto:?subject=${encodeURIComponent(listing.title)}&body=${encodeURIComponent(`${summary}\n\n${campaignUrl('email', 'email')}`)}`;

if (copyButton) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    const url = campaignUrl('shared_link');
    try {
      await navigator.clipboard.writeText(url);
      fallback.hidden = true;
      status.textContent = 'Link copied. Share it in a message or post.';
    } catch {
      fallback.value = url;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = 'Select and copy the link below.';
    }
  });
}

if (shareButton && typeof navigator.share === 'function') {
  shareButton.hidden = false;
  shareButton.addEventListener('click', async () => {
    try {
      await navigator.share({ title: listing.title, text: summary, url: campaignUrl('native_share') });
      status.textContent = 'Sharing window closed.';
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'Use Copy link or Email this home to share.';
    }
  });
}
