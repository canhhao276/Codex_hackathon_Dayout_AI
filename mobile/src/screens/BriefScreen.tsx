import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Chip from '../components/Chip';
import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_PRESETS,
  BUDGET_STEP,
  NOTE_SUGGESTIONS,
  NUTRITION_OPTIONS,
  QUICK_AREAS,
  START_TIME_OPTIONS,
  VENUE_ORIGIN,
  VIBE_OPTIONS,
} from '../constants';
import { formatVndShort, resolveTimeWindow } from '../format';
import type { BriefDraft } from '../storage';
import { colors, radius, shadow } from '../theme';
import type { GenerateRequest, NutritionGoal, Vibe } from '../types';

export const DEFAULT_DRAFT: BriefDraft = {
  originKey: 'venue',
  origin: VENUE_ORIGIN,
  budget: 350000,
  people: 2,
  vibes: ['chill_cafe', 'interactive_activity', 'local_food'],
  nutrition: 'eat_clean',
  startKey: '14:00',
  note: 'Đi hẹn hò cuối tuần, thích không gian thoáng, ít dầu mỡ',
};

interface Props {
  initialDraft: BriefDraft;
  apiBaseUrl: string;
  hasSavedPlan: boolean;
  onBackToPlan: () => void;
  onOpenSettings: () => void;
  onGenerate: (req: GenerateRequest, draft: BriefDraft) => void;
}

export function draftToRequest(d: BriefDraft): GenerateRequest {
  return {
    origin: d.origin,
    budget_vnd: d.budget,
    people_count: d.people,
    vibes: d.vibes as Vibe[],
    nutrition_goal: d.nutrition as NutritionGoal,
    time_window: resolveTimeWindow(d.startKey),
    prompt_note: d.note.trim(),
  };
}

export default function BriefScreen({
  initialDraft,
  apiBaseUrl,
  hasSavedPlan,
  onBackToPlan,
  onOpenSettings,
  onGenerate,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<BriefDraft>(initialDraft);
  const [locating, setLocating] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);

  const update = (patch: Partial<BriefDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleVibe = (v: Vibe) =>
    setDraft((d) => {
      const has = d.vibes.includes(v);
      const next = has ? d.vibes.filter((x) => x !== v) : [...d.vibes, v];
      return { ...d, vibes: next.length ? next : d.vibes };
    });

  const locateMe = async () => {
    setLocating(true);
    setGpsMsg(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        update({ originKey: 'venue', origin: VENUE_ORIGIN });
        setGpsMsg('Chưa cấp quyền vị trí → dùng mặc định hội trường.');
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]);
      const coords = pos?.coords ?? (await Location.getLastKnownPositionAsync())?.coords;
      if (!coords) {
        update({ originKey: 'venue', origin: VENUE_ORIGIN });
        setGpsMsg('Không lấy được GPS → dùng mặc định hội trường.');
        return;
      }
      let label = `Vị trí hiện tại (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
      try {
        const geo = await Promise.race([
          Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude }),
          new Promise<null>((r) => setTimeout(() => r(null), 3000)),
        ]);
        const g = geo?.[0];
        if (g) {
          const parts = [g.name, g.street, g.district ?? g.subregion, g.city ?? g.region].filter(Boolean);
          if (parts.length) label = Array.from(new Set(parts)).join(', ');
        }
      } catch {
        // giữ label toạ độ
      }
      update({
        originKey: 'gps',
        origin: { lat: coords.latitude, lng: coords.longitude, label },
      });
      setGpsMsg('✅ Đã lấy vị trí GPS hiện tại.');
    } catch {
      update({ originKey: 'venue', origin: VENUE_ORIGIN });
      setGpsMsg('GPS lỗi → dùng mặc định hội trường.');
    } finally {
      setLocating(false);
    }
  };

  const budgetLabel = formatVndShort(draft.budget);
  const tw = resolveTimeWindow(draft.startKey);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Dayout AI</Text>
          <Text style={styles.subtitle}>10 giây thiết lập — AI lên lộ trình cả buổi</Text>
        </View>
        {hasSavedPlan && (
          <Pressable style={styles.headerBtn} onPress={onBackToPlan}>
            <Text style={styles.headerBtnText}>🗺️</Text>
          </Pressable>
        )}
        <Pressable style={styles.headerBtn} onPress={onOpenSettings}>
          <Text style={styles.headerBtnText}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Điểm xuất phát */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Điểm xuất phát</Text>
          <Text style={styles.originLabel} numberOfLines={2}>
            {draft.origin.label}
          </Text>
          <Pressable style={styles.gpsBtn} onPress={locateMe} disabled={locating}>
            {locating ? (
              <ActivityIndicator color={colors.info} />
            ) : (
              <Text style={styles.gpsText}>🛰️ Dùng GPS vị trí hiện tại</Text>
            )}
          </Pressable>
          {gpsMsg && <Text style={styles.hint}>{gpsMsg}</Text>}
          <View style={styles.chips}>
            {QUICK_AREAS.map((a) => (
              <Chip
                key={a.key}
                small
                label={a.title}
                selected={draft.originKey === a.key}
                onPress={() => {
                  update({ originKey: a.key, origin: a.origin });
                  setGpsMsg(null);
                }}
              />
            ))}
          </View>
        </View>

        {/* Ngân sách & số người */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>💰 Ngân sách / người</Text>
            <Text style={styles.bigValue}>{budgetLabel}</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => update({ budget: Math.max(BUDGET_MIN, draft.budget - BUDGET_STEP) })}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${((draft.budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100}%` },
                ]}
              />
            </View>
            <Pressable
              style={styles.stepBtn}
              onPress={() => update({ budget: Math.min(BUDGET_MAX, draft.budget + BUDGET_STEP) })}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {BUDGET_PRESETS.map((b) => (
              <Chip
                key={b}
                small
                tone="accent"
                label={formatVndShort(b)}
                selected={draft.budget === b}
                onPress={() => update({ budget: b })}
              />
            ))}
          </View>

          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <Text style={styles.cardTitle}>👥 Số người</Text>
            <View style={styles.stepperSmall}>
              <Pressable style={styles.stepBtn} onPress={() => update({ people: Math.max(1, draft.people - 1) })}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.peopleValue}>{draft.people}</Text>
              <Pressable style={styles.stepBtn} onPress={() => update({ people: Math.min(12, draft.people + 1) })}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Vibe */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✨ Sở thích / Vibe</Text>
          <View style={styles.chips}>
            {VIBE_OPTIONS.map((v) => (
              <Chip
                key={v.key}
                emoji={v.emoji}
                label={v.label}
                selected={draft.vibes.includes(v.key)}
                onPress={() => toggleVibe(v.key)}
              />
            ))}
          </View>
        </View>

        {/* Dinh dưỡng */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🥗 Chế độ dinh dưỡng</Text>
          <View style={styles.chips}>
            {NUTRITION_OPTIONS.map((n) => (
              <Chip
                key={n.key}
                emoji={n.emoji}
                tone="success"
                label={n.label}
                selected={draft.nutrition === n.key}
                onPress={() => update({ nutrition: n.key })}
              />
            ))}
          </View>
        </View>

        {/* Thời gian */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>🕑 Bắt đầu</Text>
            <Text style={styles.hint}>
              {tw.start} → {tw.end}
            </Text>
          </View>
          <View style={styles.chips}>
            {START_TIME_OPTIONS.map((t) => (
              <Chip
                key={t.key}
                small
                label={t.label}
                selected={draft.startKey === t.key}
                onPress={() => update({ startKey: t.key })}
              />
            ))}
          </View>
        </View>

        {/* Ghi chú */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Ghi chú nhanh (tuỳ chọn)</Text>
          <TextInput
            value={draft.note}
            onChangeText={(t) => update({ note: t.slice(0, 200) })}
            placeholder="VD: Đi hẹn hò, thích không gian thoáng, ít dầu mỡ"
            placeholderTextColor={colors.textMuted}
            style={styles.note}
            multiline
          />
          <View style={[styles.chips, { marginTop: 8 }]}>
            {NOTE_SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                small
                label={`+ ${s}`}
                onPress={() =>
                  update({
                    note: draft.note.includes(s) ? draft.note : draft.note ? `${draft.note}, ${s.toLowerCase()}` : s,
                  })
                }
              />
            ))}
          </View>
        </View>

        <Text style={styles.server} numberOfLines={1}>
          Server: {apiBaseUrl}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          onPress={() => onGenerate(draftToRequest(draft), draft)}
        >
          <Text style={styles.ctaText}>✨ AI tạo lộ trình ngay</Text>
          <Text style={styles.ctaSub}>
            {budgetLabel}/người • {draft.people} người • {NUTRITION_OPTIONS.find((n) => n.key === draft.nutrition)?.label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  brand: { fontSize: 26, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    ...shadow,
  },
  headerBtnText: { fontSize: 18 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  originLabel: { fontSize: 15, color: colors.text, fontWeight: '600', marginBottom: 10 },
  gpsBtn: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gpsText: { color: colors.info, fontWeight: '700', fontSize: 14 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  bigValue: { fontSize: 22, fontWeight: '900', color: colors.accent, marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepperSmall: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 22, fontWeight: '800', color: colors.primary, lineHeight: 26 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 12, overflow: 'hidden' },
  trackFill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  peopleValue: { fontSize: 20, fontWeight: '900', color: colors.text, width: 44, textAlign: 'center' },
  note: {
    minHeight: 64,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.bg,
  },
  server: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(245,247,251,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2, fontWeight: '600' },
});
