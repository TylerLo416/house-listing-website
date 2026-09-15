import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(await fs.readFile(new URL('../assets/photos.json', import.meta.url), 'utf8'));
let run = 0;

async function setup({ connection = {}, reducedMotion = false, savedPreferences = {} } = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  for (const [key, value] of Object.entries(savedPreferences)) window.sessionStorage.setItem(key, value);
  const network = Object.assign(new window.EventTarget(), connection);
  Object.defineProperty(window.navigator, 'connection', { value: network });
  const mediaPreference = Object.assign(new window.EventTarget(), { matches: reducedMotion });
  const timerCallbacks = new Map();
  let timerId = 0;
  const overwritten = new Map();
  const mocks = {
    window, document: window.document, navigator: window.navigator,
    sessionStorage: window.sessionStorage, matchMedia: () => mediaPreference,
    fetch: async () => ({ ok: true, json: async () => structuredClone(manifest) }),
    setTimeout: callback => { timerCallbacks.set(++timerId, callback); return timerId; },
    clearTimeout: id => timerCallbacks.delete(id),
  };
  for (const [key, value] of Object.entries(mocks)) {
    overwritten.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  const video = window.document.querySelector('video');
  let paused = true;
  Object.defineProperty(video, 'paused', { get: () => paused });
  Object.defineProperty(video, 'duration', { get: () => 83 });
  video.load = () => {};
  video.play = () => { paused = false; return Promise.resolve(); };
  video.pause = () => { paused = true; };
  await import(`../app.js?test=${++run}`);
  // Flush gallery-fetch promises without sleeping or running watchdog timers.
  await new Promise(resolve => setImmediate(resolve));
  const change = (selector, value) => {
    const input = window.document.querySelector(selector);
    if (input.type === 'checkbox') input.checked = value; else input.value = value;
    input.dispatchEvent(new window.Event('change'));
  };
  return {
    document: window.document, video, change, window, network,
    fire: name => video.dispatchEvent(new window.Event(name)),
    stall: () => { const last = [...timerCallbacks.entries()].at(-1); assert.ok(last, 'A stall watchdog is armed'); timerCallbacks.delete(last[0]); last[1](); },
    close: () => {
      dom.window.close();
      for (const [key, descriptor] of overwritten) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
      }
    },
  };
}

test('gallery filters, keyboard tabs, pagination, modal navigation and staging labels work', async () => {
  const app = await setup({ reducedMotion: true });
  try {
    const $ = selector => app.document.querySelector(selector);
    assert.equal($('#gallery-grid').children.length, 12);
    assert.equal(app.video.hasAttribute('src'), false, 'Reduced motion avoids autoplay downloads');
    $('#show-more').click();
    assert.equal($('#gallery-grid').children.length, 24);
    $('#tab-outdoor').click();
    assert.match($('#gallery-count').textContent, /Decks & outdoors/);
    assert.equal($('#tab-outdoor').getAttribute('aria-selected'), 'true');
    assert.equal($('#gallery-panel').getAttribute('aria-labelledby'), 'tab-outdoor');
    $('#tab-outdoor').dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal($('#tab-studio').getAttribute('aria-selected'), 'true');
    $('#tab-staged').click();
    assert.equal($('#gallery-grid').children.length, 5);
    assert.equal(app.document.querySelectorAll('.staged-label').length, 5);
    $('#gallery-grid button').click();
    assert.equal($('#lightbox').open, true);
    assert.match($('#lightbox-note').textContent, /Virtually staged/);
    const first = $('#lightbox-image').src;
    $('#next-photo').click();
    assert.notEqual($('#lightbox-image').src, first);
    app.change('#low-data', true);
    assert.match($('#lightbox-image').src, /-400.webp$/);
    assert.equal($('#gallery-grid img').hasAttribute('srcset'), false);
    $('#close-lightbox').click();
    assert.equal($('#lightbox').open, false);
    assert.equal(app.document.activeElement, $('#gallery-grid button'));
  } finally { app.close(); }
});

test('Save-Data loads only small photos until the visitor explicitly starts a video', async () => {
  const app = await setup({ connection: { saveData: true } });
  try {
    assert.equal(app.video.hasAttribute('src'), false);
    assert.equal(app.document.querySelector('#hero-photo').hasAttribute('srcset'), false);
    assert.equal(app.document.querySelector('#low-data').checked, true);
    app.document.querySelector('#play-tour').click();
    assert.match(app.video.src, /tour-540.mp4$/);
    app.fire('loadedmetadata');
    app.fire('playing');
    app.video.currentTime = 29;
    app.change('#media-quality', '720');
    app.fire('loadedmetadata');
    assert.match(app.video.src, /tour-720.mp4$/);
    assert.equal(app.video.currentTime, 29, 'Quality changes preserve the tour position');
    app.change('#media-quality', 'photos');
    assert.equal(app.video.hasAttribute('src'), false, 'Photo mode aborts the video download');
    assert.equal(app.video.hidden, true);
  } finally { app.close(); }
});

test('unknown bandwidth starts at 1080p and sustained buffering falls back through 720p, 540p and photos', async () => {
  const app = await setup();
  try {
    assert.match(app.video.src, /tour-1080.mp4$/);
    app.stall();
    assert.match(app.video.src, /tour-720.mp4$/);
    assert.equal(app.document.querySelector('#low-data').checked, false, 'Video buffering must not lower photo quality');
    assert.ok(app.document.querySelector('#gallery-grid img').hasAttribute('srcset'));
    app.stall();
    assert.match(app.video.src, /tour-540.mp4$/);
    assert.ok(app.document.querySelector('#hero-photo').hasAttribute('srcset'));
    app.stall();
    assert.equal(app.video.hasAttribute('src'), false);
    assert.match(app.document.querySelector('#media-status').textContent, /Slow connection/);
    app.document.querySelector('#gallery-grid button').click();
    assert.match(app.document.querySelector('#lightbox-image').src, /-1600.webp$/);
  } finally { app.close(); }
});

test('slow network estimates keep photos sharp while reducing or disabling video', async () => {
  for (const connection of [{ effectiveType: '3g', downlink: 1.5 }, { effectiveType: '2g', downlink: 0.2 }]) {
    const app = await setup({ connection });
    try {
      const $ = selector => app.document.querySelector(selector);
      assert.equal($('#low-data').checked, false);
      assert.ok($('#hero-photo').hasAttribute('srcset'));
      assert.ok($('#gallery-grid img').hasAttribute('srcset'));
      $('#gallery-grid button').click();
      assert.match($('#lightbox-image').src, /-1600.webp$/);
      app.network.downlink = 0.1;
      app.network.dispatchEvent(new app.window.Event('change'));
      assert.equal($('#low-data').checked, false);
      assert.match($('#lightbox-image').src, /-1600.webp$/);
    } finally { app.close(); }
  }
});

test('Photos only preserves full photo quality on selection and after reload', async () => {
  for (const savedPreferences of [{}, { 'tour-quality': 'photos' }]) {
    const app = await setup({ savedPreferences });
    try {
      const $ = selector => app.document.querySelector(selector);
      assert.equal($('#low-data').checked, false);
      app.change('#media-quality', 'photos');
      assert.equal(app.video.hasAttribute('src'), false);
      assert.equal($('#low-data').checked, false);
      $('#gallery-grid button').click();
      assert.match($('#lightbox-image').src, /-1600.webp$/);
    } finally { app.close(); }
  }
});

test('an explicit full-quality photo preference survives video stalls and network changes', async () => {
  const app = await setup({ connection: { saveData: true }, savedPreferences: { 'lighter-photos': 'false' } });
  try {
    const $ = selector => app.document.querySelector(selector);
    app.network.saveData = false;
    app.change('#media-quality', 'auto');
    app.stall();
    app.network.saveData = true;
    app.network.dispatchEvent(new app.window.Event('change'));
    assert.equal($('#low-data').checked, false);
    assert.ok($('#gallery-grid img').hasAttribute('srcset'));
    $('#gallery-grid button').click();
    assert.match($('#lightbox-image').src, /-1600.webp$/);
    app.change('#low-data', true);
    assert.match($('#lightbox-image').src, /-400.webp$/);
    assert.equal($('#gallery-grid img').hasAttribute('srcset'), false);
  } finally { app.close(); }
});

test('a connection change respects manually selected quality and switches Auto to photos on Save-Data', async () => {
  const app = await setup();
  try {
    app.fire('loadedmetadata');
    app.fire('playing');
    app.change('#media-quality', '1080');
    app.network.saveData = true;
    app.network.dispatchEvent(new app.window.Event('change'));
    assert.match(app.video.src, /tour-1080.mp4$/);
    app.change('#media-quality', 'auto');
    assert.equal(app.video.hasAttribute('src'), false);
  } finally { app.close(); }
});
