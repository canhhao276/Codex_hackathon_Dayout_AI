import type {
  GenerateRequest,
  ItineraryResponse,
  ItinerarySummary,
  ReplanRequest,
  Stop,
} from './types';

const GENERATE_TIMEOUT_MS = 30000;
const REPLAN_TIMEOUT_MS = 25000;
const HEALTH_TIMEOUT_MS = 6000;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ body: T; aiSource: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ApiError(`Server phản hồi quá ${Math.round(timeoutMs / 1000)}s (timeout).`);
    }
    throw new ApiError(`Không kết nối được tới ${baseUrl}. Kiểm tra API URL / 4G / Tunnel.`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail =
      (body && (body.error || body.detail || body.message)) || text.slice(0, 160) || res.statusText;
    throw new ApiError(
      `Lỗi server ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
      res.status,
    );
  }
  if (body == null) throw new ApiError('Server trả về dữ liệu không phải JSON.');
  return { body: body as T, aiSource: res.headers.get('x-ai-source') };
}

const num = (v: any, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const str = (v: any, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));

/** Chuẩn hoá response để UI không bao giờ crash nếu backend thiếu field. */
export function normalizeItinerary(raw: any): ItineraryResponse {
  const data = raw?.itinerary && raw.itinerary.stops ? raw.itinerary : raw?.data?.stops ? raw.data : raw;
  if (!data || !Array.isArray(data.stops) || data.stops.length === 0) {
    throw new ApiError('Lịch trình trả về không có điểm dừng nào.');
  }

  const stops: Stop[] = data.stops
    .map((s: any, i: number) => ({
      order: num(s.order, i + 1),
      stop_id: str(s.stop_id, `stop_${i + 1}`),
      start_time: str(s.start_time),
      end_time: str(s.end_time),
      name: str(s.name, `Điểm ${i + 1}`),
      category: str(s.category, 'activity'),
      address: str(s.address),
      lat: num(s.lat, NaN),
      lng: num(s.lng, NaN),
      indoor: Boolean(s.indoor),
      recommended_items: Array.isArray(s.recommended_items) ? s.recommended_items.map(String) : [],
      estimated_cost_vnd: num(s.estimated_cost_vnd),
      estimated_calories_kcal: num(s.estimated_calories_kcal),
      nutrition_note: str(s.nutrition_note),
      ai_reason: str(s.ai_reason),
      distance_to_next_km: s.distance_to_next_km == null ? null : num(s.distance_to_next_km),
      travel_to_next_minutes: s.travel_to_next_minutes == null ? null : num(s.travel_to_next_minutes),
    }))
    .sort((a: Stop, b: Stop) => a.order - b.order);

  const sm = data.summary ?? {};
  const sumCost = stops.reduce((acc, s) => acc + s.estimated_cost_vnd, 0);
  const sumKcal = stops.reduce((acc, s) => acc + s.estimated_calories_kcal, 0);
  const sumKm = stops.reduce((acc, s) => acc + (s.distance_to_next_km ?? 0), 0);
  const sumMin = stops.reduce((acc, s) => acc + (s.travel_to_next_minutes ?? 0), 0);

  const summary: ItinerarySummary = {
    title: str(sm.title, 'Lịch trình Dayout AI'),
    total_cost_per_person_vnd: num(sm.total_cost_per_person_vnd, sumCost),
    budget_per_person_vnd: num(sm.budget_per_person_vnd, 0),
    total_calories_kcal: num(sm.total_calories_kcal, sumKcal),
    nutrition_badge: str(sm.nutrition_badge),
    total_distance_km: num(sm.total_distance_km, Math.round(sumKm * 10) / 10),
    total_travel_minutes: num(sm.total_travel_minutes, sumMin),
  };

  const route_polyline: [number, number][] = Array.isArray(data.route_polyline)
    ? data.route_polyline
        .filter((p: any) => Array.isArray(p) && p.length >= 2)
        .map((p: any) => [num(p[0], NaN), num(p[1], NaN)] as [number, number])
        .filter((p: [number, number]) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    : [];

  return {
    itinerary_id: str(data.itinerary_id, `itin_${Date.now()}`),
    share_url: str(data.share_url),
    summary,
    route_polyline,
    stops,
  };
}

/** Kết quả kèm nguồn sinh lịch trình: header `X-AI-Source` của backend-node ('fastapi' | 'fallback'). */
export interface ItineraryResult {
  itinerary: ItineraryResponse;
  aiSource: string | null;
}

export async function generateItinerary(
  baseUrl: string,
  body: GenerateRequest,
): Promise<ItineraryResult> {
  const { body: raw, aiSource } = await request<any>(
    baseUrl,
    '/api/v1/itineraries/generate',
    { method: 'POST', body: JSON.stringify(body) },
    GENERATE_TIMEOUT_MS,
  );
  return { itinerary: normalizeItinerary(raw), aiSource };
}

export async function replanItinerary(
  baseUrl: string,
  body: ReplanRequest,
): Promise<ItineraryResult> {
  const { body: raw, aiSource } = await request<any>(
    baseUrl,
    '/api/v1/itineraries/replan',
    { method: 'POST', body: JSON.stringify(body) },
    REPLAN_TIMEOUT_MS,
  );
  return { itinerary: normalizeItinerary(raw), aiSource };
}

export async function checkHealth(baseUrl: string): Promise<{ ok: boolean; text: string }> {
  const started = Date.now();
  const { body } = await request<any>(baseUrl, '/health', { method: 'GET' }, HEALTH_TIMEOUT_MS);
  const ms = Date.now() - started;
  const ai = body?.ai_service ?? body?.ai ?? body?.fastapi;
  if (ai == null) return { ok: true, text: `Server OK (${ms}ms)` };
  const online =
    typeof ai === 'object' ? ai.online ?? ai.ok ?? ai.status === 'ok' : ai === true || ai === 'ok';
  if (online) {
    const lat = typeof ai === 'object' && ai.latency_ms != null ? `, ${ai.latency_ms}ms` : '';
    return { ok: true, text: `Server OK (${ms}ms) • AI FastAPI online${lat}` };
  }
  return { ok: false, text: `Server OK (${ms}ms) nhưng AI FastAPI OFFLINE → lịch trình sẽ là dự phòng, không phải AI!` };
}
