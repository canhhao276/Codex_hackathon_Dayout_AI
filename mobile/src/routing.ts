// Vẽ đường đi theo đường phố thật. Khi backend hết giờ gọi OSRM nó trả về đường nối thẳng các điểm
// (đường chim bay); lúc đó app tự gọi OSRM miễn phí từ điện thoại để lấy hình học đường thật.
import type { ItineraryResponse, Origin } from './types';

const SERVERS = [
  'https://router.project-osrm.org/route/v1/driving/',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
];

const cache = new Map<string, [number, number][]>();

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

async function fetchFrom(base: string, coords: string, signal: AbortSignal): Promise<[number, number][]> {
  const res = await fetch(`${base}${coords}?overview=full&geometries=geojson&steps=false`, { signal });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const line: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
  if (!line || line.length < 2) throw new Error('OSRM empty');
  return line.map(([lng, lat]) => [lat, lng]);
}

/** Trả về polyline theo đường thật [lat, lng][] hoặc null nếu không lấy được (giữ nguyên đường cũ). */
export async function fetchRoadPolyline(it: ItineraryResponse, origin: Origin | null): Promise<[number, number][] | null> {
  const pts = [
    ...(origin ? [{ lat: origin.lat, lng: origin.lng }] : []),
    ...it.stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)),
  ];
  if (pts.length < 2) return null;
  const coords = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const hit = cache.get(coords);
  if (hit) return hit;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    // Gọi song song 2 máy chủ, lấy kết quả về trước.
    const line = await firstSuccess(SERVERS.map((s) => fetchFrom(s, coords, controller.signal)));
    cache.set(coords, line);
    return line;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
