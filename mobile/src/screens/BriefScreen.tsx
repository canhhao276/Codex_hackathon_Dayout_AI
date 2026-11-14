import * as Location from 'expo-location';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Chip from '../components/Chip';
import { parseBrief } from '../api';
import {
  BUDGET_MIN,
  BUDGET_PRESETS,
  DURATION_DEFAULT,
  DURATION_MAX,
  DURATION_MIN,
  EXTRA_VIBES,
  NOTE_SUGGESTIONS,
  NUTRITION_OPTIONS,
  QUICK_AREAS,
  START_TIME_OPTIONS,
  VENUE_ORIGIN,
  VIBE_OPTIONS,
} from '../constants';
import { formatDuration, formatVndShort, minToHm, resolveTimeWindow, startKeyToMin } from '../format';
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
  extraVibes: [],
  durationMin: DURATION_DEFAULT,
  description: '',
};

const DESCRIPTION_EXAMPLE =
  'VD: Chiều nay 4 đứa bạn đi quanh Hồ Gươm, mỗi người tầm 500k, thích chụp ảnh và ăn đặc sản, có 1 bạn ăn chay';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
    time_window: resolveTimeWindow(d.startKey, d.durationMin),
    prompt_note: [
      d.description.trim() ? `Mô tả của người dùng: "${d.description.trim().slice(0, 400)}"` : '',
      d.note.trim(),
      d.extraVibes.length ? `Sở thích thêm: ${d.extraVibes.join(', ')}` : '',
      d.people > 4 ? `Nhóm đông ${d.people} người, cần chỗ rộng` : '',
    ]
      .filter(Boolean)
      .join('. '),
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

  const [budgetText, setBudgetText] = useState(String(Math.round(initialDraft.budget / 1000)));
  const [customVibe, setCustomVibe] = useState('');
  const [parsing, setParsing] = useState(false);
  const [aiResult, setAiResult] = useState<{ ok: boolean; summary: string; filled: string[] } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const setBudget = (vnd: number) => {
    update({ budget: vnd });
    setBudgetText(String(Math.round(vnd / 1000)));
  };

  // Mô tả bằng lời → AI phân tích → điền form. Người dùng vẫn sửa mọi field bên dưới trước khi tạo lộ trình.
  const analyze = async () => {
    const text = draft.description.trim();
    if (!text || parsing) return;
    setParsing(true);
    setAiResult(null);
    try {
      const p = await parseBrief(apiBaseUrl, text);
      const patch: Partial<BriefDraft> = {};
      const filled: string[] = [];
      if (p.budget_per_person_vnd) {
        patch.budget = Math.max(BUDGET_MIN, p.budget_per_person_vnd);
        setBudgetText(String(Math.round(patch.budget / 1000)));
        filled.push(`💰 ${formatVndShort(patch.budget)}/người`);
      }
      if (p.people_count) {
        patch.people = Math.max(1, Math.min(20, p.people_count));
        filled.push(`👥 ${patch.people} người`);
      }
      const coreVibes = p.vibes.filter((v) => VIBE_OPTIONS.some((o) => o.key === v));
      if (coreVibes.length) {
        patch.vibes = coreVibes;
        filled.push(...coreVibes.map((v) => VIBE_OPTIONS.find((o) => o.key === v)!.label));
      }
      if (p.extra_interests.length) {
        patch.extraVibes = Array.from(new Set([...draft.extraVibes, ...p.extra_interests]));
        filled.push(...p.extra_interests);
      }
      const goal = NUTRITION_OPTIONS.find((n) => n.key === p.nutrition_goal);
      if (goal) {
        patch.nutrition = goal.key;
        filled.push(`🥗 ${goal.label}`);
      }
      if (p.start_time) {
        patch.startKey = p.start_time;
        filled.push(`🕑 ${p.start_time}`);
      }
      if (p.duration_minutes) {
        patch.durationMin = clamp(Math.round(p.duration_minutes / 30) * 30, DURATION_MIN, DURATION_MAX);
        filled.push(`⏱️ ${formatDuration(patch.durationMin)}`);
      }
      const area = QUICK_AREAS.find((a) => a.key === p.area_key);
      if (area) {
        patch.originKey = area.key;
        patch.origin = area.origin;
        filled.push(`📍 ${area.title}`);
      }
      patch.note = p.note;
      if (p.note) filled.push(`📝 ${p.note}`);
      update(patch);
      setAiResult({
        ok: p.engine === 'openai',
        summary:
          p.summary ||
          (p.engine === 'openai' ? 'AI đã điền form từ mô tả của bạn.' : 'Đã điền nhanh theo từ khoá.'),
        filled,
      });
    } catch (e: any) {
      setAiResult({ ok: false, summary: `Chưa phân tích được: ${e?.message ?? 'lỗi kết nối'}`, filled: [] });
    } finally {
      setParsing(false);
    }
  };

  const toggleVibe = (v: Vibe) =>
    setDraft((d) => {
      const has = d.vibes.includes(v);
      const next = has ? d.vibes.filter((x) => x !== v) : [...d.vibes, v];
      return { ...d, vibes: next.length ? next : d.vibes };
    });

  const toggleExtra = (v: string) =>
    setDraft((d) => ({
      ...d,
      extraVibes: d.extraVibes.includes(v) ? d.extraVibes.filter((x) => x !== v) : [...d.extraVibes, v],
    }));

  const addCustomVibe = () => {
    const v = customVibe.trim().slice(0, 40);
    if (!v) return;
    setDraft((d) => (d.extraVibes.includes(v) ? d : { ...d, extraVibes: [...d.extraVibes, v] }));
    setCustomVibe('');
  };

  // Ngân sách nhập thẳng theo nghìn đồng (VD gõ 450 → 450k), không giới hạn tối đa.
  const onBudgetChange = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, 7);
    setBudgetText(digits);
    const k = parseInt(digits, 10);
    if (Number.isFinite(k) && k > 0) update({ budget: k * 1000 });
  };
  const onBudgetBlur = () => {
    if (draft.budget < BUDGET_MIN || !budgetText) setBudget(Math.max(BUDGET_MIN, draft.budget));
  };

  const shiftStart = (delta: number) =>
    update({ startKey: minToHm(clamp(startKeyToMin(draft.startKey) + delta, 6 * 60, 22 * 60)) });

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
  const tw = resolveTimeWindow(draft.startKey, draft.durationMin);
  const isPresetStart = START_TIME_OPTIONS.some((t) => t.key === draft.startKey);

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
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mô tả bằng lời → AI điền form */}
        <View style={[styles.card, styles.aiCard]}>
          <Text style={styles.cardTitle}>💬 Kể nhu cầu, AI điền giúp</Text>
          <TextInput
            value={draft.description}
            onChangeText={(t) => update({ description: t.slice(0, 600) })}
            placeholder={DESCRIPTION_EXAMPLE}
            placeholderTextColor={colors.textMuted}
            style={styles.note}
            multiline
          />
          <View style={styles.inlineRow}>
            <Pressable
              style={[styles.aiBtn, (!draft.description.trim() || parsing) && { opacity: 0.5 }]}
              onPress={analyze}
              disabled={!draft.description.trim() || parsing}
            >
              {parsing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.aiBtnText}>✨ AI phân tích & điền form</Text>
              )}
            </Pressable>
            {!!draft.description && !parsing && (
              <Pressable
                style={styles.clearBtn}
                onPress={() => {
                  update({ description: '' });
                  setAiResult(null);
                }}
              >
                <Text style={styles.clearBtnText}>Xoá</Text>
              </Pressable>
            )}
          </View>
          {aiResult && (
            <View style={[styles.aiResult, !aiResult.ok && styles.aiResultWarn]}>
              <Text style={styles.aiResultTitle}>
                {aiResult.ok ? '🤖 ' : '⚠️ '}
                {aiResult.summary}
              </Text>
              {aiResult.filled.length > 0 && (
                <>
                  <View style={styles.filledWrap}>
                    {aiResult.filled.map((f) => (
                      <View key={f} style={styles.filledTag}>
                        <Text style={styles.filledText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.hint}>Đã điền vào form bên dưới — bạn sửa thoải mái rồi bấm tạo lộ trình.</Text>
                </>
              )}
            </View>
          )}
        </View>

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
          <Text style={styles.cardTitle}>💰 Ngân sách / người</Text>
          <View style={styles.budgetBox}>
            <TextInput
              value={budgetText}
              onChangeText={onBudgetChange}
              onBlur={onBudgetBlur}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder="350"
              placeholderTextColor={colors.textMuted}
              style={styles.budgetInput}
              selectTextOnFocus
            />
            <Text style={styles.budgetUnit}>nghìn đồng</Text>
          </View>
          <Text style={styles.hint}>
            = {draft.budget.toLocaleString('vi-VN')} VNĐ/người{draft.budget >= 1000000 ? ` (${budgetLabel})` : ''} • Gõ số tuỳ ý,
            hoặc chọn nhanh:
          </Text>
          <View style={styles.chips}>
            {BUDGET_PRESETS.map((b) => (
              <Chip
                key={b}
                small
                tone="accent"
                label={formatVndShort(b)}
                selected={draft.budget === b}
                onPress={() => setBudget(b)}
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
              <Pressable style={styles.stepBtn} onPress={() => update({ people: Math.min(20, draft.people + 1) })}>
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
          <Text style={[styles.hint, { marginTop: 4 }]}>Thêm sở thích (AI đọc và cân nhắc):</Text>
          <View style={styles.chips}>
            {[...EXTRA_VIBES, ...draft.extraVibes.filter((v) => !EXTRA_VIBES.includes(v))].map((v) => (
              <Chip
                key={v}
                small
                label={v}
                selected={draft.extraVibes.includes(v)}
                onPress={() => toggleExtra(v)}
              />
            ))}
          </View>
          <View style={styles.inlineRow}>
            <TextInput
              value={customVibe}
              onChangeText={setCustomVibe}
              onSubmitEditing={addCustomVibe}
              returnKeyType="done"
              placeholder="Tự nhập sở thích, VD: Xem phim, Rooftop"
              placeholderTextColor={colors.textMuted}
              style={[styles.inlineInput, { flex: 1 }]}
              maxLength={40}
            />
            <Pressable style={styles.addBtn} onPress={addCustomVibe}>
              <Text style={styles.addBtnText}>＋ Thêm</Text>
            </Pressable>
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
          <View style={[styles.rowBetween, { marginTop: 4 }]}>
            <Text style={styles.subLabel}>Giờ bắt đầu{isPresetStart ? '' : ' (tuỳ chỉnh)'}</Text>
            <View style={styles.stepperSmall}>
              <Pressable style={styles.stepBtnSm} onPress={() => shiftStart(-30)}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.timeValue}>{tw.start}</Text>
              <Pressable style={styles.stepBtnSm} onPress={() => shiftStart(30)}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.subLabel}>Đi trong bao lâu</Text>
            <View style={styles.stepperSmall}>
              <Pressable
                style={styles.stepBtnSm}
                onPress={() => update({ durationMin: clamp(draft.durationMin - 60, DURATION_MIN, DURATION_MAX) })}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.timeValue}>{formatDuration(draft.durationMin)}</Text>
              <Pressable
                style={styles.stepBtnSm}
                onPress={() => update({ durationMin: clamp(draft.durationMin + 60, DURATION_MIN, DURATION_MAX) })}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Ghi chú */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Ghi chú nhanh (tuỳ chọn)</Text>
          <TextInput
            value={draft.note}
            onChangeText={(t) => update({ note: t.slice(0, 300) })}
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
  stepBtnSm: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValue: { fontSize: 16, fontWeight: '900', color: colors.text, minWidth: 76, textAlign: 'center' },
  subLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  inlineInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  inlineSuffix: { fontSize: 16, fontWeight: '800', color: colors.textMuted, marginLeft: 8 },
  addBtn: {
    marginLeft: 8,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  aiCard: { borderWidth: 2, borderColor: colors.primarySoft },
  aiBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  aiBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  clearBtn: {
    marginLeft: 8,
    marginTop: 6,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  aiResult: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  aiResultWarn: { backgroundColor: '#FEF3C7' },
  aiResultTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 6 },
  filledWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  filledTag: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  filledText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  budgetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.accentSoft,
    marginBottom: 6,
  },
  budgetInput: {
    flex: 1,
    minWidth: 0,
    width: 0,
    fontSize: 26,
    fontWeight: '900',
    color: colors.accent,
    paddingVertical: 8,
  },
  budgetUnit: { fontSize: 15, fontWeight: '800', color: colors.accent, marginLeft: 8, flexShrink: 0 },
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
