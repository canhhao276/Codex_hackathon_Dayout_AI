import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';

function listenServer(handlerOrApp) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handlerOrApp);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((res) => server.close(res)),
      });
    });
    server.on('error', reject);
  });
}

function assertItineraryContract(data) {
  assert.equal(typeof data.itinerary_id, 'string');
  assert.ok(data.itinerary_id.length > 0);
  assert.equal(typeof data.share_url, 'string');
  assert.ok(data.share_url.includes('/s/'));

  assert.ok(data.summary && typeof data.summary === 'object');
  assert.equal(typeof data.summary.title, 'string');
  assert.equal(typeof data.summary.total_cost_per_person_vnd, 'number');
  assert.equal(typeof data.summary.budget_per_person_vnd, 'number');
  assert.equal(typeof data.summary.total_calories_kcal, 'number');
  assert.equal(typeof data.summary.nutrition_badge, 'string');
  assert.equal(typeof data.summary.total_distance_km, 'number');
  assert.equal(typeof data.summary.total_travel_minutes, 'number');

  assert.ok(Array.isArray(data.route_polyline));
  assert.ok(data.route_polyline.length >= 2);
  for (const pt of data.route_polyline) {
    assert.equal(pt.length, 2);
    assert.equal(typeof pt[0], 'number');
    assert.equal(typeof pt[1], 'number');
  }

  assert.ok(Array.isArray(data.stops));
  assert.ok(data.stops.length >= 1);
  for (const stop of data.stops) {
    assert.equal(typeof stop.order, 'number');
    assert.equal(typeof stop.stop_id, 'string');
    assert.equal(typeof stop.start_time, 'string');
    assert.equal(typeof stop.end_time, 'string');
    assert.equal(typeof stop.name, 'string');
    assert.equal(typeof stop.category, 'string');
    assert.equal(typeof stop.address, 'string');
    assert.equal(typeof stop.lat, 'number');
    assert.equal(typeof stop.lng, 'number');
    assert.equal(typeof stop.indoor, 'boolean');
    assert.ok(Array.isArray(stop.recommended_items));
    assert.equal(typeof stop.estimated_cost_vnd, 'number');
    assert.equal(typeof stop.estimated_calories_kcal, 'number');
    assert.equal(typeof stop.nutrition_note, 'string');
    assert.equal(typeof stop.ai_reason, 'string');
    assert.equal(typeof stop.distance_to_next_km, 'number');
    assert.equal(typeof stop.travel_to_next_minutes, 'number');
  }
}

describe('Dayout AI Node.js BFF API & Views', () => {
  let tmpDir;
  let storePath;
  let mockFastApi;
  let lastForwardedGenerateBody = null;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dayout-node-test-'));
    storePath = path.join(tmpDir, 'store.json');

    mockFastApi = await listenServer((req, res) => {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
      });
      req.on('end', () => {
        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', engine: 'mock-fastapi' }));
          return;
        }
        if (req.method === 'POST' && req.url === '/ai/generate') {
          lastForwardedGenerateBody = JSON.parse(bodyStr || '{}');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              summary: {
                title: 'Chiều Thanh Xuân Chuẩn AI FastAPI',
                total_cost_per_person_vnd: 280000,
                budget_per_person_vnd: lastForwardedGenerateBody.budget_vnd || 350000,
                total_calories_kcal: 820,
                nutrition_badge: 'Đạt chuẩn Eat Clean • Giàu đạm',
                total_distance_km: 2.9,
                total_travel_minutes: 11,
              },
              route_polyline: [
                [21.0012, 105.8035],
                [21.0045, 105.808],
                [21.0031, 105.8154],
              ],
              stops: [
                {
                  order: 1,
                  stop_id: 'poi_mock_1',
                  start_time: '14:00',
                  end_time: '15:30',
                  name: 'All Day Coffee',
                  category: 'cafe',
                  address: 'Thanh Xuân, Hà Nội',
                  lat: 21.0045,
                  lng: 105.808,
                  indoor: true,
                  recommended_items: ['Cold Brew Cam Sả ít đường'],
                  estimated_cost_vnd: 95000,
                  estimated_calories_kcal: 190,
                  nutrition_note: 'Ít đường',
                  ai_reason: 'Yên tĩnh hợp trò chuyện',
                  distance_to_next_km: 1.4,
                  travel_to_next_minutes: 6,
                },
                {
                  order: 2,
                  stop_id: 'poi_mock_2',
                  start_time: '15:45',
                  end_time: '17:30',
                  name: 'Công viên Thanh Xuân',
                  category: 'activity',
                  address: 'Hoàng Minh Giám, Thanh Xuân, Hà Nội',
                  lat: 21.0038,
                  lng: 105.7966,
                  indoor: false,
                  recommended_items: ['Đi dạo quanh hồ'],
                  estimated_cost_vnd: 15000,
                  estimated_calories_kcal: 0,
                  nutrition_note: 'Hoạt động nhẹ ngoài trời',
                  ai_reason: 'Thoáng mát gần quán cafe',
                  distance_to_next_km: 0,
                  travel_to_next_minutes: 0,
                },
              ],
            }),
          );
          return;
        }
        res.writeHead(404);
        res.end('Not Found');
      });
    });
  });

  after(async () => {
    await mockFastApi.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 1: GET /health returns service info and upstream AI status', async () => {
    const app = createApp({
      aiServiceUrl: mockFastApi.url,
      storePath,
      useOsrm: false,
    });
    const srv = await listenServer(app);
    try {
      const res = await fetch(`${srv.url}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.service, 'dayout-ai-backend-node');
      assert.equal(data.ai_service.online, true);
      assert.equal(data.ai_service.status_code, 200);
    } finally {
      await srv.close();
    }
  });

  it('Test 2: POST /api/v1/itineraries/generate forwards to FastAPI, builds Cloudflare share_url, and persists', async () => {
    const app = createApp({
      aiServiceUrl: mockFastApi.url,
      storePath,
      useOsrm: false,
    });
    const srv = await listenServer(app);
    try {
      const res = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-Host': 'demo.trycloudflare.com',
        },
        body: JSON.stringify({
          origin: { lat: 21.0012, lng: 105.8035, label: '79 Nguyễn Như Kon Tum' },
          budget_vnd: 350000,
          people_count: 2,
          vibes: ['chill_cafe', 'interactive_activity'],
          nutrition_goal: 'eat_clean',
          time_window: { start: '14:00', end: '21:00' },
          PromptNote: 'Hẹn hò nhẹ nhàng',
        }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-ai-source'), 'fastapi');

      const data = await res.json();
      assertItineraryContract(data);
      assert.ok(data.share_url.startsWith('https://demo.trycloudflare.com/s/'));
      assert.equal(data.summary.title, 'Chiều Thanh Xuân Chuẩn AI FastAPI');
      assert.equal(lastForwardedGenerateBody.prompt_note, 'Hẹn hò nhẹ nhàng');

      // Verify persistence on disk by instantiating a fresh store reader
      const reloadedStore = createStore(storePath);
      const persisted = reloadedStore.getById(data.itinerary_id);
      assert.ok(persisted);
      assert.equal(persisted.itinerary.summary.title, 'Chiều Thanh Xuân Chuẩn AI FastAPI');
    } finally {
      await srv.close();
    }
  });

  it('Test 3: Fallback mode generate + rainy_weather replan preserves share_url, enforces indoor stop, and increments stats', async () => {
    const offlineStorePath = path.join(tmpDir, 'offline-store.json');
    const app = createApp({
      aiServiceUrl: 'http://127.0.0.1:59999', // guaranteed unreachable
      storePath: offlineStorePath,
      useOsrm: false,
    });
    const srv = await listenServer(app);
    try {
      const genRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 21.0012, lng: 105.8035, label: '79 Nguyễn Như Kon Tum' },
          budget_vnd: 350000,
          people_count: 2,
          vibes: ['photo_spot', 'interactive_activity'],
          nutrition_goal: 'eat_clean',
        }),
      });
      assert.equal(genRes.status, 200);
      assert.equal(genRes.headers.get('x-ai-source'), 'fallback');
      const generated = await genRes.json();
      assertItineraryContract(generated);

      const replanRes = await fetch(`${srv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_itinerary: generated,
          target_stop_order: 2,
          reason: 'rainy_weather',
          new_budget_vnd: 350000,
        }),
      });
      assert.equal(replanRes.status, 200);
      assert.equal(replanRes.headers.get('x-ai-source'), 'fallback');
      const replanned = await replanRes.json();
      assertItineraryContract(replanned);

      assert.equal(replanned.itinerary_id, generated.itinerary_id);
      assert.equal(replanned.share_url, generated.share_url);
      const stop2 = replanned.stops.find((s) => s.order === 2);
      assert.ok(stop2);
      assert.equal(stop2.indoor, true);
    } finally {
      await srv.close();
    }
  });

  it('Test 4 & 5: Share page (/s/:code & /s/demo), RSVP join, and live stats (/api/v1/stats & /admin/stats)', async () => {
    const shareStorePath = path.join(tmpDir, 'share-store.json');
    const app = createApp({
      aiServiceUrl: mockFastApi.url,
      storePath: shareStorePath,
      useOsrm: false,
    });
    const srv = await listenServer(app);
    try {
      // Create an itinerary
      const genRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_vnd: 350000 }),
      });
      const created = await genRes.json();
      const shortCode = created.share_url.split('/s/')[1];
      assert.ok(shortCode);

      // View /s/:code
      const pageRes = await fetch(`${srv.url}/s/${shortCode}`);
      assert.equal(pageRes.status, 200);
      const pageHtml = await pageRes.text();
      assert.ok(pageHtml.includes('leaflet.js'));
      assert.ok(pageHtml.includes('Chiều Thanh Xuân Chuẩn AI FastAPI'));
      assert.ok(pageHtml.includes('Chốt tham gia kèo này!'));

      // View /s/demo
      const demoRes = await fetch(`${srv.url}/s/demo`);
      assert.equal(demoRes.status, 200);
      const demoHtml = await demoRes.text();
      assert.ok(demoHtml.includes('Chiều Thanh Xuân Nhẹ Nhàng &amp; Eat Clean (Demo)'));

      // Participant joins via RSVP API (including XSS check)
      const joinRes = await fetch(`${srv.url}/api/v1/share/${shortCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Minh Anh',
          status: 'going',
          note: 'Có mặt đúng 14h!',
        }),
      });
      assert.equal(joinRes.status, 200);
      const joined = await joinRes.json();
      assert.equal(joined.ok, true);
      assert.equal(joined.participants_count, 1);
      assert.equal(joined.participants[0].name, 'Minh Anh');

      // Re-render page and verify participant shows up cleanly
      const pageAfterRes = await fetch(`${srv.url}/s/${shortCode}`);
      const pageAfterHtml = await pageAfterRes.text();
      assert.ok(pageAfterHtml.includes('Minh Anh'));

      // Trigger one replan
      await fetch(`${srv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_itinerary: created,
          target_stop_order: 2,
          reason: 'rainy_weather',
        }),
      });

      // Verify XSS payload is safely escaped in rendered HTML
      await fetch(`${srv.url}/api/v1/share/${shortCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '<script>xss</script>',
          status: 'coming_soon',
          note: 'Test <b>bold</b>',
        }),
      });
      const xssCheckRes = await fetch(`${srv.url}/s/${shortCode}`);
      const xssHtml = await xssCheckRes.text();
      assert.ok(!xssHtml.includes('<script>xss</script>'));
      assert.ok(xssHtml.includes('&lt;script&gt;xss&lt;/script&gt;'));

      // Check JSON stats
      const statsRes = await fetch(`${srv.url}/api/v1/stats`);
      assert.equal(statsRes.status, 200);
      const stats = await statsRes.json();
      assert.equal(stats.total_itineraries_generated, 1);
      assert.equal(stats.total_replans, 1);
      assert.equal(stats.replan_reasons.rainy_weather, 1);
      assert.equal(stats.total_share_views, 3);
      assert.equal(stats.total_participants_joined, 2);
      assert.equal(stats.estimated_active_users, 3);

      // Check HTML Judge Dashboard
      const dashRes = await fetch(`${srv.url}/admin/stats`);
      assert.equal(dashRes.status, 200);
      const dashHtml = await dashRes.text();
      assert.ok(dashHtml.includes('Dayout AI — Live Traction &amp; System Telemetry'));
      assert.ok(dashHtml.includes(`#${shortCode}`));
    } finally {
      await srv.close();
    }
  });

  it('Test 6: Global toolbar replan without target_stop_order auto-selects outdoor or priciest stop', async () => {
    const smartStorePath = path.join(tmpDir, 'smart-replan-store.json');
    const app = createApp({
      aiServiceUrl: 'http://127.0.0.1:59999',
      storePath: smartStorePath,
      useOsrm: false,
    });
    const srv = await listenServer(app);
    try {
      const baseItinerary = {
        itinerary_id: 'itin_custom_outdoor_1',
        share_url: `${srv.url}/s/test1`,
        summary: {
          title: 'Test Smart Replan',
          total_cost_per_person_vnd: 230000,
          budget_per_person_vnd: 300000,
          total_calories_kcal: 650,
          nutrition_badge: 'Cân bằng',
          total_distance_km: 2.5,
          total_travel_minutes: 10,
        },
        route_polyline: [
          [21.0012, 105.8035],
          [20.9998, 105.8042],
          [21.0148, 105.8135],
        ],
        stops: [
          {
            order: 1,
            stop_id: 'poi_tx_cafe_04',
            start_time: '14:00',
            end_time: '15:30',
            name: 'Kafa Cafe - Nguyễn Tuân',
            category: 'cafe',
            address: '90 Nguyễn Tuân',
            lat: 20.9998,
            lng: 105.8042,
            indoor: false, // Stop 1 is OUTDOOR!
            recommended_items: ['Bạc xỉu'],
            estimated_cost_vnd: 45000,
            estimated_calories_kcal: 160,
            nutrition_note: 'Thoáng mát',
            ai_reason: 'Vỉa hè',
            distance_to_next_km: 1.5,
            travel_to_next_minutes: 6,
          },
          {
            order: 2,
            stop_id: 'poi_tx_food_04',
            start_time: '16:00',
            end_time: '18:00',
            name: 'Poke & Grain Bowl - Láng Hạ',
            category: 'food',
            address: '101 Láng Hạ',
            lat: 21.0148,
            lng: 105.8135,
            indoor: true, // Stop 2 is already indoor, but expensive (135k)
            recommended_items: ['Salmon Poke Bowl'],
            estimated_cost_vnd: 135000,
            estimated_calories_kcal: 490,
            nutrition_note: 'Giàu đạm',
            ai_reason: 'Healthy',
            distance_to_next_km: 0,
            travel_to_next_minutes: 0,
          },
        ],
      };

      // Omit target_stop_order for rainy_weather -> should automatically swap Stop 1 (outdoor) to indoor!
      const rainRes = await fetch(`${srv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_itinerary: baseItinerary,
          reason: 'rainy_weather',
        }),
      });
      assert.equal(rainRes.status, 200);
      const rainPlan = await rainRes.json();
      assert.equal(rainPlan.stops[0].indoor, true);
      assert.notEqual(rainPlan.stops[0].stop_id, 'poi_tx_cafe_04');
      assert.equal(rainPlan.stops[1].stop_id, 'poi_tx_food_04'); // kept intact

      // Omit target_stop_order for tighter_budget -> should automatically swap Stop 2 (135k priciest) to cheaper!
      const budgetRes = await fetch(`${srv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_itinerary: rainPlan,
          reason: 'tighter_budget',
          new_budget_vnd: 200000,
        }),
      });
      assert.equal(budgetRes.status, 200);
      const budgetPlan = await budgetRes.json();
      assert.ok(budgetPlan.stops[1].estimated_cost_vnd < 135000);
    } finally {
      await srv.close();
    }
  });

  it('Test 7: Malformed JSON returns 400 JSON (no server crash), CORS OPTIONS works, and unknown share code returns friendly 404', async () => {
    const edgeStorePath = path.join(tmpDir, 'edge-store.json');
    const app = createApp({
      aiServiceUrl: mockFastApi.url,
      storePath: edgeStorePath,
      useOsrm: false,
    });
    const srv = await listenServer(app);
    try {
      // Malformed JSON
      const badJsonRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"budget_vnd": 350000, bad_json',
      });
      assert.equal(badJsonRes.status, 400);
      const badData = await badJsonRes.json();
      assert.equal(badData.error, 'Invalid JSON payload');

      // CORS preflight OPTIONS
      const optRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:8081',
          'Access-Control-Request-Method': 'POST',
        },
      });
      assert.ok(optRes.status === 204 || optRes.status === 200);
      assert.equal(optRes.headers.get('access-control-allow-origin'), '*');

      // Friendly 404 share page
      const missingRes = await fetch(`${srv.url}/s/zzzzz`);
      assert.equal(missingRes.status, 404);
      const missingHtml = await missingRes.text();
      assert.ok(missingHtml.includes('Không tìm thấy mã kèo'));
    } finally {
      await srv.close();
    }
  });

  it('Test 8: Contract edge cases (null inputs, empty vibes, null distances -> Haversine, empty stops -> fallback, empty current_itinerary + store hydration, Hoan Kiem origin preservation, timeout, CORS expose, HTML form validation)', async () => {
    let mode = 'null-distance';
    let lastGenPayload = null;
    let lastReplanPayload = null;

    const customFastApi = await listenServer((req, res) => {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
      });
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/ai/generate') {
          lastGenPayload = JSON.parse(bodyStr || '{}');
          if (mode === 'empty-stops') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ stops: [] }));
            return;
          }
          if (mode === 'slow') {
            setTimeout(() => {
              if (!res.writableEnded) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ stops: [] }));
              }
            }, 250);
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              summary: {
                title: 'Lộ trình Hoàn Kiếm Null-Safe',
                total_cost_per_person_vnd: null,
                budget_per_person_vnd: null,
                total_calories_kcal: null,
                total_distance_km: null,
                total_travel_minutes: null,
              },
              stops: [
                {
                  order: 1,
                  stop_id: 'hk_stop_1',
                  name: 'Cafe Phố Cổ',
                  category: 'cafe',
                  address: '11 Hàng Gai, Hoàn Kiếm, Hà Nội',
                  lat: 21.0322,
                  lng: 105.8502,
                  indoor: true,
                  estimated_cost_vnd: 65000,
                  estimated_calories_kcal: 150,
                  distance_to_next_km: null,
                  travel_to_next_minutes: null,
                },
                {
                  order: 2,
                  stop_id: 'hk_stop_2',
                  name: 'Hồ Hoàn Kiếm',
                  category: 'activity',
                  address: 'Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',
                  lat: 21.0288,
                  lng: 105.8525,
                  indoor: false,
                  estimated_cost_vnd: 20000,
                  estimated_calories_kcal: 0,
                  distance_to_next_km: null,
                  travel_to_next_minutes: null,
                },
              ],
            }),
          );
          return;
        }

        if (req.method === 'POST' && req.url === '/ai/replan') {
          lastReplanPayload = JSON.parse(bodyStr || '{}');
          if (mode === 'empty-stops') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ stops: [] }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              summary: {
                title: 'Lộ trình Hoàn Kiếm Sau Replan',
                budget_per_person_vnd: 350000,
              },
              // Omit route_polyline on purpose to verify origin preservation
              stops: [
                {
                  order: 1,
                  stop_id: 'hk_stop_1',
                  name: 'Cafe Phố Cổ',
                  category: 'cafe',
                  address: '11 Hàng Gai, Hoàn Kiếm, Hà Nội',
                  lat: 21.0322,
                  lng: 105.8502,
                  indoor: true,
                  estimated_cost_vnd: 65000,
                  estimated_calories_kcal: 150,
                  distance_to_next_km: null,
                  travel_to_next_minutes: null,
                },
                {
                  order: 2,
                  stop_id: 'hk_stop_2_indoor',
                  name: 'Bảo tàng Lịch sử Quốc gia',
                  category: 'activity',
                  address: '1 Tràng Tiền, Hoàn Kiếm, Hà Nội',
                  lat: 21.0247,
                  lng: 105.8597,
                  indoor: true,
                  estimated_cost_vnd: 40000,
                  estimated_calories_kcal: 0,
                  distance_to_next_km: 0,
                  travel_to_next_minutes: 0,
                },
              ],
            }),
          );
          return;
        }

        res.writeHead(404);
        res.end('Not Found');
      });
    });

    const test8StorePath = path.join(tmpDir, 'test8-store.json');
    const app = createApp({
      aiServiceUrl: customFastApi.url,
      storePath: test8StorePath,
      useOsrm: false,
      aiTimeoutMs: 80,
    });
    const strictApp = createApp({
      aiServiceUrl: customFastApi.url,
      storePath: path.join(tmpDir, 'test8-strict-store.json'),
      useOsrm: false,
      allowFallback: false,
      aiTimeoutMs: 80,
    });

    const srv = await listenServer(app);
    const strictSrv = await listenServer(strictApp);

    try {
      // 1. Null lat/lng/budget/people, whitespace-only vibes, and null distances from FastAPI
      mode = 'null-distance';
      const nullRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:8081',
        },
        body: JSON.stringify({
          origin: { lat: null, lng: null, label: '' },
          budget_vnd: null,
          people_count: null,
          vibes: ['   ', ''],
        }),
      });
      assert.equal(nullRes.status, 200);
      assert.equal(nullRes.headers.get('x-ai-source'), 'fastapi');
      assert.match(nullRes.headers.get('access-control-expose-headers') || '', /X-AI-Source/i);

      assert.equal(lastGenPayload.origin.lat, 21.0012);
      assert.equal(lastGenPayload.origin.lng, 105.8035);
      assert.equal(lastGenPayload.budget_vnd, 350000);
      assert.equal(lastGenPayload.people_count, 2);
      assert.deepEqual(lastGenPayload.vibes, ['chill_cafe', 'interactive_activity', 'local_food']);

      const nullData = await nullRes.json();
      assertItineraryContract(nullData);
      assert.ok(nullData.stops[0].distance_to_next_km > 0);
      assert.ok(nullData.stops[0].travel_to_next_minutes >= 2);
      assert.ok(nullData.summary.total_distance_km > 0);
      assert.equal(nullData.summary.budget_per_person_vnd, 350000);
      assert.equal(nullData.summary.total_cost_per_person_vnd, 85000);

      // 2. FastAPI returns 200 { stops: [] } -> falls back on normal app, returns 502 on strict app
      mode = 'empty-stops';
      const emptyFallbackRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_vnd: 350000 }),
      });
      assert.equal(emptyFallbackRes.status, 200);
      assert.equal(emptyFallbackRes.headers.get('x-ai-source'), 'fallback');
      const emptyFallbackData = await emptyFallbackRes.json();
      assertItineraryContract(emptyFallbackData);

      const emptyStrictRes = await fetch(`${strictSrv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_vnd: 350000 }),
      });
      assert.equal(emptyStrictRes.status, 502);

      const emptyReplanFallbackRes = await fetch(`${srv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itinerary_id: emptyFallbackData.itinerary_id,
          current_itinerary: {},
          reason: 'rainy_weather',
        }),
      });
      assert.equal(emptyReplanFallbackRes.status, 200);
      assert.equal(emptyReplanFallbackRes.headers.get('x-ai-source'), 'fallback');

      const emptyReplanStrictRes = await fetch(`${strictSrv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_itinerary: emptyFallbackData,
          reason: 'rainy_weather',
        }),
      });
      assert.equal(emptyReplanStrictRes.status, 502);

      // 3. Slow upstream triggers aiTimeoutMs fallback
      mode = 'slow';
      const slowRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_vnd: 300000 }),
      });
      assert.equal(slowRes.status, 200);
      assert.equal(slowRes.headers.get('x-ai-source'), 'fallback');

      // 4. Create Hoan Kiem itinerary, then replan with current_itinerary: {} + itinerary_id and no route_polyline from AI
      mode = 'null-distance';
      const hkGenRes = await fetch(`${srv.url}/api/v1/itineraries/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 21.0285, lng: 105.8542, label: 'Hồ Hoàn Kiếm, Hà Nội' },
          budget_vnd: 350000,
        }),
      });
      assert.equal(hkGenRes.status, 200);
      const hkItinerary = await hkGenRes.json();
      assert.deepEqual(hkItinerary.route_polyline[0], [21.0285, 105.8542]);

      const hkReplanRes = await fetch(`${srv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itinerary_id: hkItinerary.itinerary_id,
          current_itinerary: {},
          reason: 'rainy_weather',
          new_budget_vnd: '',
        }),
      });
      assert.equal(hkReplanRes.status, 200);
      assert.equal(hkReplanRes.headers.get('x-ai-source'), 'fastapi');
      // Hydrated full current_itinerary from store and omitted empty new_budget_vnd
      assert.equal(lastReplanPayload.current_itinerary.itinerary_id, hkItinerary.itinerary_id);
      assert.ok(lastReplanPayload.current_itinerary.stops.length > 0);
      assert.equal(lastReplanPayload.new_budget_vnd, undefined);

      const hkReplanned = await hkReplanRes.json();
      assertItineraryContract(hkReplanned);
      assert.equal(hkReplanned.itinerary_id, hkItinerary.itinerary_id);
      assert.equal(hkReplanned.share_url, hkItinerary.share_url);
      assert.deepEqual(hkReplanned.route_polyline[0], [21.0285, 105.8542]);
      assert.ok(hkReplanned.stops[0].distance_to_next_km > 0);

      // 4b. Replan with current_itinerary holding only share_url (no stops, no top-level itinerary_id)
      const hintReplanRes = await fetch(`${srv.url}/api/v1/itineraries/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_itinerary: { share_url: hkItinerary.share_url },
          reason: 'crowded',
        }),
      });
      assert.equal(hintReplanRes.status, 200);
      assert.equal(lastReplanPayload.current_itinerary.itinerary_id, hkItinerary.itinerary_id);
      const hintReplanned = await hintReplanRes.json();
      assert.equal(hintReplanned.itinerary_id, hkItinerary.itinerary_id);
      assert.deepEqual(hintReplanned.route_polyline[0], [21.0285, 105.8542]);

      // 5. HTML form submission with whitespace name redirects 303 instead of raw JSON, and missing code returns 404 HTML
      const shortCode = hkItinerary.share_url.split('/s/')[1];
      const blankFormRes = await fetch(`${srv.url}/api/v1/share/${shortCode}/join`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml',
        },
        body: 'name=%20%20%20&status=going',
      });
      assert.equal(blankFormRes.status, 303);
      assert.equal(blankFormRes.headers.get('location'), `/s/${shortCode}`);

      const blankDemoFormRes = await fetch(`${srv.url}/api/v1/share/demo/join`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml',
        },
        body: 'name=%20%20&status=going',
      });
      assert.equal(blankDemoFormRes.status, 303);
      assert.equal(blankDemoFormRes.headers.get('location'), '/s/demo');

      const missingFormRes = await fetch(`${srv.url}/api/v1/share/zzzzz/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml',
        },
        body: 'name=An',
      });
      assert.equal(missingFormRes.status, 404);
      const missingFormHtml = await missingFormRes.text();
      assert.ok(missingFormHtml.includes('Không tìm thấy mã kèo'));
    } finally {
      await srv.close();
      await strictSrv.close();
      await customFastApi.close();
    }
  });
});
