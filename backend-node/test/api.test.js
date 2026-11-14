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
});
