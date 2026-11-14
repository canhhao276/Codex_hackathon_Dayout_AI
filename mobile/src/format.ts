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

const NUTRITION_WORDS: Record<string, string> = {
  low_sugar: 'Ít đường',
  eat_clean: 'Eat Clean',
  high_protein: 'Giàu đạm',
  balanced: 'Cân bằng',
  indulgent: 'Hơi nhiều năng lượng',
  vegetarian: 'Món chay',
};

/** Đổi mã thô (VD "low_sugar") backend lỡ trả ra thành chữ tiếng Việt; bỏ ghi chú rỗng như "-". */
export function prettyNutrition(text: string | null | undefined): string {
  const t = (text ?? '').trim();
  if (!t || /^[-–—.\s]+$/.test(t)) return '';
  return t.replace(/\b[a-z]+(?:_[a-z]+)+\b|\bbalanced\b|\bindulgent\b|\bvegetarian\b/g, (w) => NUTRITION_WORDS[w] ?? w);
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function minToHm(x: number): string {
  return `${pad2(Math.floor(x / 60))}:${pad2(x % 60)}`;
}

/** "now" → làm tròn lên mốc 15 phút kế tiếp; còn lại là "HH:MM". */
export function startKeyToMin(startKey: string): number {
  if (startKey === 'now') {
    const d = new Date();
    return Math.min(Math.ceil((d.getHours() * 60 + d.getMinutes()) / 15) * 15, 22 * 60);
  }
  const [h, m] = startKey.split(':').map(Number);
  const v = (Number.isFinite(h) ? h : 14) * 60 + (Number.isFinite(m) ? m : 0);
  return Math.max(0, Math.min(v, 22 * 60));
}

export function resolveTimeWindow(startKey: string, durationMin = 7 * 60): { start: string; end: string } {
  const startMin = startKeyToMin(startKey);
  const endMin = Math.min(startMin + Math.max(60, durationMin), 23 * 60 + 30);
  return { start: minToHm(startMin), end: minToHm(endMin) };
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${pad2(m)}` : `${h} tiếng`;
}

export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '');
}
