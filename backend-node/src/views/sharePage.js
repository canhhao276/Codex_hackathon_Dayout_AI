import { escapeHtml, formatVnd, safeJsonForScript } from './htmlUtils.js';

const CATEGORY_LABELS = {
  cafe: 'Cafe',
  activity: 'Hoạt động',
  food: 'Ăn uống',
  dessert_chill: 'Tráng miệng & Chill',
};

const STATUS_BADGE = {
  going: { label: 'Chốt đi!', cls: 'going' },
  coming_soon: { label: 'Đang qua', cls: 'soon' },
  suggest_change: { label: 'Góp ý đổi quán', cls: 'suggest' },
};

/**
 * Render friendly 404 HTML when a shared itinerary code does not exist.
 */
export function renderNotFoundSharePage(code, baseUrl) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Không tìm thấy kèo đi chơi — Dayout AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { max-width: 420px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 28px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
    h1 { font-size: 20px; margin: 0 0 10px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px; }
    a { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #fff; text-decoration: none; font-weight: 700; padding: 12px 20px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Không tìm thấy mã kèo "${escapeHtml(code)}"</h1>
    <p>Lịch trình có thể đã hết hạn hoặc server vừa khởi động lại. Bạn có thể xem lịch trình mẫu ngay bên dưới.</p>
    <a href="${escapeHtml(baseUrl)}/s/demo">Xem Thẻ Kèo Mẫu (Thanh Xuân)</a>
  </div>
</body>
</html>`;
}

/**
 * Render mobile-first Viral Group Share Card (/s/:code) with interactive Leaflet map and RSVP form.
 */
export function renderSharePage({ record, itinerary, baseUrl }) {
  const summary = itinerary.summary || {};
  const stops = Array.isArray(itinerary.stops) ? itinerary.stops : [];
  const participants = Array.isArray(record.participants) ? record.participants : [];
  const code = record.shortCode || 'demo';
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  const shareUrl = itinerary.share_url || `${cleanBase}/s/${code}`;

  const budget = Number(summary.budget_per_person_vnd) || 0;
  const cost = Number(summary.total_cost_per_person_vnd) || 0;
  const saved = Math.max(0, budget - cost);

  const stopsHtml = stops
    .map((stop, idx) => {
      const catLabel = CATEGORY_LABELS[stop.category] || stop.category || 'Điểm dừng';
      const itemsHtml = (stop.recommended_items || [])
        .map((item) => `<span class="item-chip">${escapeHtml(item)}</span>`)
        .join('');
      const indoorBadge = stop.indoor
        ? '<span class="tag indoor">Trong nhà</span>'
        : '<span class="tag outdoor">Ngoài trời</span>';
      const legHtml =
        idx < stops.length - 1 && (stop.distance_to_next_km || stop.travel_to_next_minutes)
          ? `<div class="leg-info">Di chuyển chặng kế: <strong>${escapeHtml(stop.distance_to_next_km)} km</strong> • ~${escapeHtml(stop.travel_to_next_minutes)} phút</div>`
          : '';

      return `
        <article class="stop-card" data-lat="${escapeHtml(stop.lat)}" data-lng="${escapeHtml(stop.lng)}" data-order="${escapeHtml(stop.order)}">
          <div class="stop-head">
            <div class="stop-num">${escapeHtml(stop.order)}</div>
            <div class="stop-meta">
              <div class="stop-time">${escapeHtml(stop.start_time)} – ${escapeHtml(stop.end_time)} • <span class="cat">${escapeHtml(catLabel)}</span> ${indoorBadge}</div>
              <h3>${escapeHtml(stop.name)}</h3>
              <p class="addr">${escapeHtml(stop.address)}</p>
            </div>
          </div>
          <div class="stop-metrics">
            <span class="metric cost">${formatVnd(stop.estimated_cost_vnd)}</span>
            <span class="metric kcal">${escapeHtml(stop.estimated_calories_kcal)} kcal</span>
          </div>
          <div class="items-row">${itemsHtml}</div>
          ${stop.nutrition_note ? `<div class="note-line">🥗 ${escapeHtml(stop.nutrition_note)}</div>` : ''}
          ${stop.ai_reason ? `<div class="ai-line">✨ AI chọn: ${escapeHtml(stop.ai_reason)}</div>` : ''}
          ${legHtml}
        </article>`;
    })
    .join('');

  const participantsHtml =
    participants.length > 0
      ? participants
          .map((p) => {
            const st = STATUS_BADGE[p.status] || STATUS_BADGE.going;
            return `<div class="pt-pill">
              <span class="pt-name">${escapeHtml(p.name)}</span>
              <span class="pt-status ${st.cls}">${escapeHtml(st.label)}</span>
              ${p.note ? `<span class="pt-note">“${escapeHtml(p.note)}”</span>` : ''}
            </div>`;
          })
          .join('')
      : '<p class="empty-pt" id="emptyPtMsg">Chưa có ai chốt — hãy là người đầu tiên tham gia kèo này!</p>';

  const mapPayload = safeJsonForScript({
    stops: stops.map((s) => ({
      order: s.order,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      cost: s.estimated_cost_vnd,
      kcal: s.estimated_calories_kcal,
      time: `${s.start_time}-${s.end_time}`,
    })),
    polyline: itinerary.route_polyline || [],
  });

  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>${escapeHtml(summary.title || 'Thẻ Chốt Kèo — Dayout AI')}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    :root {
      --bg: #f8fafc;
      --card: #ffffff;
      --ink: #0f172a;
      --muted: #64748b;
      --accent: #059669;
      --accent-soft: #ecfdf5;
      --blue: #2563eb;
      --amber: #d97706;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--ink);
      padding-bottom: 40px;
    }
    .shell {
      max-width: 520px;
      margin: 0 auto;
      background: var(--bg);
    }
    .topbar {
      background: linear-gradient(135deg, #064e3b 0%, #059669 60%, #10b981 100%);
      color: #fff;
      padding: 16px 16px 18px;
      border-bottom-left-radius: 22px;
      border-bottom-right-radius: 22px;
      box-shadow: 0 10px 25px rgba(5, 150, 105, 0.22);
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      opacity: 0.95;
      margin-bottom: 8px;
    }
    .brand-pill {
      background: rgba(255,255,255,0.18);
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .replan-pill {
      background: #fef3c7;
      color: #92400e;
      padding: 3px 9px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 11px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 20px;
      line-height: 1.3;
      font-weight: 800;
    }
    .action-strip {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .btn-ghost {
      flex: 1;
      border: 1px solid rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.15);
      color: #fff;
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .map-wrap {
      margin: 12px 14px;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid var(--border);
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
      background: #e2e8f0;
    }
    #map {
      width: 100%;
      height: 235px;
    }
    .hud-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 0 14px 12px;
    }
    .hud-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 12px;
      box-shadow: 0 2px 10px rgba(15,23,42,0.04);
    }
    .hud-label {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .hud-val {
      font-size: 17px;
      font-weight: 800;
      color: var(--ink);
    }
    .hud-sub {
      font-size: 12px;
      color: var(--accent);
      font-weight: 600;
      margin-top: 2px;
    }
    .hud-badge {
      grid-column: 1 / -1;
      background: var(--accent-soft);
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 12px;
      padding: 9px 12px;
      font-size: 12.5px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .section-title {
      margin: 16px 16px 8px;
      font-size: 14px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rsvp-card {
      margin: 0 14px 16px;
      background: var(--card);
      border: 1.5px solid #10b981;
      border-radius: 18px;
      padding: 14px;
      box-shadow: 0 6px 22px rgba(16, 185, 129, 0.12);
    }
    .rsvp-card h2 {
      margin: 0 0 6px;
      font-size: 16px;
    }
    .rsvp-sub {
      font-size: 12.5px;
      color: var(--muted);
      margin: 0 0 12px;
    }
    .pt-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .pt-pill {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 6px 10px;
      font-size: 12px;
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .pt-name { font-weight: 700; }
    .pt-status { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
    .pt-status.going { background: #dcfce7; color: #166534; }
    .pt-status.soon { background: #dbeafe; color: #1e40af; }
    .pt-status.suggest { background: #fef3c7; color: #92400e; }
    .pt-note { color: var(--muted); font-style: italic; }
    .empty-pt { font-size: 12.5px; color: var(--muted); margin: 0 0 10px; }
    .form-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font-size: 14px;
      outline: none;
    }
    input[type="text"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
    }
    .status-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .chip-opt {
      flex: 1;
      min-width: 90px;
      text-align: center;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 10px;
      padding: 7px 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .chip-opt.active {
      background: #ecfdf5;
      border-color: #059669;
      color: #065f46;
    }
    .btn-primary {
      width: 100%;
      border: none;
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff;
      font-size: 14.5px;
      font-weight: 800;
      padding: 12px;
      border-radius: 12px;
      cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.6; }
    .feedback-msg {
      margin-top: 8px;
      font-size: 12.5px;
      font-weight: 700;
      color: #065f46;
      display: none;
    }
    .stops-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0 14px;
    }
    .stop-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 13px;
      cursor: pointer;
      transition: border-color 0.15s ease, transform 0.1s ease;
    }
    .stop-card:hover {
      border-color: #10b981;
    }
    .stop-head {
      display: flex;
      gap: 11px;
      align-items: flex-start;
    }
    .stop-num {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font-weight: 800;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }
    .stop-meta { flex: 1; }
    .stop-time {
      font-size: 11.5px;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 3px;
    }
    .cat { color: var(--blue); font-weight: 700; }
    .tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 700;
      margin-left: 4px;
    }
    .tag.indoor { background: #e0f2fe; color: #0369a1; }
    .tag.outdoor { background: #fef3c7; color: #92400e; }
    .stop-card h3 {
      margin: 0 0 3px;
      font-size: 15.5px;
      line-height: 1.3;
    }
    .addr {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
    }
    .stop-metrics {
      display: flex;
      gap: 8px;
      margin-top: 9px;
    }
    .metric {
      font-size: 12px;
      font-weight: 800;
      padding: 4px 9px;
      border-radius: 8px;
    }
    .metric.cost { background: #eff6ff; color: #1d4ed8; }
    .metric.kcal { background: #fef2f2; color: #b91c1c; }
    .items-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .item-chip {
      background: #f1f5f9;
      color: #334155;
      font-size: 11.5px;
      padding: 3px 8px;
      border-radius: 8px;
      font-weight: 600;
    }
    .note-line, .ai-line {
      font-size: 12px;
      margin-top: 6px;
      color: #475569;
      line-height: 1.45;
    }
    .leg-info {
      margin-top: 8px;
      padding-top: 7px;
      border-top: 1px dashed #e2e8f0;
      font-size: 11.5px;
      color: var(--muted);
    }
    .custom-pin {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #059669;
      color: #ffffff;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.72);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 9999;
    }
    .modal-backdrop.open { display: flex; }
    .modal-box {
      background: #fff;
      border-radius: 20px;
      padding: 20px;
      max-width: 320px;
      width: 100%;
      text-align: center;
    }
    .modal-box img {
      width: 200px;
      height: 200px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      margin: 10px auto;
      display: block;
    }
    .modal-url {
      font-size: 11px;
      word-break: break-all;
      color: var(--muted);
      background: #f8fafc;
      padding: 8px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand-row">
        <span class="brand-pill">Dayout AI • Thẻ Chốt Kèo</span>
        ${Number(record.replan_count) > 0 ? `<span class="replan-pill">Đã AI tối ưu lại ${escapeHtml(record.replan_count)} lần</span>` : `<span>Mã kèo: #${escapeHtml(code)}</span>`}
      </div>
      <h1>${escapeHtml(summary.title || 'Lịch Trình Đi Chơi Dayout AI')}</h1>
      <div class="action-strip">
        <button type="button" class="btn-ghost" id="copyBtn">📋 Sao chép link</button>
        <button type="button" class="btn-ghost" id="qrBtn">📱 Hiện mã QR</button>
      </div>
    </header>

    <section class="map-wrap">
      <div id="map"></div>
    </section>

    <section class="hud-grid">
      <div class="hud-box">
        <div class="hud-label">Chi phí / người</div>
        <div class="hud-val">${formatVnd(cost)}</div>
        <div class="hud-sub">${saved > 0 ? `Tiết kiệm ${formatVnd(saved)} / ${formatVnd(budget)}` : `Ngân sách ${formatVnd(budget)}`}</div>
      </div>
      <div class="hud-box">
        <div class="hud-label">Dinh dưỡng & Lộ trình</div>
        <div class="hud-val">${escapeHtml(summary.total_calories_kcal || 0)} kcal</div>
        <div class="hud-sub">${escapeHtml(summary.total_distance_km || 0)} km • ~${escapeHtml(summary.total_travel_minutes || 0)} phút đi</div>
      </div>
      <div class="hud-badge">
        <span>🥗 ${escapeHtml(summary.nutrition_badge || 'Cân bằng dinh dưỡng')}</span>
        <span>${stops.length} chặng</span>
      </div>
    </section>

    <section class="rsvp-card">
      <h2>🙋 Chốt tham gia kèo này (<span id="ptCount">${participants.length}</span> người)</h2>
      <p class="rsvp-sub">Không cần cài app — nhập tên để bạn bè biết bạn chốt đi cùng!</p>
      <div class="pt-list" id="ptList">${participantsHtml}</div>
      <form class="form-row" id="joinForm" action="/api/v1/share/${encodeURIComponent(code)}/join" method="post">
        <input type="text" id="ptName" name="name" maxlength="50" placeholder="Tên của bạn (VD: Minh Anh)" required />
        <div class="status-chips">
          <button type="button" class="chip-opt active" data-val="going">✅ Chốt đi!</button>
          <button type="button" class="chip-opt" data-val="coming_soon">🛵 Đang qua</button>
          <button type="button" class="chip-opt" data-val="suggest_change">💬 Góp ý</button>
        </div>
        <input type="text" id="ptNote" name="note" maxlength="120" placeholder="Lời nhắn ngắn (không bắt buộc)" />
        <button type="submit" class="btn-primary" id="submitBtn">Chốt tham gia kèo này!</button>
      </form>
      <div class="feedback-msg" id="feedbackMsg"></div>
    </section>

    <div class="section-title">
      <span>Lộ trình chi tiết (Bấm để phóng to bản đồ)</span>
    </div>
    <section class="stops-list">
      ${stopsHtml}
    </section>
  </div>

  <div class="modal-backdrop" id="qrModal">
    <div class="modal-box">
      <h3 style="margin:0 0 4px;">Quét QR để tham gia kèo</h3>
      <p style="margin:0;font-size:12px;color:#64748b;">Đưa mã này cho bạn bè hoặc người dùng thử</p>
      <img src="${escapeHtml(qrImgUrl)}" alt="QR Code Kèo Dayout AI" onerror="this.style.display='none'" />
      <div class="modal-url">${escapeHtml(shareUrl)}</div>
      <button type="button" class="btn-primary" id="closeQrBtn">Đóng</button>
    </div>
  </div>

  <script>
    const MAP_DATA = ${mapPayload};
    const SHARE_CODE = ${safeJsonForScript(code)};
    const SHARE_URL = ${safeJsonForScript(shareUrl)};

    // Initialize free Leaflet + CartoDB Voyager map (no API key needed)
    (function initMap() {
      if (typeof L === 'undefined') return;
      const defaultCenter = [21.0012, 105.8035];
      const map = L.map('map', { zoomControl: true }).setView(defaultCenter, 14);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
      }).addTo(map);

      const markersByOrder = {};
      const boundsPts = [];

      if (Array.isArray(MAP_DATA.polyline) && MAP_DATA.polyline.length >= 2) {
        L.polyline(MAP_DATA.polyline, {
          color: '#059669',
          weight: 4,
          opacity: 0.85
        }).addTo(map);
        MAP_DATA.polyline.forEach((pt) => boundsPts.push(pt));
      }

      (MAP_DATA.stops || []).forEach((stop) => {
        const icon = L.divIcon({
          className: '',
          html: '<div class="custom-pin">' + Number(stop.order) + '</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map);
        marker.bindPopup(
          '<strong>' + stop.order + '. ' + escapeClient(stop.name) + '</strong><br/>' +
          escapeClient(stop.time) + ' • ' + Number(stop.cost).toLocaleString('vi-VN') + 'đ • ' + Number(stop.kcal) + ' kcal'
        );
        markersByOrder[stop.order] = marker;
        boundsPts.push([stop.lat, stop.lng]);
      });

      if (boundsPts.length > 0) {
        map.fitBounds(boundsPts, { padding: [26, 26] });
      }

      document.querySelectorAll('.stop-card').forEach((card) => {
        card.addEventListener('click', () => {
          const lat = Number(card.getAttribute('data-lat'));
          const lng = Number(card.getAttribute('data-lng'));
          const order = Number(card.getAttribute('data-order'));
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            map.flyTo([lat, lng], 16, { duration: 0.6 });
            if (markersByOrder[order]) markersByOrder[order].openPopup();
          }
        });
      });
    })();

    function escapeClient(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Copy link & QR modal
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(SHARE_URL);
        copyBtn.textContent = '✅ Đã sao chép link!';
        setTimeout(() => { copyBtn.textContent = '📋 Sao chép link'; }, 2000);
      } catch {
        prompt('Sao chép đường dẫn kèo:', SHARE_URL);
      }
    });

    const qrModal = document.getElementById('qrModal');
    document.getElementById('qrBtn').addEventListener('click', () => qrModal.classList.add('open'));
    document.getElementById('closeQrBtn').addEventListener('click', () => qrModal.classList.remove('open'));
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) qrModal.classList.remove('open');
    });

    // Interactive RSVP join flow
    let selectedStatus = 'going';
    document.querySelectorAll('.chip-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-opt').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedStatus = btn.getAttribute('data-val') || 'going';
      });
    });

    const statusMeta = {
      going: { label: 'Chốt đi!', cls: 'going' },
      coming_soon: { label: 'Đang qua', cls: 'soon' },
      suggest_change: { label: 'Góp ý đổi quán', cls: 'suggest' }
    };

    document.getElementById('joinForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('ptName');
      const noteInput = document.getElementById('ptNote');
      const submitBtn = document.getElementById('submitBtn');
      const feedbackMsg = document.getElementById('feedbackMsg');
      const name = nameInput.value.trim();
      if (!name) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang lưu...';
      try {
        const res = await fetch('/api/v1/share/' + encodeURIComponent(SHARE_CODE) + '/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            status: selectedStatus,
            note: noteInput.value.trim()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không thể tham gia');

        const list = document.getElementById('ptList');
        list.innerHTML = (data.participants || []).map((p) => {
          const st = statusMeta[p.status] || statusMeta.going;
          const noteHtml = p.note ? '<span class="pt-note">“' + escapeClient(p.note) + '”</span>' : '';
          return '<div class="pt-pill"><span class="pt-name">' + escapeClient(p.name) +
            '</span><span class="pt-status ' + st.cls + '">' + escapeClient(st.label) + '</span>' + noteHtml + '</div>';
        }).join('');
        document.getElementById('ptCount').textContent = String((data.participants || []).length);
        nameInput.value = '';
        noteInput.value = '';
        feedbackMsg.textContent = '🎉 Đã chốt tham gia thành công!';
        feedbackMsg.style.display = 'block';
      } catch (err) {
        feedbackMsg.textContent = '⚠️ ' + (err.message || 'Có lỗi xảy ra');
        feedbackMsg.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Chốt tham gia kèo này!';
      }
    });
  </script>
</body>
</html>`;
}
