import type { ItineraryResponse, Origin } from '../types';

export interface LeafletMapHandle {
  focusStop: (order: number) => void;
  fitAll: () => void;
}

export interface LeafletMapProps {
  itinerary: ItineraryResponse;
  origin: Origin | null;
  onStopPress?: (order: number) => void;
}

/** Dữ liệu gửi vào trang bản đồ (window.renderPlan). */
export function buildMapPayload(itinerary: ItineraryResponse, origin: Origin | null) {
  return {
    origin,
    polyline: itinerary.route_polyline,
    stops: itinerary.stops.map((s) => ({
      order: s.order,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      indoor: s.indoor,
      time: s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : s.start_time,
    })),
  };
}

// Bản đồ miễn phí, không cần API key: Leaflet 1.9.4 + Esri World Street Map (fallback OSM).
export const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #EFE9DE; }
  .pin { width: 34px; height: 34px; border-radius: 17px; background: #E2552C; color: #fff;
         font: 700 15px/34px -apple-system, Roboto, sans-serif; text-align: center;
         border: 3px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,.35); box-sizing: border-box; }
  .pin.outdoor { background: #A86A12; }
  .pin.active { transform: scale(1.25); background: #1D1B18; }
  .origin { width: 18px; height: 18px; border-radius: 9px; background: #0284C7;
            border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(2,132,199,.25); box-sizing: border-box; }
  .leaflet-popup-content { font: 13px -apple-system, Roboto, sans-serif; margin: 10px 12px; }
  .leaflet-popup-content b { font-size: 14px; }
  /* Thẻ HUD bên app đè ~18px lên đáy bản đồ */
  .leaflet-bottom { bottom: 18px; }
  .leaflet-control-attribution { font-size: 9px; }
  #err { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
         font: 14px sans-serif; color: #475569; text-align: center; padding: 20px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="err">Không tải được bản đồ (cần Internet).<br/>Lịch trình bên dưới vẫn dùng bình thường.</div>
<script>
  window.__pending = null;
  window.__ready = false;
  window.renderPlan = function (p) { window.__pending = p; if (window.__ready) draw(p); };
  window.focusStop = function (o) { if (window.__ready) focus(o); };
  window.fitAll = function () { if (window.__ready) fit(); };
  function post(msg) { try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {} }
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map, layer, markers = {}, bounds = null, activeOrder = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function init() {
    if (typeof L === 'undefined') {
      document.getElementById('err').style.display = 'flex';
      post({ type: 'error', message: 'leaflet_load_failed' });
      return;
    }
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([21.0012, 105.8035], 14);
    // CartoDB nay trả ảnh "API KEY REQUIRED"; OSM chặn tile trong WebView Android (đã thấy trên máy thật).
    // Chính: Esri World Street Map (không cần key). Dự phòng: OSM.
    var primary = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: '&copy; Esri, OpenStreetMap'
    });
    var errors = 0, switched = false;
    primary.on('tileerror', function () {
      errors++;
      if (errors > 3 && !switched) {
        switched = true;
        map.removeLayer(primary);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '&copy; OpenStreetMap'
        }).addTo(map);
      }
    });
    primary.addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    window.__ready = true;
    post({ type: 'ready' });
    if (window.__pending) draw(window.__pending);
  }

  function setActive(order) {
    if (activeOrder != null && markers[activeOrder]) {
      var el = markers[activeOrder].getElement();
      if (el) { var d = el.querySelector('.pin'); if (d) d.classList.remove('active'); }
    }
    activeOrder = order;
    if (markers[order]) {
      var el2 = markers[order].getElement();
      if (el2) { var d2 = el2.querySelector('.pin'); if (d2) d2.classList.add('active'); }
    }
  }

  function draw(p) {
    layer.clearLayers();
    markers = {};
    activeOrder = null;
    var pts = [];
    if (p.origin) {
      var o = [p.origin.lat, p.origin.lng];
      pts.push(o);
      L.marker(o, { icon: L.divIcon({ className: '', html: '<div class="origin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) })
        .bindPopup('<b>Điểm xuất phát</b><br/>' + esc(p.origin.label)).addTo(layer);
    }
    var line = (p.polyline && p.polyline.length >= 2) ? p.polyline : null;
    if (!line) {
      line = pts.slice();
      p.stops.forEach(function (s) { line.push([s.lat, s.lng]); });
    }
    if (line.length >= 2) {
      L.polyline(line, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(layer);
      L.polyline(line, { color: '#E2552C', weight: 5, opacity: 0.95 }).addTo(layer);
      line.forEach(function (pt) { pts.push(pt); });
    }
    p.stops.forEach(function (s) {
      if (!isFinite(s.lat) || !isFinite(s.lng)) return;
      var html = '<div class="pin' + (s.indoor ? '' : ' outdoor') + '">' + s.order + '</div>';
      var m = L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: '', html: html, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }),
        zIndexOffset: 1000 + s.order
      }).bindPopup('<b>' + s.order + '. ' + esc(s.name) + '</b><br/>' + esc(s.time) +
                   (s.indoor ? ' • Trong nhà' : ' • Ngoài trời'));
      m.on('click', function () { setActive(s.order); post({ type: 'stop', order: s.order }); });
      m.addTo(layer);
      markers[s.order] = m;
      pts.push([s.lat, s.lng]);
    });
    bounds = pts.length ? L.latLngBounds(pts) : null;
    fit();
  }

  function fit() {
    map.closePopup();
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { paddingTopLeft: [36, 36], paddingBottomRight: [36, 56], maxZoom: 16, animate: true });
    }
  }

  function focus(order) {
    var m = markers[order];
    if (!m) return;
    setActive(order);
    map.flyTo(m.getLatLng(), 16, { duration: 0.8 });
    setTimeout(function () { m.openPopup(); }, 850);
  }

  init();
</script>
</body>
</html>`;
