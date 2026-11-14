import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseBrief } from '../api';
import Chip from '../components/Chip';
import Logo from '../components/Logo';
import PlaceSearch from '../components/PlaceSearch';
import {
  BUDGET_MIN,
  BUDGET_PRESETS,
  DESCRIPTION_EXAMPLES,
  DURATION_DEFAULT,
  DURATION_MAX,
  DURATION_MIN,
  EXTRA_VIBES,
  type IconName,
  NOTE_SUGGESTIONS,
  NUTRITION_OPTIONS,
  QUICK_AREAS,
  START_TIME_OPTIONS,
  VENUE_ORIGIN,
  VIBE_OPTIONS,
} from '../constants';
import { formatDuration, formatVndShort, minToHm, resolveTimeWindow, startKeyToMin } from '../format';
import type { BriefDraft } from '../storage';
import { colors, radius, shadow, type } from '../theme';
import type { GenerateRequest, NutritionGoal, Vibe } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const DEFAULT_DRAFT: BriefDraft = {
  originKey: 'venue',
  origin: VENUE_ORIGIN,
  budget: 350000,
  people: 2,
  vibes: ['chill_cafe', 'interactive_activity', 'local_food'],
  nutrition: 'eat_clean',
  startKey: '14:00',
  note: '',
  extraVibes: [],
  durationMin: DURATION_DEFAULT,
  description: '',
  destination: null,
  stopCount: null,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type RowKey = 'origin' | 'destination' | 'budget' | 'people' | 'time' | 'vibes' | 'nutrition' | 'note';

interface Props {
  initialDraft: BriefDraft;
  apiBaseUrl: string;
  hasSavedPlan: boolean;
  onBackToPlan: () => void;
  onOpenSettings: () => void;
  onGenerate: (req: GenerateRequest, draft: BriefDraft) => void;
  /** Lưu form mỗi khi người dùng sửa (không mất thay đổi khi chuyển màn). */
  onDraftChange?: (draft: BriefDraft) => void;
}

export function draftToRequest(d: BriefDraft): GenerateRequest {
  // Photobooth là một kiểu "chụp ảnh" → bật vibe photo_spot để backend chấm điểm đúng loại địa điểm.
  const vibes = (d.extraVibes.some((v) => /photo ?booth/i.test(v)) && !d.vibes.includes('photo_spot')
    ? [...d.vibes, 'photo_spot']
    : d.vibes) as Vibe[];
  return {
    origin: d.origin,
    budget_vnd: d.budget,
    people_count: d.people,
    vibes,
    ...(d.stopCount ? { stop_count: d.stopCount } : {}),
    nutrition_goal: d.nutrition as NutritionGoal,
    time_window: resolveTimeWindow(d.startKey, d.durationMin),
    prompt_note: [
      d.description.trim() ? `Mô tả của người dùng: "${d.description.trim().slice(0, 400)}"` : '',
      d.note.trim(),
      d.destination ? `Muốn kết thúc chuyến đi gần: ${d.destination.label}` : '',
      d.extraVibes.length ? `Sở thích thêm: ${d.extraVibes.join(', ')}` : '',
      d.people > 4 ? `Nhóm đông ${d.people} người, cần chỗ rộng` : '',
    ]
      .filter(Boolean)
      .join('. '),
  };
}

function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

interface RowProps {
  icon: IconName;
  label: string;
  value: string;
  isOpen?: boolean;
  aiFilled?: boolean;
  onToggle?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

/** Một dòng trong nhóm 'Chi tiết chuyến đi': nhãn + giá trị hiện tại; chạm để mở phần chỉnh sửa. */
function Row({ icon, label, value, isOpen, aiFilled, onToggle, right, children }: RowProps) {
  const expandable = !!children;
  return (
    <View style={styles.rowWrap}>
      <Pressable
        onPress={expandable ? onToggle : undefined}
        style={({ pressed }) => [styles.row, pressed && expandable && { backgroundColor: colors.sunken }]}
      >
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.rowLabel}>{label}</Text>
            {aiFilled && (
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>AI điền</Text>
              </View>
            )}
          </View>
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        </View>
        {right ?? (expandable ? <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} /> : null)}
      </Pressable>
      {isOpen && expandable ? <View style={styles.rowBody}>{children}</View> : null}
    </View>
  );
}

export default function BriefScreen({
  initialDraft,
  apiBaseUrl,
  hasSavedPlan,
  onBackToPlan,
  onOpenSettings,
  onGenerate,
  onDraftChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<BriefDraft>(initialDraft);
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  const [open, setOpen] = useState<RowKey | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [budgetText, setBudgetText] = useState(String(Math.round(initialDraft.budget / 1000)));
  const [customVibe, setCustomVibe] = useState('');
  const [parsing, setParsing] = useState(false);
  const [aiResult, setAiResult] = useState<{ ok: boolean; summary: string } | null>(null);
  const [aiFilled, setAiFilled] = useState<RowKey[]>([]);

  const update = (patch: Partial<BriefDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleRow = (k: RowKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === k ? null : k));
  };

  const setBudget = (vnd: number) => {
    update({ budget: vnd });
    setBudgetText(String(Math.round(vnd / 1000)));
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
  const shiftStart = (delta: number) =>
    update({ startKey: minToHm(clamp(startKeyToMin(draft.startKey) + delta, 6 * 60, 22 * 60)) });

  // Mô tả bằng lời → AI phân tích → điền form. Mọi dòng bên dưới vẫn sửa được trước khi tạo lộ trình.
  const analyze = async () => {
    const text = draft.description.trim();
    if (!text || parsing) return;
    setParsing(true);
    setAiResult(null);
    try {
      const p = await parseBrief(apiBaseUrl, text);
      const patch: Partial<BriefDraft> = {};
      const filled: RowKey[] = [];
      if (p.budget_per_person_vnd) {
        patch.budget = Math.max(BUDGET_MIN, p.budget_per_person_vnd);
        setBudgetText(String(Math.round(patch.budget / 1000)));
        filled.push('budget');
      }
      if (p.people_count) {
        patch.people = clamp(p.people_count, 1, 20);
        filled.push('people');
      }
      const coreVibes = p.vibes.filter((v) => VIBE_OPTIONS.some((o) => o.key === v));
      if (coreVibes.length) patch.vibes = coreVibes;
      if (p.extra_interests.length) patch.extraVibes = Array.from(new Set([...draft.extraVibes, ...p.extra_interests]));
      if (coreVibes.length || p.extra_interests.length) filled.push('vibes');
      const goal = NUTRITION_OPTIONS.find((n) => n.key === p.nutrition_goal);
      if (goal) {
        patch.nutrition = goal.key;
        filled.push('nutrition');
      }
      if (p.start_time) patch.startKey = p.start_time;
      if (p.duration_minutes) {
        patch.durationMin = clamp(Math.round(p.duration_minutes / 30) * 30, DURATION_MIN, DURATION_MAX);
      }
      if (p.start_time || p.duration_minutes) filled.push('time');
      const area = QUICK_AREAS.find((a) => a.key === p.area_key);
      if (area) {
        patch.originKey = area.key;
        patch.origin = area.origin;
        filled.push('origin');
      }
      patch.note = p.note;
      if (p.note) filled.push('note');
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      update(patch);
      setOpen(null);
      setAiFilled(filled);
      setAiResult({
        ok: p.engine === 'openai',
        summary: p.summary || 'Đã điền sẵn các mục bên dưới từ mô tả của bạn.',
      });
    } catch (e: any) {
      setAiResult({ ok: false, summary: `Chưa phân tích được: ${e?.message ?? 'lỗi kết nối'}` });
    } finally {
      setParsing(false);
    }
  };

  const locateMe = async () => {
    setLocating(true);
    setGpsMsg(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        update({ originKey: 'venue', origin: VENUE_ORIGIN });
        setGpsMsg('Chưa cấp quyền vị trí, đang dùng điểm mặc định.');
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]);
      const coords = pos?.coords ?? (await Location.getLastKnownPositionAsync())?.coords;
      if (!coords) {
        update({ originKey: 'venue', origin: VENUE_ORIGIN });
        setGpsMsg('Không lấy được GPS, đang dùng điểm mặc định.');
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
      update({ originKey: 'gps', origin: { lat: coords.latitude, lng: coords.longitude, label } });
    } catch {
      update({ originKey: 'venue', origin: VENUE_ORIGIN });
      setGpsMsg('GPS lỗi, đang dùng điểm mặc định.');
    } finally {
      setLocating(false);
    }
  };

  const tw = resolveTimeWindow(draft.startKey, draft.durationMin);
  const area = QUICK_AREAS.find((a) => a.key === draft.originKey);
  const vibeText = [
    ...VIBE_OPTIONS.filter((v) => draft.vibes.includes(v.key)).map((v) => v.label),
    ...draft.extraVibes,
  ].join(', ');
  const nutritionLabel = NUTRITION_OPTIONS.find((n) => n.key === draft.nutrition)?.label ?? 'Cân bằng';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Logo size={32} />
        <View style={{ flex: 1 }} />
        {hasSavedPlan && <IconButton icon="map-outline" label="Lộ trình gần nhất" onPress={onBackToPlan} />}
        <IconButton icon="settings-outline" label="Cài đặt" onPress={onOpenSettings} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hello}>Hôm nay đi đâu?</Text>
        <Text style={styles.helloSub}>Kể kế hoạch bằng lời — Dayout điền sẵn mọi thứ, bạn chỉ cần chỉnh lại.</Text>

        {/* Composer: mô tả bằng lời */}
        <View style={styles.composer}>
          <TextInput
            value={draft.description}
            onChangeText={(t) => update({ description: t.slice(0, 600) })}
            placeholder="Ví dụ: tối nay hẹn hò ở Hồ Tây, mỗi người 400k, ăn healthy…"
            placeholderTextColor={colors.textFaint}
            style={styles.composerInput}
            multiline
          />
          {!draft.description && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examples}>
              {DESCRIPTION_EXAMPLES.map((ex) => (
                <Pressable key={ex} onPress={() => update({ description: ex })} style={styles.example}>
                  <Text style={styles.exampleText} numberOfLines={1}>
                    {ex}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={styles.composerBar}>
            {!!draft.description && (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  update({ description: '' });
                  setAiResult(null);
                  setAiFilled([]);
                }}
              >
                <Text style={styles.clearText}>Xoá</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={analyze}
              disabled={!draft.description.trim() || parsing}
              style={({ pressed }) => [
                styles.analyzeBtn,
                (!draft.description.trim() || parsing) && styles.analyzeBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
            >
              {parsing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={15} color="#fff" />
                  <Text style={styles.analyzeText}>Điền giúp tôi</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
        {aiResult && (
          <View style={[styles.aiNote, !aiResult.ok && styles.aiNoteWarn]}>
            <Ionicons
              name={aiResult.ok ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={aiResult.ok ? colors.success : colors.amber}
            />
            <Text style={styles.aiNoteText}>
              {aiResult.summary}
              {aiFilled.length ? ' Các mục có nhãn "AI điền" — chạm để sửa.' : ''}
            </Text>
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.overline}>CHI TIẾT CHUYẾN ĐI</Text>
          <Text style={styles.sectionHint}>Chạm để chỉnh</Text>
        </View>

        <View style={styles.group}>
          <Row isOpen={open === 'origin'} aiFilled={aiFilled.includes('origin')} onToggle={() => toggleRow('origin')} icon="location-outline" label="Xuất phát" value={area?.title ?? draft.origin.label}>
            <Text style={styles.bodyText} numberOfLines={2}>
              {draft.origin.label}
            </Text>
            <PlaceSearch
              placeholder="Nhập địa chỉ, quán, toà nhà… (VD: Times City)"
              onPick={(h) => {
                update({ originKey: 'custom', origin: { lat: h.lat, lng: h.lng, label: h.label } });
                setGpsMsg(null);
              }}
            />
            <Pressable style={styles.gpsBtn} onPress={locateMe} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={colors.info} />
              ) : (
                <>
                  <Ionicons name="navigate-outline" size={16} color={colors.info} />
                  <Text style={styles.gpsText}>Dùng vị trí hiện tại</Text>
                </>
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
          </Row>

          <Row
            isOpen={open === 'destination'}
            onToggle={() => toggleRow('destination')}
            icon="flag-outline"
            label="Kết thúc"
            value={draft.destination ? draft.destination.label.split(',')[0] : 'Không cố định'}
          >
            {draft.destination && (
              <Text style={styles.bodyText} numberOfLines={2}>
                {draft.destination.label}
              </Text>
            )}
            <PlaceSearch
              placeholder="Muốn kết thúc ở đâu? (VD: nhà, ký túc xá…)"
              onPick={(h) => update({ destination: { lat: h.lat, lng: h.lng, label: h.label } })}
            />
            <View style={styles.chips}>
              <Chip small label="Không cố định" selected={!draft.destination} onPress={() => update({ destination: null })} />
              <Chip
                small
                label="Về điểm xuất phát"
                selected={!!draft.destination && draft.destination.lat === draft.origin.lat && draft.destination.lng === draft.origin.lng}
                onPress={() => update({ destination: { ...draft.origin } })}
              />
              {QUICK_AREAS.map((a) => (
                <Chip
                  key={a.key}
                  small
                  label={a.title}
                  selected={!!draft.destination && draft.destination.lat === a.origin.lat && draft.destination.lng === a.origin.lng}
                  onPress={() => update({ destination: { ...a.origin } })}
                />
              ))}
            </View>
          </Row>

          <Row isOpen={open === 'budget'} aiFilled={aiFilled.includes('budget')} onToggle={() => toggleRow('budget')} icon="wallet-outline" label="Ngân sách" value={`${draft.budget.toLocaleString('vi-VN')}đ / người`}>
            <View style={styles.budgetBox}>
              <TextInput
                value={budgetText}
                onChangeText={onBudgetChange}
                onBlur={onBudgetBlur}
                keyboardType="number-pad"
                returnKeyType="done"
                placeholder="350"
                placeholderTextColor={colors.textFaint}
                style={[styles.budgetInput, { width: 22 + Math.max(3, budgetText.length) * 19 }]}
                selectTextOnFocus
              />
              <Text style={styles.budgetUnit}>.000đ / người</Text>
            </View>
            <View style={styles.chips}>
              {BUDGET_PRESETS.map((b) => (
                <Chip key={b} small label={formatVndShort(b)} selected={draft.budget === b} onPress={() => setBudget(b)} />
              ))}
            </View>
          </Row>

          <Row isOpen={open === 'people'} aiFilled={aiFilled.includes('people')} onToggle={() => toggleRow('people')}
            icon="people-outline"
            label="Số người"
            value={`${draft.people} người`}
            right={
              <View style={styles.stepper}>
                <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => update({ people: Math.max(1, draft.people - 1) })}>
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Text style={styles.stepValue}>{draft.people}</Text>
                <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => update({ people: Math.min(20, draft.people + 1) })}>
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
            }
          />

          <Row
            icon="git-commit-outline"
            label="Số điểm dừng"
            value={draft.stopCount ? `Khoảng ${draft.stopCount} điểm (AI được ±1)` : 'AI tự quyết theo thời gian & sở thích'}
            right={
              <View style={styles.stepper}>
                <Pressable
                  hitSlop={6}
                  style={styles.stepBtn}
                  onPress={() => {
                    // Chuỗi: AI ← 1 ← 2 … ← 8 (giảm từ 1 là quay về AI tự quyết).
                    update({ stopCount: !draft.stopCount || draft.stopCount <= 1 ? null : draft.stopCount - 1 });
                  }}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Pressable hitSlop={6} onPress={() => update({ stopCount: null })}>
                  <Text style={styles.stepValue}>{draft.stopCount ?? 'AI'}</Text>
                </Pressable>
                <Pressable
                  hitSlop={6}
                  style={styles.stepBtn}
                  onPress={() => {
                    // Chuỗi: AI → 1 → 2 … → 8.
                    update({ stopCount: draft.stopCount ? Math.min(8, draft.stopCount + 1) : 1 });
                  }}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
            }
          />

          <Row isOpen={open === 'time'} aiFilled={aiFilled.includes('time')} onToggle={() => toggleRow('time')} icon="time-outline" label="Thời gian" value={`${tw.start} – ${tw.end} · ${formatDuration(draft.durationMin)}`}>
            <View style={styles.chips}>
              {START_TIME_OPTIONS.map((t) => (
                <Chip key={t.key} small label={t.label} selected={draft.startKey === t.key} onPress={() => update({ startKey: t.key })} />
              ))}
            </View>
            <View style={styles.inlineRow}>
              <Text style={styles.inlineLabel}>Bắt đầu</Text>
              <View style={styles.stepper}>
                <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => shiftStart(-30)}>
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Text style={styles.stepValueWide}>{tw.start}</Text>
                <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => shiftStart(30)}>
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
            </View>
            <View style={styles.inlineRow}>
              <Text style={styles.inlineLabel}>Thời lượng</Text>
              <View style={styles.stepper}>
                <Pressable
                  hitSlop={6}
                  style={styles.stepBtn}
                  onPress={() => update({ durationMin: clamp(draft.durationMin - 60, DURATION_MIN, DURATION_MAX) })}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Text style={styles.stepValueWide}>{formatDuration(draft.durationMin)}</Text>
                <Pressable
                  hitSlop={6}
                  style={styles.stepBtn}
                  onPress={() => update({ durationMin: clamp(draft.durationMin + 60, DURATION_MIN, DURATION_MAX) })}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </Row>

          <Row isOpen={open === 'vibes'} aiFilled={aiFilled.includes('vibes')} onToggle={() => toggleRow('vibes')} icon="heart-outline" label="Sở thích" value={vibeText || 'Tuỳ Dayout chọn'}>
            <View style={styles.chips}>
              {VIBE_OPTIONS.map((v) => (
                <Chip key={v.key} small icon={v.icon} label={v.label} selected={draft.vibes.includes(v.key)} onPress={() => toggleVibe(v.key)} />
              ))}
            </View>
            <Text style={styles.subhead}>Thêm</Text>
            <View style={styles.chips}>
              {[...EXTRA_VIBES, ...draft.extraVibes.filter((v) => !EXTRA_VIBES.includes(v))].map((v) => (
                <Chip key={v} small label={v} selected={draft.extraVibes.includes(v)} onPress={() => toggleExtra(v)} />
              ))}
            </View>
            <View style={styles.addRow}>
              <TextInput
                value={customVibe}
                onChangeText={setCustomVibe}
                onSubmitEditing={addCustomVibe}
                returnKeyType="done"
                placeholder="Sở thích khác, VD: rooftop"
                placeholderTextColor={colors.textFaint}
                style={styles.addInput}
                maxLength={40}
              />
              <Pressable style={styles.addBtn} onPress={addCustomVibe} hitSlop={6}>
                <Ionicons name="add" size={20} color="#fff" />
              </Pressable>
            </View>
          </Row>

          <Row isOpen={open === 'nutrition'} aiFilled={aiFilled.includes('nutrition')} onToggle={() => toggleRow('nutrition')} icon="leaf-outline" label="Dinh dưỡng" value={nutritionLabel}>
            <View style={styles.chips}>
              {NUTRITION_OPTIONS.map((n) => (
                <Chip
                  key={n.key}
                  small
                  icon={n.icon}
                  tone="success"
                  label={n.label}
                  selected={draft.nutrition === n.key}
                  onPress={() => update({ nutrition: n.key })}
                />
              ))}
            </View>
          </Row>

          <Row isOpen={open === 'note'} aiFilled={aiFilled.includes('note')} onToggle={() => toggleRow('note')} icon="create-outline" label="Ghi chú" value={draft.note || 'Không có'}>
            <TextInput
              value={draft.note}
              onChangeText={(t) => update({ note: t.slice(0, 300) })}
              placeholder="Ăn chay, không cay, cần chỗ gửi xe…"
              placeholderTextColor={colors.textFaint}
              style={styles.noteInput}
              multiline
            />
            <View style={styles.chips}>
              {NOTE_SUGGESTIONS.map((s) => (
                <Chip
                  key={s}
                  small
                  label={s}
                  selected={draft.note.toLowerCase().includes(s.toLowerCase())}
                  onPress={() =>
                    update({
                      note: draft.note.toLowerCase().includes(s.toLowerCase())
                        ? draft.note
                        : draft.note
                          ? `${draft.note}, ${s.toLowerCase()}`
                          : s,
                    })
                  }
                />
              ))}
            </View>
          </Row>
        </View>

        <Text style={styles.server} numberOfLines={1}>
          Máy chủ: {apiBaseUrl.replace(/^https?:\/\//, '')}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
          onPress={() => onGenerate(draftToRequest(draft), draft)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaText}>Lên lộ trình</Text>
            <Text style={styles.ctaSub} numberOfLines={1}>
              {area?.title ?? 'Vị trí của bạn'} · {formatVndShort(draft.budget)}/người · {draft.people} người · {tw.start}
            </Text>
          </View>
          <View style={styles.ctaArrow}>
            <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hello: { ...type.display, marginTop: 14 },
  helloSub: { fontSize: 15, color: colors.textMuted, marginTop: 6, lineHeight: 21 },

  composer: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadow,
  },
  composerInput: { minHeight: 76, fontSize: 16, lineHeight: 22, color: colors.text, textAlignVertical: 'top', padding: 0 },
  examples: { marginTop: 10, marginHorizontal: -4 },
  example: {
    maxWidth: 260,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.sunken,
  },
  exampleText: { fontSize: 13, color: colors.textMuted },
  composerBar: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  clearText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    minWidth: 130,
    justifyContent: 'center',
  },
  analyzeBtnDisabled: { backgroundColor: colors.textFaint },
  analyzeText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 6 },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  aiNoteWarn: { backgroundColor: colors.amberSoft },
  aiNoteText: { flex: 1, marginLeft: 8, fontSize: 14, lineHeight: 20, color: colors.text },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 8 },
  overline: type.overline,
  sectionHint: { fontSize: 12, color: colors.textFaint },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rowWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 1, marginRight: 8 },
  aiTag: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.primarySoft },
  aiTagText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark },
  rowBody: { paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 60 },
  bodyText: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
  subhead: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.infoSoft,
    marginBottom: 10,
  },
  gpsText: { color: colors.info, fontWeight: '600', fontSize: 13, marginLeft: 6 },

  budgetBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    marginBottom: 12,
  },
  budgetInput: { fontSize: 30, fontWeight: '800', color: colors.text, paddingVertical: 4, paddingHorizontal: 0 },
  budgetUnit: { fontSize: 16, fontWeight: '600', color: colors.textMuted, marginLeft: 2 },

  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { width: 32, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  stepValueWide: { minWidth: 72, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text },
  inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  inlineLabel: { fontSize: 14, color: colors.text },

  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  addInput: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  noteInput: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  server: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 16 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    paddingLeft: 20,
    paddingRight: 10,
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2, fontWeight: '500' },
  ctaArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
