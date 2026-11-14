// Vẽ đường đi theo đường phố thật (OSRM công khai, miễn phí).
// - Backend lỡ trả đường chim bay (OSRM quá giờ trên laptop) → điện thoại tự lấy hình học đường thật.
// - Người dùng chọn điểm kết thúc → nối thêm chặng cuối từ điểm dừng cuối về đích.
import type { ItineraryResponse, Origin } from './types';

const SERVERS = [
  'https://router.project-osrm.org/route/v1/driving/',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
];

export interface RoadRoute {
  line: [number, number][];
  /** Từng chặng theo thứ tự điểm đã gửi: km & phút. */
  legs: { km: number; min: number }[];
}

const cache = new Map<string, RoadRoute>();

/** Đường "thẳng" = chỉ gồm các điểm dừng (+ điểm xuất phát), không có điểm trung gian theo đường phố. */
export function isStraightLine(it: ItineraryResponse): boolean {
  return it.route_polyline.length <= it.stops.length + 2;
}

/** Như Promise.any (không phụ thuộc phiên bản Hermes): resolve với kết quả thành công đầu tiên. */
function firstSuccess<T>(ps: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let failed = 0;
    ps.forEach((p) =>
      p.then(resolve, () => {
        failed += 1;
        if (failed === ps.length) reject(new Error('all failed'));
      }),
    );
  });
}

async function fetchFrom(base: string, coords: string, signal: AbortSignal): Promise<RoadRoute> {
  const res = await fetch(`${base}${coords}?overview=full&geometries=geojson&steps=false`, { signal });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  const line: [number, number][] | undefined = route?.geometry?.coordinates;
  if (!line || line.length < 2) throw new Error('OSRM empty');
  return {
    line: line.map(([lng, lat]) => [lat, lng]),
    legs: (route.legs ?? []).map((l: any) => ({
      km: Math.round((l.distance ?? 0) / 100) / 10,
      // OSRM tính cho ô tô; xe máy nội đô Hà Nội đi chậm hơn ~30%.
      min: Math.max(1, Math.round(((l.duration ?? 0) / 60) * 1.3)),
    })),
  };
}

/** Đường thật qua: điểm xuất phát → các điểm dừng → (điểm kết thúc nếu có). null nếu không lấy được. */
export async function fetchRoadRoute(
  it: ItineraryResponse,
  origin: Origin | null,
  destination?: Origin | null,
): Promise<RoadRoute | null> {
  const pts = [
    ...(origin ? [{ lat: origin.lat, lng: origin.lng }] : []),
    ...it.stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)),
    ...(destination ? [{ lat: destination.lat, lng: destination.lng }] : []),
  ];
  if (pts.length < 2) return null;
  const coords = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const hit = cache.get(coords);
  if (hit) return hit;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const route = await firstSuccess(SERVERS.map((s) => fetchFrom(s, coords, controller.signal)));
    cache.set(coords, route);
    return route;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
