export const DEFAULT_ORIGIN = {
  lat: 21.0012,
  lng: 105.8035,
  label: '79 Nguyễn Như Kon Tum, Thanh Xuân, Hà Nội',
};

const VALID_REASONS = new Set([
  'rainy_weather',
  'crowded',
  'tighter_budget',
  'lower_calories',
]);

/**
 * Calculate great-circle distance between two coordinates in kilometers.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toFiniteNumber(val, fallback) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Normalize incoming mobile generate request to match Section 7 contract.
 */
export function normalizeGenerateRequest(body = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const rawOrigin = src.origin && typeof src.origin === 'object' ? src.origin : {};

  const lat = toFiniteNumber(rawOrigin.lat, DEFAULT_ORIGIN.lat);
  const lng = toFiniteNumber(rawOrigin.lng, DEFAULT_ORIGIN.lng);
  const label =
    typeof rawOrigin.label === 'string' && rawOrigin.label.trim()
      ? rawOrigin.label.trim()
      : DEFAULT_ORIGIN.label;

  const budgetRaw = toFiniteNumber(src.budget_vnd, 350000);
  const budget_vnd = Math.max(50000, Math.round(budgetRaw));
  const people_count = Math.max(1, Math.min(20, Math.round(toFiniteNumber(src.people_count, 2))));

  const vibes =
    Array.isArray(src.vibes) && src.vibes.length > 0
      ? src.vibes.map((v) => String(v).trim()).filter(Boolean)
      : ['chill_cafe', 'interactive_activity', 'local_food'];

  const nutrition_goal =
    typeof src.nutrition_goal === 'string' && src.nutrition_goal.trim()
      ? src.nutrition_goal.trim()
      : 'balanced';

  const rawWindow = src.time_window && typeof src.time_window === 'object' ? src.time_window : {};
  const time_window = {
    start: typeof rawWindow.start === 'string' && rawWindow.start.trim() ? rawWindow.start.trim() : '14:00',
    end: typeof rawWindow.end === 'string' && rawWindow.end.trim() ? rawWindow.end.trim() : '21:00',
  };

  const promptNoteRaw = src.prompt_note ?? src.PromptNote ?? '';
  const prompt_note = typeof promptNoteRaw === 'string' ? promptNoteRaw.trim() : '';

  return {
    origin: { lat, lng, label },
    budget_vnd,
    people_count,
    vibes,
    nutrition_goal,
    time_window,
    prompt_note,
  };
}

/**
 * Normalize incoming mobile replan request to match Section 7.2 contract.
 */
export function normalizeReplanRequest(body = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const current_itinerary =
    src.current_itinerary && typeof src.current_itinerary === 'object'
      ? src.current_itinerary
      : null;

  const itinerary_id =
    typeof src.itinerary_id === 'string' && src.itinerary_id.trim()
      ? src.itinerary_id.trim()
      : typeof current_itinerary?.itinerary_id === 'string'
        ? current_itinerary.itinerary_id.trim()
        : undefined;

  const target_stop_order = Math.max(
    1,
    Math.round(toFiniteNumber(src.target_stop_order, 2)),
  );

  const reasonRaw = typeof src.reason === 'string' ? src.reason.trim() : 'rainy_weather';
  const reason = VALID_REASONS.has(reasonRaw) ? reasonRaw : reasonRaw || 'rainy_weather';

  const new_budget_vnd =
    src.new_budget_vnd !== undefined && src.new_budget_vnd !== null
      ? Math.max(50000, Math.round(toFiniteNumber(src.new_budget_vnd, 350000)))
      : undefined;

  return {
    itinerary_id,
    current_itinerary,
    target_stop_order,
    reason,
    ...(new_budget_vnd !== undefined ? { new_budget_vnd } : {}),
  };
}

function normalizeStop(stop = {}, idx = 0) {
  const lat = toFiniteNumber(stop.lat, DEFAULT_ORIGIN.lat);
  const lng = toFiniteNumber(stop.lng, DEFAULT_ORIGIN.lng);
  const recommended_items = Array.isArray(stop.recommended_items)
    ? stop.recommended_items.map((item) => String(item)).filter(Boolean)
    : [];

  return {
    order: Math.max(1, Math.round(toFiniteNumber(stop.order, idx + 1))),
    stop_id:
      typeof stop.stop_id === 'string' && stop.stop_id.trim()
        ? stop.stop_id.trim()
        : `stop_${idx + 1}`,
    start_time:
      typeof stop.start_time === 'string' && stop.start_time.trim()
        ? stop.start_time.trim()
        : `${14 + idx * 2}:00`,
    end_time:
      typeof stop.end_time === 'string' && stop.end_time.trim()
        ? stop.end_time.trim()
        : `${15 + idx * 2}:45`,
    name:
      typeof stop.name === 'string' && stop.name.trim()
        ? stop.name.trim()
        : `Điểm dừng ${idx + 1}`,
    category:
      typeof stop.category === 'string' && stop.category.trim()
        ? stop.category.trim()
        : 'cafe',
    address:
      typeof stop.address === 'string' && stop.address.trim()
        ? stop.address.trim()
        : 'Thanh Xuân, Hà Nội',
    lat,
    lng,
    indoor: Boolean(stop.indoor ?? true),
    recommended_items: recommended_items.length > 0 ? recommended_items : ['Món đặc trưng'],
    estimated_cost_vnd: Math.max(0, Math.round(toFiniteNumber(stop.estimated_cost_vnd, 0))),
    estimated_calories_kcal: Math.max(
      0,
      Math.round(toFiniteNumber(stop.estimated_calories_kcal, 0)),
    ),
    nutrition_note:
      typeof stop.nutrition_note === 'string' ? stop.nutrition_note.trim() : '',
    ai_reason: typeof stop.ai_reason === 'string' ? stop.ai_reason.trim() : '',
    distance_to_next_km:
      stop.distance_to_next_km !== undefined
        ? Number(toFiniteNumber(stop.distance_to_next_km, 0).toFixed(2))
        : null,
    travel_to_next_minutes:
      stop.travel_to_next_minutes !== undefined
        ? Math.max(0, Math.round(toFiniteNumber(stop.travel_to_next_minutes, 0)))
        : null,
  };
}

/**
 * Guarantee strict Section 7 ItineraryResponse schema compliance regardless of upstream quirks.
 */
export function normalizeItineraryResponse(
  raw = {},
  { itineraryId, shareUrl, fallbackBudgetVnd = 350000, origin = DEFAULT_ORIGIN } = {},
) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawStops = Array.isArray(src.stops) ? src.stops : [];
  const stops = rawStops
    .map((stop, idx) => normalizeStop(stop, idx))
    .sort((a, b) => a.order - b.order)
    .map((stop, idx, arr) => {
      const next = arr[idx + 1];
      let distance_to_next_km = stop.distance_to_next_km;
      let travel_to_next_minutes = stop.travel_to_next_minutes;

      if (next) {
        if (distance_to_next_km === null) {
          distance_to_next_km = Number(
            (haversineKm(stop.lat, stop.lng, next.lat, next.lng) * 1.25).toFixed(2),
          );
        }
        if (travel_to_next_minutes === null) {
          travel_to_next_minutes = Math.max(2, Math.round((distance_to_next_km / 20) * 60));
        }
      } else {
        distance_to_next_km = distance_to_next_km ?? 0;
        travel_to_next_minutes = travel_to_next_minutes ?? 0;
      }

      return {
        ...stop,
        order: idx + 1,
        distance_to_next_km,
        travel_to_next_minutes,
      };
    });

  const rawPolyline = Array.isArray(src.route_polyline) ? src.route_polyline : [];
  let route_polyline = rawPolyline
    .filter(
      (pt) =>
        Array.isArray(pt) &&
        pt.length >= 2 &&
        Number.isFinite(Number(pt[0])) &&
        Number.isFinite(Number(pt[1])),
    )
    .map((pt) => [Number(pt[0]), Number(pt[1])]);

  if (route_polyline.length < 2 && stops.length > 0) {
    route_polyline = [
      [toFiniteNumber(origin?.lat, DEFAULT_ORIGIN.lat), toFiniteNumber(origin?.lng, DEFAULT_ORIGIN.lng)],
      ...stops.map((s) => [s.lat, s.lng]),
    ];
  }

  const computedCost = stops.reduce((sum, s) => sum + s.estimated_cost_vnd, 0);
  const computedKcal = stops.reduce((sum, s) => sum + s.estimated_calories_kcal, 0);
  const computedDistance = stops.reduce((sum, s) => sum + (s.distance_to_next_km || 0), 0);
  const computedMinutes = stops.reduce((sum, s) => sum + (s.travel_to_next_minutes || 0), 0);

  const rawSummary = src.summary && typeof src.summary === 'object' ? src.summary : {};

  const summary = {
    title:
      typeof rawSummary.title === 'string' && rawSummary.title.trim()
        ? rawSummary.title.trim()
        : 'Lịch trình Dayout AI tại Hà Nội',
    total_cost_per_person_vnd: Math.round(
      toFiniteNumber(rawSummary.total_cost_per_person_vnd, computedCost),
    ),
    budget_per_person_vnd: Math.round(
      toFiniteNumber(rawSummary.budget_per_person_vnd, fallbackBudgetVnd),
    ),
    total_calories_kcal: Math.round(
      toFiniteNumber(rawSummary.total_calories_kcal, computedKcal),
    ),
    nutrition_badge:
      typeof rawSummary.nutrition_badge === 'string' && rawSummary.nutrition_badge.trim()
        ? rawSummary.nutrition_badge.trim()
        : 'Cân bằng dinh dưỡng • Tối ưu lộ trình',
    total_distance_km: Number(
      toFiniteNumber(rawSummary.total_distance_km, computedDistance).toFixed(2),
    ),
    total_travel_minutes: Math.round(
      toFiniteNumber(rawSummary.total_travel_minutes, computedMinutes),
    ),
  };

  return {
    itinerary_id:
      itineraryId ||
      (typeof src.itinerary_id === 'string' && src.itinerary_id.trim()
        ? src.itinerary_id.trim()
        : `itin_${Date.now().toString(36)}`),
    share_url:
      shareUrl || (typeof src.share_url === 'string' ? src.share_url.trim() : ''),
    summary,
    route_polyline,
    stops,
  };
}
