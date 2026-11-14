// Dữ liệu MẪU chuẩn JSON Contract (Mục 7) — chỉ dùng để test UI khi server chưa bật.
// App luôn ưu tiên gọi API thật; khi dùng mẫu, UI hiển thị nhãn "DỮ LIỆU MẪU".
import type { GenerateRequest, ItineraryResponse, Origin, ReplanReason, Stop } from './types';

type PoolStop = Omit<
  Stop,
  'order' | 'start_time' | 'end_time' | 'distance_to_next_km' | 'travel_to_next_minutes'
>;

const BASE_STOPS: PoolStop[] = [
  {
    stop_id: 'poi_tx_01',
    name: 'All Day Coffee',
    category: 'cafe',
    address: 'Khu vực Thanh Xuân / Đống Đa, Hà Nội',
    lat: 21.0045,
    lng: 105.808,
    indoor: true,
    recommended_items: ['Cold Brew Cam Sả ít đường', 'Bánh chuối yến mạch'],
    estimated_cost_vnd: 95000,
    estimated_calories_kcal: 210,
    nutrition_note: 'Ít đường, năng lượng nhẹ buổi chiều',
    ai_reason: 'Không gian yên tĩnh hợp trò chuyện, cách điểm xuất phát 1.1km',
  },
  {
    stop_id: 'poi_tx_02',
    name: 'Công viên Nhân Chính',
    category: 'activity',
    address: 'Nhân Chính, Thanh Xuân, Hà Nội',
    lat: 21.0068,
    lng: 105.8013,
    indoor: false,
    recommended_items: ['Đi bộ dạo hồ', 'Chụp ảnh hoàng hôn'],
    estimated_cost_vnd: 0,
    estimated_calories_kcal: 0,
    nutrition_note: 'Vận động nhẹ, đốt ~120 kcal',
    ai_reason: 'Không gian thoáng đúng mong muốn, miễn phí giúp cân đối ngân sách',
  },
  {
    stop_id: 'poi_tx_03',
    name: 'Phở cuốn & Salad Healthy',
    category: 'food',
    address: 'Vũ Trọng Phụng, Thanh Xuân, Hà Nội',
    lat: 20.9985,
    lng: 105.8075,
    indoor: true,
    recommended_items: ['Phở cuốn tôm thịt', 'Salad ức gà sốt mè rang'],
    estimated_cost_vnd: 140000,
    estimated_calories_kcal: 520,
    nutrition_note: 'Giàu đạm, ít dầu mỡ — đạt chuẩn Eat Clean',
    ai_reason: 'Bữa tối nhẹ, nhiều rau và đạm nạc đúng mục tiêu Eat Clean',
  },
  {
    stop_id: 'poi_tx_04',
    name: 'Sữa chua trân châu Hạ Long',
    category: 'dessert_chill',
    address: 'Khu vực Royal City, Thanh Xuân, Hà Nội',
    lat: 21.003,
    lng: 105.815,
    indoor: true,
    recommended_items: ['Sữa chua nếp cẩm ít đường'],
    estimated_cost_vnd: 80000,
    estimated_calories_kcal: 160,
    nutrition_note: 'Lợi khuẩn, ít đường',
    ai_reason: 'Kết thúc buổi tối nhẹ nhàng, gần điểm ăn tối 1.2km',
  },
];

const ALT_POOL: PoolStop[] = [
  {
    stop_id: 'poi_alt_01',
    name: 'Workshop vẽ tranh túi tote',
    category: 'activity',
    address: 'Royal City, 72A Nguyễn Trãi, Thanh Xuân, Hà Nội',
    lat: 21.0028,
    lng: 105.8155,
    indoor: true,
    recommended_items: ['Vẽ túi tote đôi', 'Trà đào miễn phí'],
    estimated_cost_vnd: 120000,
    estimated_calories_kcal: 60,
    nutrition_note: 'Hoạt động trong nhà, đồ uống ít đường',
    ai_reason: 'Trời mưa: hoạt động trong nhà, có mái che, gần lộ trình hiện tại',
  },
  {
    stop_id: 'poi_alt_02',
    name: 'Bún chả gia truyền',
    category: 'food',
    address: 'Khương Trung, Thanh Xuân, Hà Nội',
    lat: 20.9968,
    lng: 105.8188,
    indoor: true,
    recommended_items: ['Bún chả suất nhỏ', 'Nem cua bể'],
    estimated_cost_vnd: 65000,
    estimated_calories_kcal: 480,
    nutrition_note: 'Đậm đà, giá mềm',
    ai_reason: 'Giảm ngân sách: món địa phương ngon, rẻ hơn ~50%',
  },
  {
    stop_id: 'poi_alt_03',
    name: 'Trà sen & Chè healthy',
    category: 'dessert_chill',
    address: 'Láng Hạ, Đống Đa, Hà Nội',
    lat: 21.0105,
    lng: 105.8115,
    indoor: true,
    recommended_items: ['Trà sen vàng không đường', 'Chè hạt sen'],
    estimated_cost_vnd: 45000,
    estimated_calories_kcal: 90,
    nutrition_note: 'Rất ít calo, không đường',
    ai_reason: 'Nhẹ calo hơn, không gian trong nhà yên tĩnh',
  },
  {
    stop_id: 'poi_alt_04',
    name: 'Boardgame Café',
    category: 'activity',
    address: 'Thái Thịnh, Đống Đa, Hà Nội',
    lat: 21.0098,
    lng: 105.8172,
    indoor: true,
    recommended_items: ['Ma Sói', 'Uno', 'Trà chanh ít đường'],
    estimated_cost_vnd: 50000,
    estimated_calories_kcal: 80,
    nutrition_note: 'Đồ uống ít đường',
    ai_reason: 'Thay thế đông đúc: ít người, vui cho nhóm, giá rẻ',
  },
];

const TIME_SLOTS: [string, string][] = [
  ['14:00', '15:30'],
  ['15:45', '17:15'],
  ['17:45', '19:15'],
  ['19:30', '21:00'],
];

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function build(
  pool: PoolStop[],
  origin: Origin,
  budget: number,
  title: string,
  badge: string,
  id: string,
): ItineraryResponse {
  const stops: Stop[] = pool.map((p, i) => {
    const next = pool[i + 1];
    const km = next ? Math.round(haversineKm([p.lat, p.lng], [next.lat, next.lng]) * 1.25 * 10) / 10 : null;
    return {
      ...p,
      order: i + 1,
      start_time: TIME_SLOTS[i]?.[0] ?? '',
      end_time: TIME_SLOTS[i]?.[1] ?? '',
      distance_to_next_km: km,
      travel_to_next_minutes: km == null ? null : Math.max(3, Math.round(km * 4)),
    };
  });
  const firstKm = haversineKm([origin.lat, origin.lng], [stops[0].lat, stops[0].lng]) * 1.25;
  const totalKm = stops.reduce((a, s) => a + (s.distance_to_next_km ?? 0), firstKm);
  const totalMin = stops.reduce((a, s) => a + (s.travel_to_next_minutes ?? 0), Math.round(firstKm * 4));
  return {
    itinerary_id: id,
    share_url: '',
    summary: {
      title,
      total_cost_per_person_vnd: stops.reduce((a, s) => a + s.estimated_cost_vnd, 0),
      budget_per_person_vnd: budget,
      total_calories_kcal: stops.reduce((a, s) => a + s.estimated_calories_kcal, 0),
      nutrition_badge: badge,
      total_distance_km: Math.round(totalKm * 10) / 10,
      total_travel_minutes: totalMin,
    },
    route_polyline: [[origin.lat, origin.lng], ...stops.map((s) => [s.lat, s.lng] as [number, number])],
    stops,
  };
}

export function buildSampleItinerary(req: GenerateRequest): ItineraryResponse {
  return build(
    BASE_STOPS,
    req.origin,
    req.budget_vnd,
    'Chiều Thanh Xuân Nhẹ Nhàng & Eat Clean',
    'Đạt chuẩn Eat Clean • Giàu đạm, ít đường',
    `sample_${Date.now()}`,
  );
}

export function sampleReplan(
  current: ItineraryResponse,
  origin: Origin,
  targetOrder: number,
  reason: ReplanReason,
  newBudget: number,
): ItineraryResponse {
  const used = new Set(current.stops.map((s) => s.stop_id));
  const candidates = ALT_POOL.filter((p) => !used.has(p.stop_id));
  const pick =
    (reason === 'rainy_weather' && candidates.find((c) => c.indoor && c.category === 'activity')) ||
    (reason === 'tighter_budget' && [...candidates].sort((a, b) => a.estimated_cost_vnd - b.estimated_cost_vnd)[0]) ||
    (reason === 'lower_calories' &&
      [...candidates].sort((a, b) => a.estimated_calories_kcal - b.estimated_calories_kcal)[0]) ||
    candidates[0];
  const pool: PoolStop[] = current.stops.map((s) => {
    const { order, start_time, end_time, distance_to_next_km, travel_to_next_minutes, ...rest } = s;
    return rest;
  });
  if (pick) {
    const idx = Math.max(0, pool.findIndex((_, i) => current.stops[i].order === targetOrder));
    pool[idx] = pick;
  }
  return build(
    pool,
    origin,
    newBudget,
    current.summary.title,
    current.summary.nutrition_badge,
    current.itinerary_id,
  );
}
