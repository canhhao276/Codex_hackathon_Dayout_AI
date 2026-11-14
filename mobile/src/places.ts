// Dữ liệu địa điểm miễn phí, không cần API key:
//  - Tìm địa chỉ tự do trong Hà Nội (điểm xuất phát / kết thúc): Photon (komoot, dữ liệu OpenStreetMap).
//  - Ảnh địa điểm: Wikipedia tiếng Việt (bài gần toạ độ & trùng tên) → Wikimedia Commons (ảnh chụp ngay tại chỗ).
// Không có ảnh chắc chắn đúng thì trả null để app hiện ảnh minh hoạ theo loại địa điểm — không đoán bừa.
import type { Origin } from './types';

const HANOI = { lat: 21.0285, lng: 105.8542 };
const HANOI_BBOX = '105.28,20.56,106.02,21.39'; // minLon,minLat,maxLon,maxLat
// Wikimedia yêu cầu định danh ứng dụng; trình duyệt không cho đổi User-Agent nên dùng Api-User-Agent.
const WIKI_HEADERS = { 'Api-User-Agent': 'DayoutApp/1.0 (hackathon demo)' };

async function getJson(url: string, ms: number, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', ...headers } });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Tìm địa chỉ (giới hạn trong Hà Nội) ----------
export interface PlaceHit extends Origin {
  title: string;
  subtitle: string;
}

export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6` +
    `&lat=${HANOI.lat}&lon=${HANOI.lng}&bbox=${HANOI_BBOX}&lang=default`;
  const data = await getJson(url, 7000);
  const feats: any[] = data?.features ?? [];
  const seen = new Set<string>();
  return feats
    .map((f) => {
      const p = f.properties ?? {};
      const [lng, lat] = f.geometry?.coordinates ?? [];
      const title = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || query;
      const subtitle = [p.name ? [p.housenumber, p.street].filter(Boolean).join(' ') : null, p.district, p.city || 'Hà Nội']
        .filter(Boolean)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
        .join(', ');
      return { lat, lng, title, subtitle, label: [title, subtitle].filter(Boolean).join(', ') };
    })
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng))
    .filter((h) => {
      const k = `${h.title}|${h.subtitle}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// ---------- Ảnh địa điểm ----------
const photoCache = new Map<string, string | null>();

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9 ]/g, ' ');

const STOP_WORDS = new Set(['ha', 'noi', 'pho', 'duong', 'quan', 'cua', 'the', 'cafe', 'coffee', 'nha', 'hang', 'tai', 'royal', 'city']);
/** Tên địa điểm khớp tiêu đề ảnh/bài viết? Bỏ các từ trùng với địa chỉ (tên đường, phường) để
 *  "Starbucks Lê Văn Lương" không khớp nhầm ảnh chụp đường Lê Văn Lương. */
function sharesName(a: string, b: string, address = '') {
  const addr = new Set(fold(address).split(/\s+/));
  const ta = fold(a).split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !addr.has(w));
  const tb = new Set(fold(b).split(/\s+/));
  const hit = ta.filter((w) => tb.has(w)).length;
  return ta.length > 0 && hit / ta.length >= 0.5;
}

/** URL ảnh thumbnail hoặc null. Chỉ nhận ảnh khi tên khớp địa điểm. */
export async function findPlacePhoto(name: string, lat: number, lng: number, address = ''): Promise<string | null> {
  const key = `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  if (photoCache.has(key)) return photoCache.get(key)!;
  let url: string | null = null;
  try {
    const wiki = await getJson(
      'https://vi.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch' +
        `&ggscoord=${lat}%7C${lng}&ggsradius=600&ggslimit=15&prop=pageimages&piprop=thumbnail&pithumbsize=240`,
      6000,
      WIKI_HEADERS,
    );
    const pages: any[] = Object.values(wiki?.query?.pages ?? {});
    url = pages.find((p) => p.thumbnail?.source && sharesName(name, p.title, address))?.thumbnail?.source ?? null;
    if (!url) {
      const com = await getJson(
        'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch' +
          `&ggscoord=${lat}%7C${lng}&ggsradius=150&ggslimit=10&ggsnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=240`,
        6000,
        WIKI_HEADERS,
      );
      const files: any[] = Object.values(com?.query?.pages ?? {});
      url = files.find((f) => sharesName(name, f.title ?? '', address))?.imageinfo?.[0]?.thumburl ?? null;
    }
  } catch {
    url = null;
  }
  photoCache.set(key, url);
  return url;
}
