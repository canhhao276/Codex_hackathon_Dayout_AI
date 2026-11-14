// Google Places API (New) — real photos, star rating and up to 5 reviews for a stop.
// Runs server-side so GOOGLE_MAPS_API_KEY never ships inside the mobile app.
// Photo URLs are resolved here (skipHttpRedirect) so the app only ever sees key-less googleusercontent links.

const cache = new Map();
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.rating',
  'places.userRatingCount',
  'places.reviews',
  'places.photos',
  'places.googleMapsUri',
].join(',');

async function resolvePhoto(photo, apiKey, timeoutMs) {
  try {
    const url = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=480&skipHttpRedirect=true&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.photoUri) return null;
    return { url: body.photoUri, author: photo.authorAttributions?.[0]?.displayName || '' };
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<null | {place_name, rating, rating_count, maps_url, photos, reviews}>}
 *          null when Google has no matching place. Throws on HTTP/auth errors.
 */
export async function fetchGooglePlace({ name, address, lat, lng }, apiKey, { timeoutMs = 6000 } = {}) {
  if (!apiKey) return null;
  const la = Number(lat);
  const ln = Number(lng);
  const cacheKey = `${name}|${la.toFixed(4)}|${ln.toFixed(4)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const body = {
    textQuery: [name, address || 'Hà Nội'].filter(Boolean).join(', '),
    languageCode: 'vi',
    maxResultCount: 1,
    ...(Number.isFinite(la) && Number.isFinite(ln)
      ? { locationBias: { circle: { center: { latitude: la, longitude: ln }, radius: 800 } } }
      : {}),
  };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`Google Places ${res.status}: ${detail}`);
  }
  const place = (await res.json())?.places?.[0];
  if (!place) {
    cache.set(cacheKey, null);
    return null;
  }
  const photos = (
    await Promise.all((place.photos || []).slice(0, 6).map((p) => resolvePhoto(p, apiKey, timeoutMs)))
  ).filter(Boolean);
  const result = {
    place_name: place.displayName?.text || name,
    rating: typeof place.rating === 'number' ? place.rating : null,
    rating_count: Number(place.userRatingCount) || 0,
    maps_url: place.googleMapsUri || null,
    photos,
    reviews: (place.reviews || []).slice(0, 5).map((rv) => ({
      author: rv.authorAttribution?.displayName || 'Người dùng Google',
      author_photo: rv.authorAttribution?.photoUri || null,
      rating: Number(rv.rating) || 0,
      text: rv.text?.text || rv.originalText?.text || '',
      time: rv.relativePublishTimeDescription || '',
    })),
  };
  cache.set(cacheKey, result);
  return result;
}
