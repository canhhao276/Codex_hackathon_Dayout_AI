export function formatVndShort(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) {
    const k = Math.round(v / 1000);
    return `${k.toLocaleString('vi-VN')}k`;
  }
  return `${Math.round(v)}đ`;
}

export function formatVnd(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return `${Math.round(v).toLocaleString('vi-VN')} VNĐ`;
}

export function formatKm(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(1)} km`;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "Ngay bây giờ" → làm tròn lên mốc 15 phút kế tiếp. */
export function resolveTimeWindow(startKey: string): { start: string; end: string } {
  let startMin: number;
  if (startKey === 'now') {
    const d = new Date();
    startMin = Math.ceil((d.getHours() * 60 + d.getMinutes()) / 15) * 15;
  } else {
    const [h, m] = startKey.split(':').map(Number);
    startMin = h * 60 + m;
  }
  startMin = Math.min(startMin, 22 * 60);
  const endMin = Math.min(startMin + 7 * 60, 23 * 60 + 30);
  const toStr = (x: number) => `${pad2(Math.floor(x / 60))}:${pad2(x % 60)}`;
  return { start: toStr(startMin), end: toStr(endMin) };
}

export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '');
}
