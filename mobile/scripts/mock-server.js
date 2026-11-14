// Mock server theo JSON Contract (Mục 7) — CHỈ để Người 1 test app trước khi backend thật sẵn sàng.
// Chạy: node scripts/mock-server.js   (cổng 3000, đừng chạy cùng lúc với backend-node thật)
const http = require('http');

const PORT = Number(process.env.PORT || 3000);

const STOPS = [
  { stop_id: 'poi_tx_01', name: 'All Day Coffee', category: 'cafe', address: 'Thanh Xuân, Hà Nội', lat: 21.0045, lng: 105.808, indoor: true, recommended_items: ['Cold Brew Cam Sả ít đường'], estimated_cost_vnd: 95000, estimated_calories_kcal: 210, nutrition_note: 'Ít đường', ai_reason: 'Yên tĩnh, gần điểm xuất phát' },
  { stop_id: 'poi_tx_02', name: 'Công viên Nhân Chính', category: 'activity', address: 'Nhân Chính, Thanh Xuân', lat: 21.0068, lng: 105.8013, indoor: false, recommended_items: ['Đi dạo hồ'], estimated_cost_vnd: 0, estimated_calories_kcal: 0, nutrition_note: 'Vận động nhẹ', ai_reason: 'Không gian thoáng, miễn phí' },
  { stop_id: 'poi_tx_03', name: 'Phở cuốn & Salad Healthy', category: 'food', address: 'Vũ Trọng Phụng, Thanh Xuân', lat: 20.9985, lng: 105.8075, indoor: true, recommended_items: ['Phở cuốn', 'Salad ức gà'], estimated_cost_vnd: 140000, estimated_calories_kcal: 520, nutrition_note: 'Giàu đạm', ai_reason: 'Đúng Eat Clean' },
];
const ALT = [
  { stop_id: 'poi_alt_01', name: 'Workshop vẽ tranh túi tote', category: 'activity', address: 'Royal City, Thanh Xuân', lat: 21.0028, lng: 105.8155, indoor: true, recommended_items: ['Vẽ túi tote'], estimated_cost_vnd: 120000, estimated_calories_kcal: 60, nutrition_note: 'Trong nhà', ai_reason: 'Trời mưa: chuyển vào trong nhà' },
  { stop_id: 'poi_alt_02', name: 'Bún chả gia truyền', category: 'food', address: 'Khương Trung, Thanh Xuân', lat: 20.9968, lng: 105.8188, indoor: true, recommended_items: ['Bún chả'], estimated_cost_vnd: 65000, estimated_calories_kcal: 480, nutrition_note: 'Giá mềm', ai_reason: 'Rẻ hơn' },
];
const SLOTS = [['14:00', '15:30'], ['15:45', '17:15'], ['17:45', '19:15'], ['19:30', '21:00']];

function build(pool, origin, budget, id) {
  const stops = pool.map((p, i) => ({ ...p, order: i + 1, start_time: SLOTS[i][0], end_time: SLOTS[i][1], distance_to_next_km: i < pool.length - 1 ? 1.5 : null, travel_to_next_minutes: i < pool.length - 1 ? 7 : null }));
  return {
    itinerary_id: id,
    share_url: `http://localhost:${PORT}/s/${id.slice(-5)}`,
    summary: {
      title: 'Chiều Thanh Xuân Nhẹ Nhàng (MOCK)',
      total_cost_per_person_vnd: stops.reduce((a, s) => a + s.estimated_cost_vnd, 0),
      budget_per_person_vnd: budget,
      total_calories_kcal: stops.reduce((a, s) => a + s.estimated_calories_kcal, 0),
      nutrition_badge: 'Đạt chuẩn Eat Clean (mock)',
      total_distance_km: 3.4,
      total_travel_minutes: 14,
    },
    route_polyline: [[origin.lat, origin.lng], ...stops.map((s) => [s.lat, s.lng])],
    stops,
  };
}

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
  res.end(JSON.stringify(body));
};

http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {};
    console.log(new Date().toISOString(), req.method, req.url);
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.url === '/health') return send(res, 200, { status: 'ok', ai: 'mock' });
    if (req.url === '/api/v1/itineraries/generate' && req.method === 'POST') {
      return setTimeout(() => send(res, 200, build(STOPS, body.origin, body.budget_vnd, `itin_${Date.now()}`)), 1500);
    }
    if (req.url === '/api/v1/itineraries/replan' && req.method === 'POST') {
      const cur = body.current_itinerary;
      const used = new Set(cur.stops.map((s) => s.stop_id));
      const alt = ALT.find((a) => !used.has(a.stop_id)) || ALT[0];
      const pool = cur.stops.map((s) => (s.order === body.target_stop_order ? alt : s));
      const origin = { lat: cur.route_polyline[0][0], lng: cur.route_polyline[0][1] };
      return setTimeout(() => send(res, 200, build(pool, origin, body.new_budget_vnd, cur.itinerary_id)), 1000);
    }
    send(res, 404, { error: 'not_found' });
  });
}).listen(PORT, () => console.log(`Mock Dayout API on http://localhost:${PORT}`));
