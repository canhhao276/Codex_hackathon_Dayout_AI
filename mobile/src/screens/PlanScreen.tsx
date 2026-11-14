import React, { useCallback, useRef, useState } from 'react';
import {
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
import { CATEGORY_META } from '../constants';
import { formatKm, formatVndShort } from '../format';
import { colors, radius, shadow } from '../theme';
import type { ItinerarySummary, ReplanReason, SavedPlan, Stop } from '../types';

interface Props {
  plan: SavedPlan;
  restored: boolean;
  changedStopIds: string[];
  prevSummary: ItinerarySummary | null;
  onReplan: (reason: ReplanReason, targetOrder: number, newBudget: number) => void;
  onNew: () => void;
  onOpenSettings: () => void;
  onShare: () => void;
}

function Delta({ now, prev, unit, invert }: { now: number; prev?: number; unit: 'vnd' | 'kcal'; invert?: boolean }) {
  if (prev == null || prev === now) return null;
  const d = now - prev;
  const good = invert ? d > 0 : d < 0;
  const text = unit === 'vnd' ? formatVndShort(Math.abs(d)) : `${Math.abs(Math.round(d))}`;
  return (
    <Text style={[styles.delta, { color: good ? colors.success : colors.danger }]}>
      {d < 0 ? '▼' : '▲'} {text}
    </Text>
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mapRef = useRef<LeafletMapHandle>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const cardY = useRef<Record<number, number>>({});
  const [activeOrder, setActiveOrder] = useState<number | null>(null);

  const { itinerary, request, is_sample } = plan;
  const { summary, stops } = itinerary;
  const budget = summary.budget_per_person_vnd || request.budget_vnd;
  const cost = summary.total_cost_per_person_vnd;
  const ratio = budget > 0 ? Math.min(cost / budget, 1.2) : 0;
  const overBudget = budget > 0 && cost > budget;
  const mapHeight = Math.round(Math.max(220, Math.min(height * 0.36, 380)));

  const onCardPress = (s: Stop) => {
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
    onReplan('rainy_weather', (outdoor ?? stops[0]).order, budget);
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
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {summary.title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {restored ? '💾 Đã khôi phục lịch trình gần nhất • ' : ''}
            {request.people_count} người • {request.time_window.start}–{request.time_window.end}
          </Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={onOpenSettings}>
          <Text style={styles.iconText}>⚙️</Text>
        </Pressable>
        <Pressable style={[styles.newBtn]} onPress={onNew}>
          <Text style={styles.newText}>＋ Tạo mới</Text>
        </Pressable>
      </View>

      {is_sample && (
        <View style={styles.sampleBanner}>
          <Text style={styles.sampleText}>
            ⚠️ DỮ LIỆU MẪU (server chưa kết nối) — bấm ⚙️ để nhập API URL rồi Tạo mới.
          </Text>
        </View>
      )}

      {/* Map */}
      <View style={{ height: mapHeight }}>
        <LeafletMap
          ref={mapRef}
          itinerary={itinerary}
          origin={request.origin}
          onStopPress={onMarkerPress}
        />
        <Pressable style={styles.fitBtn} onPress={() => mapRef.current?.fitAll()}>
          <Text style={styles.fitText}>⤢ Toàn tuyến</Text>
        </Pressable>
      </View>

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudCol}>
          <Text style={styles.hudLabel}>💰 Chi phí / người</Text>
          <View style={styles.hudRow}>
            <Text style={[styles.hudValue, overBudget && { color: colors.danger }]}>
              {formatVndShort(cost)}
            </Text>
            <Text style={styles.hudOf}> / {formatVndShort(budget)}</Text>
          </View>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(ratio, 1) * 100}%`,
                  backgroundColor: overBudget ? colors.danger : colors.success,
                },
              ]}
            />
          </View>
          <Delta now={cost} prev={prevSummary?.total_cost_per_person_vnd} unit="vnd" />
        </View>
        <View style={styles.hudDivider} />
        <View style={[styles.hudCol, { flex: 1.25 }]}>
          <Text style={styles.hudLabel}>🔥 Năng lượng</Text>
          <View style={styles.hudRow}>
            <Text style={styles.hudValue}>~{Math.round(summary.total_calories_kcal)}</Text>
            <Text style={styles.hudOf}> kcal</Text>
            <Delta now={summary.total_calories_kcal} prev={prevSummary?.total_calories_kcal} unit="kcal" />
          </View>
          {!!summary.nutrition_badge && (
            <Text style={styles.badge} numberOfLines={2}>
              {summary.nutrition_badge}
            </Text>
          )}
          <Text style={styles.hudMini}>
            🛵 {formatKm(summary.total_distance_km)} • {Math.round(summary.total_travel_minutes)} phút di chuyển
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 96 + insets.bottom }}
      >
        {/* Quick AI replan */}
        <Text style={styles.sectionTitle}>⚡ AI thích ứng thời gian thực</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
          <Pressable style={[styles.quick, { backgroundColor: colors.infoSoft }]} onPress={rain}>
            <Text style={[styles.quickText, { color: colors.info }]}>🌧️ Trời mưa (Đổi điểm trong nhà)</Text>
          </Pressable>
          <Pressable style={[styles.quick, { backgroundColor: colors.accentSoft }]} onPress={cheaper}>
            <Text style={[styles.quickText, { color: colors.accent }]}>💸 Tiết kiệm ngân sách (−20%)</Text>
          </Pressable>
          <Pressable style={[styles.quick, { backgroundColor: colors.successSoft }]} onPress={lighter}>
            <Text style={[styles.quickText, { color: colors.success }]}>🥗 Nhẹ calo hơn</Text>
          </Pressable>
        </ScrollView>

        <Text style={styles.sectionTitle}>🗓️ Lộ trình {stops.length} chặng</Text>
        {stops.map((s, i) => {
          const meta = CATEGORY_META[s.category] ?? { label: s.category, emoji: '📍' };
          const isNew = changedStopIds.includes(s.stop_id);
          const active = activeOrder === s.order;
          return (
            <View
              key={`${s.stop_id}_${s.order}`}
              onLayout={(e) => {
                cardY.current[s.order] = e.nativeEvent.layout.y;
              }}
            >
              <Pressable
                onPress={() => onCardPress(s)}
                style={[styles.card, active && styles.cardActive, isNew && styles.cardNew]}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.num, !s.indoor && { backgroundColor: colors.accent }]}>
                    <Text style={styles.numText}>{s.order}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.time}>
                      {s.start_time}
                      {s.end_time ? ` – ${s.end_time}` : ''} • {meta.emoji} {meta.label} •{' '}
                      {s.indoor ? 'Trong nhà' : 'Ngoài trời'}
                    </Text>
                    <Text style={styles.name} numberOfLines={2}>
                      {s.name}
                    </Text>
                  </View>
                  {isNew && (
                    <View style={styles.newTag}>
                      <Text style={styles.newTagText}>AI MỚI ĐỔI</Text>
                    </View>
                  )}
                </View>
                {!!s.address && (
                  <Text style={styles.address} numberOfLines={2}>
                    📍 {s.address}
                  </Text>
                )}
                {s.recommended_items.length > 0 && (
                  <View style={styles.items}>
                    {s.recommended_items.map((it) => (
                      <View key={it} style={styles.item}>
                        <Text style={styles.itemText}>{it}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.metrics}>
                  <Text style={styles.metric}>💰 {formatVndShort(s.estimated_cost_vnd)}</Text>
                  <Text style={styles.metric}>🔥 {Math.round(s.estimated_calories_kcal)} kcal</Text>
                  {!!s.nutrition_note && (
                    <Text style={[styles.metric, styles.metricNote]} numberOfLines={2}>
                      {s.nutrition_note}
                    </Text>
                  )}
                </View>
                {!!s.ai_reason && (
                  <View style={styles.reason}>
                    <Text style={styles.reasonText}>🤖 {s.ai_reason}</Text>
                  </View>
                )}
                <Pressable
                  style={styles.swap}
                  onPress={() => onReplan('crowded', s.order, budget)}
                  hitSlop={6}
                >
                  <Text style={styles.swapText}>🔄 Đổi quán này</Text>
                </Pressable>
              </Pressable>
              {i < stops.length - 1 && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                  <Text style={styles.connectorText}>
                    🛵 {formatKm(s.distance_to_next_km)}
                    {s.travel_to_next_minutes != null ? ` • ~${Math.round(s.travel_to_next_minutes)} phút` : ''}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>
        <Pressable style={({ pressed }) => [styles.share, pressed && { opacity: 0.85 }]} onPress={onShare}>
          <Text style={styles.shareText}>📤 Share chốt kèo nhóm</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  title: { fontSize: 17, fontWeight: '900', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    ...shadow,
  },
  iconText: { fontSize: 16 },
  newBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  newText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  sampleBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 6 },
  sampleText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  fitBtn: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    ...shadow,
  },
  fitText: { fontSize: 12, fontWeight: '700', color: colors.text },
  hud: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginTop: -18,
    borderRadius: radius.lg,
    padding: 12,
    ...shadow,
    elevation: 6,
  },
  hudCol: { flex: 1 },
  hudDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  hudLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  hudRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 2 },
  hudValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  hudOf: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  delta: { fontSize: 11, fontWeight: '800', marginTop: 3, marginLeft: 4 },
  badge: {
    marginTop: 4,
    fontSize: 11,
    color: colors.success,
    fontWeight: '800',
    backgroundColor: colors.successSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  hudMini: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: colors.text, marginTop: 14, marginBottom: 8 },
  quick: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.md, marginRight: 8 },
  quickText: { fontSize: 13, fontWeight: '800' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow,
  },
  cardActive: { borderColor: colors.primary },
  cardNew: { borderColor: colors.success, backgroundColor: '#F7FEF9' },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  num: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  numText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  time: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 1 },
  newTag: { backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginLeft: 6 },
  newTagText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  address: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  items: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  item: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  itemText: { fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
  metric: { fontSize: 13, fontWeight: '800', color: colors.text, marginRight: 12 },
  metricNote: { fontSize: 12, fontWeight: '600', color: colors.success, flexShrink: 1 },
  reason: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, marginTop: 10 },
  reasonText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  swap: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  swapText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  connector: { flexDirection: 'row', alignItems: 'center', paddingLeft: 30, height: 40 },
  connectorLine: {
    position: 'absolute',
    left: 30,
    top: 0,
    bottom: 0,
    width: 2,
    borderStyle: 'dashed',
    borderLeftWidth: 2,
    borderColor: colors.primary,
    opacity: 0.4,
  },
  connectorText: { marginLeft: 14, fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: 'rgba(245,247,251,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  share: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  shareText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
