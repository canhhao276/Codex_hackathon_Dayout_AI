import { escapeHtml, formatVnd, safeJsonForScript } from './htmlUtils.js';

/**
 * Render live Hackathon Judge Traction Dashboard for GET /admin/stats.
 */
export function renderStatsDashboard({ stats, aiHealth, baseUrl }) {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  const reasons = stats.replan_reasons || {};
  const recent = Array.isArray(stats.recent_itineraries) ? stats.recent_itineraries : [];
  const aiOnline = Boolean(aiHealth?.online);

  const recentRows =
    recent.length > 0
      ? recent
          .map(
            (r) => `<tr>
              <td><a href="${escapeHtml(r.share_url)}" target="_blank">${escapeHtml(r.title)}</a><div class="sub">#${escapeHtml(r.share_code)} • nguồn: ${escapeHtml(r.ai_source)}</div></td>
              <td>${formatVnd(r.cost)} <span class="sub">/ ${formatVnd(r.budget)}</span></td>
              <td>${escapeHtml(r.calories)} kcal</td>
              <td><strong>${escapeHtml(r.participants_count)}</strong> người chốt <span class="sub">(${escapeHtml(r.views)} lượt xem)</span></td>
              <td>${escapeHtml(r.replan_count)} lượt</td>
            </tr>`,
          )
          .join('')
      : '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">Chưa có lịch trình mới — hãy tạo từ Mobile App hoặc mở <a href="/s/demo">/s/demo</a></td></tr>';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dayout AI — Live Traction Dashboard (BGK)</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --border: #334155;
      --ink: #f8fafc;
      --muted: #94a3b8;
      --green: #10b981;
      --blue: #38bdf8;
      --amber: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--ink);
      padding: 24px 18px 48px;
    }
    .container { max-width: 1020px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 22px;
    }
    h1 { margin: 0; font-size: 24px; font-weight: 800; }
    .subtitle { color: var(--muted); font-size: 13.5px; margin-top: 4px; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
    }
    .status-pill.online {
      background: rgba(16,185,129,0.16);
      border: 1px solid #10b981;
      color: #34d399;
    }
    .status-pill.offline {
      background: rgba(245,158,11,0.18);
      border: 1px solid #f59e0b;
      color: #fbbf24;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .kpi {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
    }
    .kpi-label { font-size: 12px; color: var(--muted); font-weight: 700; text-transform: uppercase; }
    .kpi-val { font-size: 34px; font-weight: 800; margin: 8px 0 4px; color: var(--green); }
    .kpi-val.blue { color: var(--blue); }
    .kpi-val.amber { color: var(--amber); }
    .kpi-sub { font-size: 12.5px; color: var(--muted); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .panel h2 { margin: 0 0 12px; font-size: 16px; }
    .reason-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .reason-chip {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px 14px;
      font-size: 13px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    th, td { text-align: left; padding: 11px 10px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; }
    a { color: #34d399; text-decoration: none; font-weight: 700; }
    a:hover { text-decoration: underline; }
    .sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
    .quick-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
    .qbtn {
      background: #0f172a;
      border: 1px solid var(--border);
      color: #e2e8f0;
      padding: 7px 12px;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Dayout AI — Live Traction &amp; System Telemetry</h1>
        <div class="subtitle">Tự động cập nhật mỗi 5 giây • Public URL: <code>${escapeHtml(cleanBase)}</code></div>
      </div>
      <div class="status-pill ${aiOnline ? 'online' : 'offline'}" id="aiPill">
        <span>●</span>
        <span id="aiText">${aiOnline ? `FastAPI AI Online (${escapeHtml(aiHealth?.latency_ms ?? 0)}ms)` : 'Smart Spatial Fallback Ready (FastAPI Offline)'}</span>
      </div>
    </header>

    <section class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Lịch trình AI đã tạo</div>
        <div class="kpi-val" id="kGen">${escapeHtml(stats.total_itineraries_generated)}</div>
        <div class="kpi-sub">Số lộ trình lưu bền vững</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Lượt AI Re-plan Thời Gian Thực</div>
        <div class="kpi-val blue" id="kRep">${escapeHtml(stats.total_replans)}</div>
        <div class="kpi-sub">Đổi điểm mưa / ngân sách / calo</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Người dùng thực tế tương tác</div>
        <div class="kpi-val amber" id="kUsers">${escapeHtml(stats.estimated_active_users)}</div>
        <div class="kpi-sub"><span id="kJoin">${escapeHtml(stats.total_participants_joined)}</span> bạn bè đã chốt tham gia qua link Share</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Lượt mở thẻ Share trên Web</div>
        <div class="kpi-val" id="kViews">${escapeHtml(stats.total_share_views)}</div>
        <div class="kpi-sub">Viral loop qua Zalo / QR</div>
      </div>
    </section>

    <section class="panel">
      <h2>Phân bố lượt AI thích ứng theo ngữ cảnh (Re-plan)</h2>
      <div class="reason-row" id="reasonRow">
        <div class="reason-chip">🌧️ Trời mưa: <strong id="rRain">${escapeHtml(reasons.rainy_weather || 0)}</strong></div>
        <div class="reason-chip">💸 Giảm ngân sách: <strong id="rBudget">${escapeHtml(reasons.tighter_budget || 0)}</strong></div>
        <div class="reason-chip">🏃 Quán đông: <strong id="rCrowd">${escapeHtml(reasons.crowded || 0)}</strong></div>
        <div class="reason-chip">🥗 Giảm calo: <strong id="rCal">${escapeHtml(reasons.lower_calories || 0)}</strong></div>
        <div class="reason-chip">✨ Khác: <strong id="rOther">${escapeHtml(reasons.other || 0)}</strong></div>
      </div>
      <div class="quick-links">
        <a class="qbtn" href="/s/demo" target="_blank">Mở Thẻ Chốt Kèo Mẫu (/s/demo)</a>
        <a class="qbtn" href="/api/v1/stats" target="_blank">Xem JSON /api/v1/stats</a>
        <a class="qbtn" href="/health" target="_blank">Kiểm tra /health</a>
      </div>
    </section>

    <section class="panel">
      <h2>Lịch trình gần nhất (Cập nhật trực tiếp)</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Lịch trình & Link Share</th>
              <th>Chi phí / Ngân sách</th>
              <th>Dinh dưỡng</th>
              <th>Bạn bè chốt kèo</th>
              <th>Re-plan</th>
            </tr>
          </thead>
          <tbody id="recentBody">${recentRows}</tbody>
        </table>
      </div>
    </section>
  </div>

  <script>
    const INITIAL_BASE = ${safeJsonForScript(cleanBase)};
    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function fmtVnd(n) {
      return (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
    }
    async function refreshStats() {
      try {
        const res = await fetch('/api/v1/stats');
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('kGen').textContent = data.total_itineraries_generated ?? 0;
        document.getElementById('kRep').textContent = data.total_replans ?? 0;
        document.getElementById('kUsers').textContent = data.estimated_active_users ?? 0;
        document.getElementById('kJoin').textContent = data.total_participants_joined ?? 0;
        document.getElementById('kViews').textContent = data.total_share_views ?? 0;

        const r = data.replan_reasons || {};
        document.getElementById('rRain').textContent = r.rainy_weather ?? 0;
        document.getElementById('rBudget').textContent = r.tighter_budget ?? 0;
        document.getElementById('rCrowd').textContent = r.crowded ?? 0;
        document.getElementById('rCal').textContent = r.lower_calories ?? 0;
        document.getElementById('rOther').textContent = r.other ?? 0;

        if (data.ai_service) {
          document.getElementById('aiPill').className = 'status-pill ' + (data.ai_service.online ? 'online' : 'offline');
          document.getElementById('aiText').textContent = data.ai_service.online
            ? 'FastAPI AI Online (' + (data.ai_service.latency_ms ?? 0) + 'ms)'
            : 'Smart Spatial Fallback Ready (FastAPI Offline)';
        }

        const recent = data.recent_itineraries || [];
        if (recent.length > 0) {
          document.getElementById('recentBody').innerHTML = recent.map((item) =>
            '<tr>' +
              '<td><a href="' + esc(item.share_url) + '" target="_blank">' + esc(item.title) + '</a><div class="sub">#' + esc(item.share_code) + ' • nguồn: ' + esc(item.ai_source) + '</div></td>' +
              '<td>' + fmtVnd(item.cost) + ' <span class="sub">/ ' + fmtVnd(item.budget) + '</span></td>' +
              '<td>' + esc(item.calories) + ' kcal</td>' +
              '<td><strong>' + esc(item.participants_count) + '</strong> người chốt <span class="sub">(' + esc(item.views) + ' lượt xem)</span></td>' +
              '<td>' + esc(item.replan_count) + ' lượt</td>' +
            '</tr>'
          ).join('');
        }
      } catch {
        // Ignore transient polling errors
      }
    }
    setInterval(refreshStats, 5000);
  </script>
</body>
</html>`;
}
