import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LeafletMap, { type LeafletMapHandle } from '../components/LeafletMap';
import { CATEGORY_META, type IconName } from '../constants';
import { formatKm, formatVndShort, prettyNutrition } from '../format';
import { colors, radius, shadow, type } from '../theme';
import type { ItinerarySummary, ReplanReason, SavedPlan, Stop } from '../types';
import { findPlacePhoto } from '../places';
import { fetchRoadRoute, isStraightLine, type RoadRoute } from '../routing';
import { fetchTripWeather, type TripWeather } from '../weather';

interface Props {
  /** Có bản lộ trình trước lần AI đổi gần nhất → hiện thanh "Hoàn tác". */
  canUndo?: boolean;
  onUndo?: () => void;
  plan: SavedPlan;
  restored: boolean;
  changedStopIds: string[];
  prevSummary: ItinerarySummary | null;
  onReplan: (reason: ReplanReason, targetOrder: number, newBudget: number) => void;
  onNew: () => void;
  onOpenSettings: () => void;
  onShare: () => void;
}

function Delta({ now, prev, unit }: { now: number; prev?: number; unit: 'vnd' | 'kcal' }) {
  if (prev == null || prev === now) return null;
  const d = now - prev;
  const text = unit === 'vnd' ? formatVndShort(Math.abs(d)) : `${Math.abs(Math.round(d))} kcal`;
  return (
    <Text style={[styles.delta, { color: d < 0 ? colors.success : colors.danger }]}>
      {d < 0 ? '−' : '+'}
      {text}
    </Text>
  );
}

/** Ảnh địa điểm bên phải thẻ: Wikipedia/Wikimedia nếu chắc chắn đúng nơi, không thì ảnh minh hoạ theo loại. */
function StopPhoto({ stop, icon }: { stop: Stop; icon: IconName }) {
  const [uri, setUri] = useState<string | null>(stop.image_url ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (stop.image_url) {
      setUri(stop.image_url);
      return;
    }
    setUri(null);
    findPlacePhoto(stop.name, stop.lat, stop.lng, stop.address).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [stop.image_url, stop.name, stop.lat, stop.lng, stop.address]);
  if (uri && !failed) {
    return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" onError={() => setFailed(true)} />;
  }
  return (
    <View style={[styles.thumb, styles.thumbFallback, !stop.indoor && { backgroundColor: '#E0F4F1' }]}>
      <Ionicons name={icon} size={26} color={stop.indoor ? colors.primary : colors.outdoor} />
    </View>
  );
}

function QuickAction({ icon, label, onPress, tint }: { icon: IconName; label: string; onPress: () => void; tint: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { backgroundColor: colors.sunken }]}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={styles.quickText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function PlanScreen({
  plan,
  restored,
  changedStopIds,
  prevSummary,
  onReplan,
  onNew,
  onOpenSettings,
  onShare,
  canUndo,
  onUndo,
}: Props) {
  const insets = useSafeAreaInsets();
  const [weather, setWeather] = useState<TripWeather | null>(null);
  const { lat: oLat, lng: oLng } = plan.request.origin;
  const { start: wStart, end: wEnd } = plan.request.time_window;
  useEffect(() => {
    let alive = true;
    setWeather(null);
    fetchTripWeather(oLat, oLng, { start: wStart, end: wEnd }).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [oLat, oLng, wStart, wEnd]);

  // Đường phố thật: khi backend lỡ trả đường chim bay (OSRM quá giờ), hoặc khi có điểm kết thúc
  // (backend không biết điểm này) → điện thoại tự gọi OSRM cho cả tuyến, kể cả chặng về đích.
  const destination = plan.destination ?? null;
  const [road, setRoad] = useState<RoadRoute | null>(null);
  useEffect(() => {
    let alive = true;
    setRoad(null);
    if (destination || isStraightLine(plan.itinerary)) {
      fetchRoadRoute(plan.itinerary, plan.request.origin, destination).then((r) => {
        if (alive && r) setRoad(r);
      });
    }
    return () => {
      alive = false;
    };
  }, [plan.itinerary, plan.request.origin, destination]);
  const mapItinerary = useMemo(() => {
    if (road) return { ...plan.itinerary, route_polyline: road.line };
    if (destination) {
      // Chưa có đường thật: tạm nối thẳng thêm chặng về đích.
      return { ...plan.itinerary, route_polyline: [...plan.itinerary.route_polyline, [destination.lat, destination.lng] as [number, number]] };
    }
    return plan.itinerary;
  }, [plan.itinerary, road, destination]);
  const lastLeg = destination && road?.legs.length ? road.legs[road.legs.length - 1] : null;
  const { height } = useWindowDimensions();
  const mapRef = useRef<LeafletMapHandle>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const cardY = useRef<Record<number, number>>({});
  const [activeOrder, setActiveOrder] = useState<number | null>(null);

  const { itinerary, request, is_sample } = plan;
  const { summary, stops } = itinerary;
  const budget = summary.budget_per_person_vnd || request.budget_vnd;
  const cost = summary.total_cost_per_person_vnd;
  const ratio = budget > 0 ? Math.min(cost / budget, 1) : 0;
  const overBudget = budget > 0 && cost > budget;
  const mapHeight = Math.round(Math.max(210, Math.min(height * 0.32, 330)));
  const badge = prettyNutrition(summary.nutrition_badge);

  // Mở Google Maps (app hoặc web) — miễn phí, không cần API key: ảnh thật, đánh giá, giờ mở cửa, chỉ đường.
  const openPlaceInGoogleMaps = (s: Stop) => {
    const q = encodeURIComponent(`${s.name}, ${s.address || `${s.lat},${s.lng}`}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => undefined);
  };
  const openRouteInGoogleMaps = () => {
    const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    if (!pts.length) return;
    const ll = (s: { lat: number; lng: number }) => `${s.lat},${s.lng}`;
    const dest = pts[pts.length - 1];
    const waypoints = pts.slice(0, -1).map(ll).join('|');
    const url =
      `https://www.google.com/maps/dir/?api=1&origin=${ll(request.origin)}&destination=${ll(dest)}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
      '&travelmode=two-wheeler';
    Linking.openURL(url).catch(() => undefined);
  };

  const onStopPress = (s: Stop) => {
    setActiveOrder(s.order);
    mapRef.current?.focusStop(s.order);
  };
  const onMarkerPress = useCallback((order: number) => {
    setActiveOrder(order);
    const y = cardY.current[order];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, []);

  const rain = () => {
    const outdoor = stops.find((s) => !s.indoor);
    if (outdoor) {
      onReplan('rainy_weather', outdoor.order, budget);
      return;
    }
    Alert.alert('Lộ trình đã an toàn khi mưa', 'Mọi điểm đều trong nhà. Vẫn muốn đổi điểm đầu tiên?', [
      { text: 'Thôi', style: 'cancel' },
      { text: 'Đổi điểm 1', onPress: () => onReplan('rainy_weather', stops[0].order, budget) },
    ]);
  };
  const cheaper = () => {
    const priciest = [...stops].sort((a, b) => b.estimated_cost_vnd - a.estimated_cost_vnd)[0];
    onReplan('tighter_budget', priciest.order, Math.round((budget * 0.8) / 1000) * 1000);
  };
  const lighter = () => {
    const heaviest = [...stops].sort((a, b) => b.estimated_calories_kcal - a.estimated_calories_kcal)[0];
    onReplan('lower_calories', heaviest.order, budget);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onNew} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={styles.title} numberOfLines={1}>
            {summary.title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {request.time_window.start}–{request.time_window.end} · {request.people_count} người
            {restored ? ' · đã khôi phục' : ''}
          </Text>
        </View>
        <Pressable onPress={onOpenSettings} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      {is_sample && (
        <View style={[styles.banner, { backgroundColor: colors.amberSoft }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.amber} />
          <Text style={[styles.bannerText, { color: colors.amber }]}>Dữ liệu mẫu — chưa kết nối máy chủ. Mở cài đặt để nhập địa chỉ.</Text>
        </View>
      )}
      {!is_sample && plan.ai_source === 'fallback' && (
        <View style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="warning-outline" size={16} color={colors.danger} />
          <Text style={[styles.bannerText, { color: colors.danger }]}>AI đang offline — lộ trình này do thuật toán dự phòng tạo.</Text>
        </View>
      )}

      {/* Map */}
      <View style={{ height: mapHeight }}>
        <LeafletMap
          ref={mapRef}
          itinerary={mapItinerary}
          origin={request.origin}
          destination={destination}
          onStopPress={onMarkerPress}
        />
        <View style={styles.mapActions}>
          <Pressable style={styles.mapBtn} onPress={() => mapRef.current?.fitAll()}>
            <Ionicons name="scan-outline" size={16} color={colors.text} />
            <Text style={styles.mapBtnText}>Toàn tuyến</Text>
          </Pressable>
          <Pressable style={styles.mapBtn} onPress={openRouteInGoogleMaps}>
            <Ionicons name="navigate-outline" size={16} color={colors.text} />
            <Text style={styles.mapBtnText}>Chỉ đường</Text>
          </Pressable>
        </View>
      </View>

      {/* Sheet */}
      <ScrollView
        ref={scrollRef}
        style={styles.sheet}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 100 + insets.bottom }}
      >
        {/* Tổng quan */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, overBudget && { color: colors.danger }]}>{formatVndShort(cost)}</Text>
            <Text style={styles.statLabel}>/ {formatVndShort(budget)} mỗi người</Text>
            <Delta now={cost} prev={prevSummary?.total_cost_per_person_vnd} unit="vnd" />
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(summary.total_calories_kcal)}</Text>
            <Text style={styles.statLabel}>kcal cả buổi</Text>
            <Delta now={summary.total_calories_kcal} prev={prevSummary?.total_calories_kcal} unit="kcal" />
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatKm(summary.total_distance_km).replace(' km', '')}</Text>
            <Text style={styles.statLabel}>km · {Math.round(summary.total_travel_minutes)} phút</Text>
          </View>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: overBudget ? colors.danger : colors.primary }]} />
        </View>
        {!!badge && (
          <View style={styles.badgeRow}>
            <Ionicons name="leaf" size={14} color={colors.success} />
            <Text style={styles.badgeText} numberOfLines={2}>
              {badge}
            </Text>
          </View>
        )}

        {request.people_count > 1 && (
          <Text style={styles.groupTotal}>
            Cả nhóm {request.people_count} người ≈ {formatVndShort(cost * request.people_count)}
          </Text>
        )}

        {/* Thời tiết thật trong khung giờ đi (Open-Meteo) */}
        {weather && (
          <View style={[styles.weather, weather.maxRainChance >= 50 && styles.weatherRain]}>
            <Ionicons
              name={weather.maxRainChance >= 50 ? 'rainy' : weather.maxRainChance >= 25 ? 'partly-sunny-outline' : 'sunny-outline'}
              size={22}
              color={weather.maxRainChance >= 50 ? colors.info : colors.amber}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.weatherTitle}>
                {weather.tempMin === weather.tempMax ? `${weather.tempMax}°C` : `${weather.tempMin}–${weather.tempMax}°C`} ·
                {' '}khả năng mưa {weather.maxRainChance}%
              </Text>
              <Text style={styles.weatherSub}>
                {weather.maxRainChance >= 50
                  ? `Dự báo có mưa từ ${weather.rainyHour ?? wStart}${stops.some((s) => !s.indoor) ? ' — nên đổi điểm ngoài trời' : ' — lộ trình đã ở trong nhà'}`
                  : `Dự báo cho ${wStart}–${wEnd}, khá thuận lợi để đi`}
              </Text>
            </View>
            {weather.maxRainChance >= 50 && stops.some((s) => !s.indoor) && (
              <Pressable style={styles.weatherBtn} onPress={rain}>
                <Text style={styles.weatherBtnText}>Đổi</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Đổi nhanh */}
        <Text style={[styles.overline, { marginTop: 22 }]}>CÓ GÌ THAY ĐỔI?</Text>
        <View style={styles.quickRow}>
          <QuickAction icon="rainy-outline" label="Trời mưa" onPress={rain} tint={colors.info} />
          <QuickAction icon="trending-down-outline" label="Rẻ hơn 20%" onPress={cheaper} tint={colors.primary} />
          <QuickAction icon="leaf-outline" label="Ít calo hơn" onPress={lighter} tint={colors.success} />
        </View>

        {/* Timeline */}
        <Text style={[styles.overline, { marginTop: 24, marginBottom: 12 }]}>LỘ TRÌNH · {stops.length} ĐIỂM</Text>
        {stops.map((s, i) => {
          const meta = CATEGORY_META[s.category] ?? { label: s.category, icon: 'location-outline' as IconName };
          const isNew = changedStopIds.includes(s.stop_id);
          const active = activeOrder === s.order;
          const last = i === stops.length - 1;
          const note = prettyNutrition(s.nutrition_note);
          return (
            <View
              key={`${s.stop_id}_${s.order}`}
              style={styles.tlRow}
              onLayout={(e) => {
                cardY.current[s.order] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.tlTime}>
                <Text style={styles.tlStart}>{s.start_time}</Text>
                {!!s.end_time && <Text style={styles.tlEnd}>{s.end_time}</Text>}
              </View>
              <View style={styles.tlRail}>
                <View style={[styles.tlDot, !s.indoor && styles.tlDotOutdoor, active && styles.tlDotActive]}>
                  <Text style={styles.tlDotText}>{s.order}</Text>
                </View>
                {(!last || !!destination) && <View style={styles.tlLine} />}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
                <Pressable
                  onPress={() => onStopPress(s)}
                  style={[styles.stop, active && styles.stopActive, isNew && styles.stopNew]}
                >
                  <View style={styles.stopHead}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.stopMeta}>
                        <Ionicons name={meta.icon} size={13} color={colors.textMuted} />
                        <Text style={styles.stopMetaText}>
                          {meta.label} · {s.indoor ? 'Trong nhà' : 'Ngoài trời'}
                        </Text>
                        {isNew && (
                          <View style={styles.newTag}>
                            <Text style={styles.newTagText}>Vừa đổi</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.stopName}>{s.name}</Text>
                      {!!s.address && (
                        <Text style={styles.stopAddr} numberOfLines={2}>
                          {s.address}
                        </Text>
                      )}
                    </View>
                    <StopPhoto stop={s} icon={meta.icon} />
                  </View>
                  {s.recommended_items.length > 0 && (
                    <Text style={styles.stopItems}>
                      <Text style={styles.stopItemsLabel}>Gợi ý  </Text>
                      {s.recommended_items.join(' · ')}
                    </Text>
                  )}
                  <View style={styles.stopFacts}>
                    <Text style={styles.fact}>{s.estimated_cost_vnd ? formatVndShort(s.estimated_cost_vnd) : 'Miễn phí'}</Text>
                    <Text style={styles.factDot}>·</Text>
                    <Text style={styles.fact}>{Math.round(s.estimated_calories_kcal)} kcal</Text>
                    {!!note && (
                      <>
                        <Text style={styles.factDot}>·</Text>
                        <Text style={[styles.fact, { color: colors.success, flexShrink: 1, flex: 1 }]} numberOfLines={1}>
                          {note}
                        </Text>
                      </>
                    )}
                  </View>
                  {!!s.ai_reason && (
                    <View style={styles.reason}>
                      <Ionicons name="sparkles-outline" size={13} color={colors.primary} style={{ marginTop: 2 }} />
                      <Text style={styles.reasonText}>{s.ai_reason}</Text>
                    </View>
                  )}
                  <View style={styles.stopActions}>
                    <Pressable hitSlop={6} style={styles.linkBtn} onPress={() => openPlaceInGoogleMaps(s)}>
                      <Ionicons name="images-outline" size={15} color={colors.text} />
                      <Text style={styles.linkText}>Ảnh & đánh giá</Text>
                    </Pressable>
                    <Pressable hitSlop={6} style={styles.linkBtn} onPress={() => onReplan('crowded', s.order, budget)}>
                      <Ionicons name="swap-horizontal-outline" size={15} color={colors.primary} />
                      <Text style={[styles.linkText, { color: colors.primary }]}>Đổi chỗ khác</Text>
                    </Pressable>
                  </View>
                </Pressable>
                {(!last || (!!destination && !!lastLeg)) && (
                  <View style={styles.travel}>
                    <Ionicons name="bicycle-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.travelText}>
                      {last && lastLeg
                        ? `${formatKm(lastLeg.km)} · ${lastLeg.min} phút về đích`
                        : `${formatKm(s.distance_to_next_km)}${
                            s.travel_to_next_minutes != null ? ` · ${Math.round(s.travel_to_next_minutes)} phút` : ''
                          }`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {destination && (
          <View style={styles.tlRow}>
            <View style={styles.tlTime} />
            <View style={styles.tlRail}>
              <View style={styles.endDot}>
                <Ionicons name="flag" size={12} color="#fff" />
              </View>
            </View>
            <View style={[styles.endCard, { flex: 1 }]}>
              <Text style={styles.stopMetaText}>Kết thúc</Text>
              <Text style={styles.endName} numberOfLines={2}>
                {destination.label}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
        {canUndo && changedStopIds.length > 0 && (
          <View style={styles.snack}>
            <Ionicons name="checkmark-circle" size={18} color="#8FD3B0" />
            <Text style={styles.snackText}>Đã đổi {changedStopIds.length} điểm</Text>
            <Pressable hitSlop={8} onPress={onUndo}>
              <Text style={styles.snackAction}>Hoàn tác</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={({ pressed }) => [styles.share, pressed && { opacity: 0.9 }]} onPress={onShare}>
          <Ionicons name="paper-plane-outline" size={19} color="#fff" />
          <Text style={styles.shareText}>Gửi kèo cho nhóm</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: type.title,
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '600', marginLeft: 8 },

  mapActions: { position: 'absolute', left: 12, right: 12, bottom: 30, flexDirection: 'row', justifyContent: 'space-between' },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    ...shadow,
  },
  mapBtnText: { fontSize: 13, fontWeight: '600', color: colors.text, marginLeft: 6 },

  sheet: {
    flex: 1,
    marginTop: -20,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  stats: { flexDirection: 'row' },
  stat: { flex: 1 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 12 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  delta: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 14, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  badgeText: { flex: 1, marginLeft: 6, fontSize: 13, fontWeight: '600', color: colors.success },

  overline: type.overline,
  quickRow: { flexDirection: 'row', marginTop: 10, marginHorizontal: -4 },
  quick: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickText: { fontSize: 13, fontWeight: '600', color: colors.text, marginLeft: 6 },

  tlRow: { flexDirection: 'row' },
  tlTime: { width: 44, paddingTop: 2 },
  tlStart: { fontSize: 14, fontWeight: '700', color: colors.text },
  tlEnd: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  tlRail: { width: 30, alignItems: 'center' },
  tlDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  tlDotOutdoor: { backgroundColor: colors.outdoor },
  tlDotActive: { backgroundColor: colors.ink },
  tlDotText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 },

  stop: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginLeft: 4,
  },
  stopActive: { borderColor: colors.ink },
  stopNew: { borderColor: colors.success, backgroundColor: '#F6FCF9' },
  stopHead: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 72, height: 72, borderRadius: 12, marginLeft: 12, backgroundColor: colors.sunken },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  endDot: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCard: {
    marginLeft: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  endName: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  stopMeta: { flexDirection: 'row', alignItems: 'center' },
  stopMetaText: { fontSize: 12, color: colors.textMuted, marginLeft: 5 },
  newTag: { marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.successSoft },
  newTagText: { fontSize: 11, fontWeight: '700', color: colors.success },
  stopName: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4, letterSpacing: -0.2 },
  stopAddr: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  photo: { width: '100%', height: 140, borderRadius: radius.md, marginTop: 10, backgroundColor: colors.sunken },
  stopItems: { fontSize: 14, color: colors.text, marginTop: 10, lineHeight: 20 },
  stopItemsLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stopFacts: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  fact: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 0 },
  factDot: { marginHorizontal: 6, color: colors.textFaint, flexShrink: 0 },
  reason: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reasonText: { flex: 1, marginLeft: 6, fontSize: 13, color: colors.textMuted, lineHeight: 19, fontStyle: 'italic' },
  stopActions: { flexDirection: 'row', marginTop: 10 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 18, paddingVertical: 4 },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.text, marginLeft: 5 },
  travel: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 8 },
  travelText: { fontSize: 12, color: colors.textMuted, marginLeft: 5 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  shareText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  groupTotal: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  weather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weatherRain: { backgroundColor: colors.infoSoft, borderColor: '#BFD6F5' },
  weatherTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  weatherSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  weatherBtn: { marginLeft: 8, paddingHorizontal: 14, height: 34, borderRadius: radius.pill, backgroundColor: colors.info, justifyContent: 'center' },
  weatherBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14213D',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 8,
  },
  snackText: { flex: 1, color: '#fff', fontSize: 14, marginLeft: 8 },
  snackAction: { color: '#9CC3FF', fontWeight: '800', fontSize: 14 },
});
