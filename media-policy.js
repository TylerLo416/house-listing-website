// Connection estimates describe bandwidth, not whether a device uses Wi-Fi.
// Unsupported browsers start at 1080p, then react to sustained buffering.
export function chooseMediaPolicy(connection = {}, reducedMotion = false) {
  const { saveData = false, effectiveType, downlink } = connection ?? {};
  const knownSpeed = Number.isFinite(downlink) && downlink >= 0;
  const verySlow = ['slow-2g', '2g'].includes(effectiveType) || (knownSpeed && downlink < 0.8);
  const slow = effectiveType === '3g' || (knownSpeed && downlink < 2);
  const moderate = knownSpeed && downlink < 5;
  return {
    quality: saveData || verySlow ? 'photos' : slow ? '540' : moderate ? '720' : '1080',
    // Bandwidth estimates guide video playback, not still-photo resolution.
    // Only an explicit browser data-saving preference enables lighter photos.
    lowData: saveData,
    autoplay: !saveData && !verySlow && !reducedMotion,
  };
}

export function nextLowerQuality(quality) {
  return ({ '1080': '720', '720': '540', '540': 'photos' })[quality] ?? 'photos';
}

export const categories = [
  ['all', 'All photos'], ['living', 'Living & entry'], ['kitchen', 'Kitchens & dining'],
  ['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['outdoor', 'Decks & outdoors'],
  ['studio', 'Lower level'], ['exterior', 'Exterior'], ['utility', 'Garage & laundry'],
  ['neighborhood', 'Neighborhood'], ['staged', 'Virtual staging'],
];

export function filterPhotos(photos, category) {
  return photos.filter(photo => category === 'all' || (category === 'staged' ? photo.staged : photo.category === category));
}

export function photoSource(photo, width = 800) {
  if (!/^[a-z]+-\d+$/.test(photo.id) || ![400, 800, 1600].includes(width)) throw new Error('Invalid photo path');
  return `assets/photos/${photo.id}-${width}.webp`;
}
