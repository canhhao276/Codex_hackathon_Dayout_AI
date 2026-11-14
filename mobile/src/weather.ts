// Dự báo thời tiết theo giờ cho khung giờ đi chơi — Open-Meteo (miễn phí, không cần API key).
// Ý tưởng từ jeantimex/map-agent: kiểm tra thời tiết trước khi đi và cảnh báo mưa ngay trong lộ trình.

export interface TripWeather {
  maxRainChance: number; // %
  rainyHour: string | null; // giờ đầu tiên có khả năng mưa ≥ 50%
  tempMin: number;
  tempMax: number;
}

const hm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export async function fetchTripWeather(
  lat: number,
  lng: number,
  window: { start: string; end: string },
): Promise<TripWeather | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      '&hourly=precipitation_probability,temperature_2m&timezone=Asia%2FBangkok&forecast_days=2';
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const times: string[] = data?.hourly?.time ?? [];
    const rain: number[] = data?.hourly?.precipitation_probability ?? [];
    const temp: number[] = data?.hourly?.temperature_2m ?? [];
    if (!times.length) return null;

    // Ngày đi = hôm nay (giờ VN); nếu khung giờ đã qua hết thì xét ngày mai.
    const now = new Date(Date.now() + 7 * 3600 * 1000);
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startMin = hm(window.start);
    const endMin = Math.max(hm(window.end), startMin + 60);
    const dayOffset = endMin <= nowMin ? 1 : 0;
    const day = new Date(now.getTime() + dayOffset * 86400000).toISOString().slice(0, 10);

    let maxRain = 0;
    let rainyHour: string | null = null;
    let tMin = Infinity;
    let tMax = -Infinity;
    times.forEach((t, i) => {
      if (!t.startsWith(day)) return;
      const m = hm(t.slice(11, 16));
      if (m + 59 < startMin || m > endMin) return;
      const r = rain[i] ?? 0;
      if (r > maxRain) maxRain = r;
      if (r >= 50 && !rainyHour) rainyHour = t.slice(11, 16);
      if (Number.isFinite(temp[i])) {
        tMin = Math.min(tMin, temp[i]);
        tMax = Math.max(tMax, temp[i]);
      }
    });
    if (!Number.isFinite(tMin)) return null;
    return { maxRainChance: maxRain, rainyHour, tempMin: Math.round(tMin), tempMax: Math.round(tMax) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
