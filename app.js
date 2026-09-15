import { chooseMediaPolicy, nextLowerQuality, categories, filterPhotos, photoSource } from './media-policy.js';
import { listing } from './listing-config.js';

const $ = selector => document.querySelector(selector);
const storage = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* Private browsing may disable storage. */ } },
};

if (Number.isFinite(listing.askingPrice) && listing.askingPrice > 0) {
  $('#asking-price').firstChild.textContent = `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(listing.askingPrice)} `;
}
$('#property-scope').textContent = listing.scopeNote;

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const policy = () => chooseMediaPolicy(connection, motionPreference.matches);
const video = $('#tour-video');
const qualitySelect = $('#media-quality');
const caption = $('#tour-caption');
const heroPhoto = $('#hero-photo');
const mediaStatus = $('#media-status');
const savedQuality = storage.get('tour-quality');
let preference = ['auto', '1080', '720', '540', 'photos'].includes(savedQuality) ? savedQuality : 'auto';
let currentQuality = null;
let sourceVersion = 0;
let resumeAt = 0;
let wantsPlayback = false;
let stallTimer;
let loading = false;
let photos = [];
let category = 'all';
let shown = 12;
let selectedPhoto = 0;
let lastPhotoButton = null;
const lightbox = $('#lightbox');
qualitySelect.value = preference;

function setImageQuality(image, photo, large = false) {
  image.sizes = large ? '(max-width: 800px) 100vw, 65vw' : '(max-width: 800px) 46vw, 30vw';
  image.srcset = [400, 800, 1600].map(width => `${photoSource(photo, width)} ${width}w`).join(', ');
  image.src = photoSource(photo, large ? 1600 : 800);
}

setImageQuality(heroPhoto, { id: 'twilight-1' }, true);
document.querySelectorAll('img[data-photo]').forEach(image => setImageQuality(image, { id: image.dataset.photo }, true));

function clearStallWatch() {
  clearTimeout(stallTimer);
  stallTimer = null;
}

function usePhotos(message = 'Photo mode · Browse at your pace') {
  clearStallWatch();
  sourceVersion++;
  if (Number.isFinite(video.currentTime) && video.currentTime > 0) resumeAt = video.currentTime;
  wantsPlayback = false;
  loading = false;
  video.pause();
  video.removeAttribute('src');
  video.load(); // Abort any in-flight video download.
  video.hidden = true;
  caption.hidden = false;
  currentQuality = 'photos';
  mediaStatus.textContent = message;
}

function watchForStall(delay = 9000) {
  if (preference !== 'auto' || !wantsPlayback || document.hidden || currentQuality === 'photos') return;
  // Repeated stalled events must not postpone a watchdog indefinitely.
  if (stallTimer) return;
  stallTimer = setTimeout(() => {
    stallTimer = null;
    if (!wantsPlayback || document.hidden || preference !== 'auto') return;
    const lower = nextLowerQuality(currentQuality);
    // A slow video download must not replace sharp photos with thumbnails.
    if (lower === 'photos') usePhotos('Slow connection · Showing photos');
    else startVideo(lower, true, `Adjusting to ${lower}p for smoother playback`);
  }, delay);
}

function startVideo(quality, play = true, message) {
  if (quality === 'photos') return usePhotos(message);
  if (currentQuality === quality && video.hasAttribute('src')) {
    video.hidden = false;
    caption.hidden = true;
    wantsPlayback = play;
    if (play) {
      video.play().catch(() => { wantsPlayback = false; mediaStatus.textContent = 'Press play to start the tour'; });
      watchForStall();
    }
    return;
  }
  const version = ++sourceVersion;
  if (Number.isFinite(video.currentTime) && video.currentTime > 0) resumeAt = video.currentTime;
  clearStallWatch();
  loading = true;
  wantsPlayback = play;
  currentQuality = quality;
  video.pause();
  video.poster = heroPhoto.currentSrc || heroPhoto.src;
  video.hidden = false;
  caption.hidden = true;
  mediaStatus.textContent = message || `Loading ${quality}p tour…`;
  video.src = `assets/video/tour-${quality}.mp4`;
  video.preload = 'auto';
  video.addEventListener('loadedmetadata', () => {
    if (version !== sourceVersion) return;
    const position = Math.min(resumeAt, Math.max(0, video.duration - 0.25));
    if (position > 0 && Number.isFinite(position)) video.currentTime = position;
    loading = false;
    if (!wantsPlayback) mediaStatus.textContent = `${quality}p · Paused`;
  }, { once: true });
  video.load();
  if (play) video.play().catch(error => {
    if (version !== sourceVersion || error.name === 'AbortError') return;
    if (error.name === 'NotAllowedError') {
      wantsPlayback = false;
      clearStallWatch();
      video.hidden = true;
      caption.hidden = false;
      mediaStatus.textContent = 'Press play to start the tour';
    }
  });
  watchForStall(12000);
}

video.addEventListener('playing', () => {
  clearStallWatch();
  loading = false;
  wantsPlayback = true;
  caption.hidden = true;
  mediaStatus.textContent = `${preference === 'auto' ? 'Auto · ' : ''}${currentQuality}p home tour`;
});
video.addEventListener('play', () => { wantsPlayback = true; watchForStall(); });
video.addEventListener('waiting', () => {
  if (!video.seeking) watchForStall();
});
video.addEventListener('stalled', () => {
  if (video.readyState < 3) watchForStall();
});
video.addEventListener('pause', () => {
  if (loading || currentQuality === 'photos') return;
  wantsPlayback = false;
  clearStallWatch();
  if (!video.ended) mediaStatus.textContent = `${currentQuality}p · Paused`;
});
video.addEventListener('ended', () => {
  wantsPlayback = false;
  resumeAt = 0;
  clearStallWatch();
  mediaStatus.textContent = 'Tour complete · Explore the photos below';
});
video.addEventListener('error', () => {
  if (!video.hasAttribute('src') || currentQuality === 'photos') return;
  if (preference === 'auto') {
    const lower = nextLowerQuality(currentQuality);
    if (lower !== 'photos') return startVideo(lower, wantsPlayback);
  }
  usePhotos('Tour unavailable · Enjoy the photo gallery');
});

$('#play-tour').addEventListener('click', () => {
  let quality = preference === 'auto' ? policy().quality : preference;
  if (quality === 'photos') {
    quality = '540';
    preference = quality;
    qualitySelect.value = quality;
    storage.set('tour-quality', quality);
  }
  startVideo(quality, true);
});
qualitySelect.addEventListener('change', () => {
  preference = qualitySelect.value;
  storage.set('tour-quality', preference);
  const next = preference === 'auto' ? policy().quality : preference;
  const keepPlaying = wantsPlayback || currentQuality === 'photos' || currentQuality === null;
  startVideo(next, keepPlaying);
});
connection?.addEventListener('change', () => {
  const next = policy();
  if (preference !== 'auto') return;
  if (next.quality === 'photos') usePhotos(next.saveData ? 'Data saver · Photos first' : 'Slow connection · Showing photos');
  // A better connection takes effect on the next deliberate play. Avoid surprises.
  else if (currentQuality !== 'photos' && Number(next.quality) < Number(currentQuality)) startVideo(next.quality, wantsPlayback);
});
motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) { wantsPlayback = false; video.pause(); clearStallWatch(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { wantsPlayback = false; clearStallWatch(); video.pause(); }
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) { wantsPlayback = false; clearStallWatch(); video.pause(); }
  }, { threshold: 0 }).observe($('#tour-screen'));
}

const initialPolicy = policy();
if (preference === 'photos' || (preference === 'auto' && initialPolicy.quality === 'photos')) usePhotos(initialPolicy.saveData ? 'Data saver · Photos first' : 'Photo mode · Browse at your pace');
else if (initialPolicy.autoplay) startVideo(preference === 'auto' ? initialPolicy.quality : preference, true);
else mediaStatus.textContent = 'Home tour · Press play to explore';

function activePhotos() { return filterPhotos(photos, category); }
function categoryName(id) { return categories.find(([key]) => key === id)?.[1] || 'The home'; }

function renderTabs() {
  const tabs = $('#gallery-tabs');
  tabs.replaceChildren();
  for (const [id, label] of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `tab-${id}`;
    button.className = 'gallery-tab';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'gallery-panel');
    button.setAttribute('aria-selected', String(id === category));
    button.tabIndex = id === category ? 0 : -1;
    button.textContent = label;
    button.addEventListener('click', () => selectCategory(id));
    button.addEventListener('keydown', event => {
      const index = categories.findIndex(([key]) => key === id);
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % categories.length;
      if (event.key === 'ArrowLeft') target = (index - 1 + categories.length) % categories.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = categories.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      selectCategory(categories[target][0]);
      $(`#tab-${categories[target][0]}`).focus({ preventScroll: true });
      $(`#tab-${categories[target][0]}`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    tabs.append(button);
  }
}

function selectCategory(id) {
  category = id;
  shown = 12;
  $('#gallery-tabs').querySelectorAll('[role="tab"]').forEach(tab => {
    const selected = tab.id === `tab-${id}`;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  $('#gallery-panel').setAttribute('aria-labelledby', `tab-${id}`);
  renderGallery();
}

function renderGallery(append = false) {
  const filtered = activePhotos();
  const grid = $('#gallery-grid');
  const start = append ? grid.children.length : 0;
  if (!append) grid.replaceChildren();
  for (let index = start; index < Math.min(shown, filtered.length); index++) {
    const photo = filtered[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-card';
    button.setAttribute('aria-label', `Open photo: ${photo.alt}${photo.staged ? ' (virtually staged)' : ''}`);
    const image = document.createElement('img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = photo.width;
    image.height = photo.height;
    image.alt = photo.alt;
    image.dataset.photo = photo.id;
    setImageQuality(image, photo);
    image.addEventListener('error', () => {
      if (button.querySelector('.photo-error')) return;
      const error = document.createElement('span');
      error.className = 'photo-error';
      error.textContent = 'Photo unavailable. Open to try again.';
      button.append(error);
    });
    button.append(image);
    const label = document.createElement('span');
    label.className = 'photo-label';
    label.textContent = categoryName(photo.category);
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    label.append(arrow);
    button.append(label);
    if (photo.staged) {
      const badge = document.createElement('span');
      badge.className = 'staged-label';
      badge.textContent = 'Virtually staged';
      button.append(badge);
    }
    button.addEventListener('click', () => {
      selectedPhoto = index;
      lastPhotoButton = button;
      video.pause();
      renderLightbox();
      lightbox.showModal();
      $('#close-lightbox').focus();
    });
    grid.append(button);
  }
  const visible = Math.min(shown, filtered.length);
  $('#gallery-count').textContent = `${categoryName(category)} · ${visible} of ${filtered.length} photos`;
  $('#show-more').hidden = visible >= filtered.length;
  return start;
}

$('#show-more').addEventListener('click', () => {
  shown += 12;
  const previousCount = renderGallery(true);
  $('#gallery-grid').children[previousCount]?.focus({ preventScroll: true });
});
$('#view-outdoor').addEventListener('click', () => {
  selectCategory('outdoor');
  $('#gallery').scrollIntoView({ behavior: motionPreference.matches ? 'instant' : 'smooth' });
  $('#tab-outdoor')?.focus({ preventScroll: true });
});

function renderLightbox() {
  const filtered = activePhotos();
  const photo = filtered[selectedPhoto];
  if (!photo) return;
  const image = $('#lightbox-image');
  image.alt = photo.alt;
  image.removeAttribute('srcset');
  image.src = photoSource(photo, 1600);
  $('#lightbox-category').textContent = categoryName(photo.category);
  $('#lightbox-counter').textContent = `${selectedPhoto + 1} / ${filtered.length}`;
  $('#lightbox-caption').textContent = photo.alt;
  $('#lightbox-note').textContent = photo.staged ? 'Virtually staged · Furniture shown is illustrative.' : 'Use arrow keys or swipe to explore';
  $('#previous-photo').disabled = filtered.length < 2;
  $('#next-photo').disabled = filtered.length < 2;
}
function navigatePhoto(direction) {
  const count = activePhotos().length;
  if (!count) return;
  selectedPhoto = (selectedPhoto + direction + count) % count;
  renderLightbox();
}
$('#lightbox-image').addEventListener('error', () => { $('#lightbox-caption').textContent = 'This photo could not load. Try the next photo.'; });
$('#previous-photo').addEventListener('click', () => navigatePhoto(-1));
$('#next-photo').addEventListener('click', () => navigatePhoto(1));
$('#close-lightbox').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('close', () => lastPhotoButton?.focus({ preventScroll: true }));
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    navigatePhoto(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
let touchStart = null;
lightbox.addEventListener('touchstart', event => {
  touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
}, { passive: true });
lightbox.addEventListener('touchend', event => {
  if (!touchStart) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) navigatePhoto(dx > 0 ? -1 : 1);
  touchStart = null;
}, { passive: true });

async function loadGallery() {
  $('#retry-gallery').hidden = true;
  $('#gallery-count').textContent = 'Loading the gallery…';
  try {
    const response = await fetch('assets/photos.json');
    if (!response.ok) throw new Error('Gallery request failed');
    photos = await response.json();
    if (!Array.isArray(photos) || !photos.length) throw new Error('Gallery is empty');
    renderTabs();
    selectCategory(category);
  } catch {
    $('#gallery-count').textContent = 'The gallery could not load. Please try again.';
    $('#retry-gallery').hidden = false;
  }
}
$('#retry-gallery').addEventListener('click', loadGallery);
loadGallery();
