import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { generateItinerary, replanItinerary } from './src/api';
import LoadingOverlay from './src/components/LoadingOverlay';
import SettingsModal from './src/components/SettingsModal';
import { DEFAULT_API_BASE_URL } from './src/constants';
import { formatVndShort } from './src/format';
import { buildSampleItinerary, sampleReplan } from './src/sampleData';
import BriefScreen, { DEFAULT_DRAFT } from './src/screens/BriefScreen';
import PlanScreen from './src/screens/PlanScreen';
import { storage, type BriefDraft } from './src/storage';
import { colors } from './src/theme';
import type {
  GenerateRequest,
  ItineraryResponse,
  ItinerarySummary,
  ReplanReason,
  SavedPlan,
} from './src/types';

type Screen = 'brief' | 'plan';

const GENERATE_STEPS = [
  'Đang lọc địa điểm thật quanh bạn…',
  'Cân đối ngân sách & chế độ dinh dưỡng…',
  'AI chọn 3–4 điểm dừng hợp vibe…',
  'Tối ưu thứ tự & vẽ đường đi OSRM…',
  'Sắp xong rồi…',
];

const REPLAN_STEPS: Record<ReplanReason, string[]> = {
  rainy_weather: ['Trời mưa! Tìm điểm trong nhà gần đó…', 'Giữ nguyên các chặng tốt…', 'Vẽ lại lộ trình…'],
  crowded: ['Tìm quán thay thế gần lộ trình…', 'So sánh giá & calo…', 'Vẽ lại lộ trình…'],
  tighter_budget: ['Siết ngân sách −20%…', 'Tìm lựa chọn rẻ hơn mà vẫn ngon…', 'Cập nhật tổng chi phí…'],
  lower_calories: ['Tìm món nhẹ calo hơn…', 'Giữ đúng chế độ dinh dưỡng…', 'Cập nhật tổng calo…'],
};

const REPLAN_TITLES: Record<ReplanReason, string> = {
  rainy_weather: '🌧️ AI đổi sang điểm trong nhà',
  crowded: '🔄 AI đang đổi quán',
  tighter_budget: '💸 AI tối ưu ngân sách',
  lower_calories: '🥗 AI giảm calo',
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<Screen>('brief');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [draft, setDraft] = useState<BriefDraft>(DEFAULT_DRAFT);
  const [restored, setRestored] = useState(false);
  const [changedStopIds, setChangedStopIds] = useState<string[]>([]);
  const [prevSummary, setPrevSummary] = useState<ItinerarySummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState<{ title: string; steps: string[] } | null>(null);
  const busy = useRef(false);

  // Khôi phục state sau khi force-close (Tiêu chí 40 điểm).
  useEffect(() => {
    (async () => {
      const [url, saved, brief] = await Promise.all([
        storage.loadApiBaseUrl(),
        storage.loadPlan(),
        storage.loadBrief(),
      ]);
      setApiBaseUrl(url);
      if (brief) setDraft({ ...DEFAULT_DRAFT, ...brief });
      if (saved?.itinerary?.stops?.length) {
        setPlan(saved);
        setRestored(true);
        setScreen('plan');
      }
      setBooting(false);
    })();
  }, []);

  // Nút Back Android: từ Brief quay lại bản đồ nếu đã có lịch trình.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'brief' && plan) {
        setScreen('plan');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen, plan]);

  const commitPlan = useCallback(async (next: SavedPlan) => {
    setPlan(next);
    await storage.savePlan(next);
  }, []);

  const saveApiUrl = useCallback(async (url: string) => {
    setApiBaseUrl(url);
    setSettingsOpen(false);
    await storage.saveApiBaseUrl(url);
  }, []);

  const showSample = useCallback(
    async (req: GenerateRequest) => {
      const itin = buildSampleItinerary(req);
      await commitPlan({ itinerary: itin, request: req, saved_at: new Date().toISOString(), is_sample: true });
      setChangedStopIds([]);
      setPrevSummary(null);
      setRestored(false);
      setScreen('plan');
    },
    [commitPlan],
  );

  const handleGenerate = useCallback(
    async (req: GenerateRequest, nextDraft: BriefDraft) => {
      if (busy.current) return;
      busy.current = true;
      setDraft(nextDraft);
      storage.saveBrief(nextDraft);
      setLoading({ title: '✨ AI đang lên lộ trình', steps: GENERATE_STEPS });
      try {
        const itin = await generateItinerary(apiBaseUrl, req);
        await commitPlan({ itinerary: itin, request: req, saved_at: new Date().toISOString(), is_sample: false });
        setChangedStopIds([]);
        setPrevSummary(null);
        setRestored(false);
        setScreen('plan');
      } catch (e: any) {
        setLoading(null);
        Alert.alert('Chưa tạo được lịch trình', `${e?.message ?? 'Lỗi không xác định'}\n\nServer: ${apiBaseUrl}`, [
          { text: 'Sửa API URL', onPress: () => setSettingsOpen(true) },
          { text: 'Xem bản mẫu', onPress: () => showSample(req) },
          { text: 'Thử lại', style: 'default', onPress: () => handleGenerate(req, nextDraft) },
        ]);
      } finally {
        busy.current = false;
        setLoading(null);
      }
    },
    [apiBaseUrl, commitPlan, showSample],
  );

  const handleReplan = useCallback(
    async (reason: ReplanReason, targetOrder: number, newBudget: number) => {
      if (!plan || busy.current) return;
      busy.current = true;
      setLoading({ title: REPLAN_TITLES[reason], steps: REPLAN_STEPS[reason] });
      const old = plan.itinerary;
      try {
        let next: ItineraryResponse;
        if (plan.is_sample) {
          await new Promise((r) => setTimeout(r, 900));
          next = sampleReplan(old, plan.request.origin, targetOrder, reason, newBudget);
        } else {
          next = await replanItinerary(apiBaseUrl, {
            current_itinerary: old,
            target_stop_order: targetOrder,
            reason,
            new_budget_vnd: newBudget,
          });
        }
        if (!next.share_url) next = { ...next, share_url: old.share_url };
        if (!next.summary.budget_per_person_vnd) {
          next = { ...next, summary: { ...next.summary, budget_per_person_vnd: newBudget } };
        }
        const oldIds = new Set(old.stops.map((s) => s.stop_id));
        const changed = next.stops.filter((s) => !oldIds.has(s.stop_id)).map((s) => s.stop_id);
        setPrevSummary(old.summary);
        setChangedStopIds(changed);
        setRestored(false);
        await commitPlan({
          ...plan,
          itinerary: next,
          request: { ...plan.request, budget_vnd: newBudget },
          saved_at: new Date().toISOString(),
        });
      } catch (e: any) {
        setLoading(null);
        Alert.alert('AI chưa đổi được chặng', e?.message ?? 'Lỗi không xác định', [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Thử lại', onPress: () => handleReplan(reason, targetOrder, newBudget) },
        ]);
      } finally {
        busy.current = false;
        setLoading(null);
      }
    },
    [apiBaseUrl, commitPlan, plan],
  );

  const handleShare = useCallback(async () => {
    if (!plan) return;
    const { itinerary, request } = plan;
    const s = itinerary.summary;
    const lines = [
      `🎉 Chốt kèo: ${s.title}`,
      `🕑 ${request.time_window.start}–${request.time_window.end} • 👥 ${request.people_count} người`,
      `💰 ~${formatVndShort(s.total_cost_per_person_vnd)}/người • 🔥 ~${Math.round(s.total_calories_kcal)} kcal${
        s.nutrition_badge ? ` • ${s.nutrition_badge}` : ''
      }`,
      '',
      ...itinerary.stops.map(
        (st) =>
          `${st.order}. ${st.start_time} ${st.name}${
            st.recommended_items.length ? ` — ${st.recommended_items.slice(0, 2).join(', ')}` : ''
          }`,
      ),
      '',
      itinerary.share_url ? `👉 Xem bản đồ & bấm tham gia kèo: ${itinerary.share_url}` : '',
      '— Lên kèo trong 10 giây bằng Dayout AI',
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
    try {
      await Share.share(
        { message: lines.join('\n'), title: `Kèo: ${s.title}`, url: itinerary.share_url || undefined },
        { dialogTitle: 'Share chốt kèo nhóm' },
      );
    } catch {
      // người dùng huỷ
    }
  }, [plan]);

  if (booting) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootBrand}>Dayout AI</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen === 'plan' && plan ? (
        <PlanScreen
          plan={plan}
          restored={restored}
          changedStopIds={changedStopIds}
          prevSummary={prevSummary}
          onReplan={handleReplan}
          onNew={() => setScreen('brief')}
          onOpenSettings={() => setSettingsOpen(true)}
          onShare={handleShare}
        />
      ) : (
        <BriefScreen
          initialDraft={draft}
          apiBaseUrl={apiBaseUrl}
          hasSavedPlan={!!plan}
          onBackToPlan={() => setScreen('plan')}
          onOpenSettings={() => setSettingsOpen(true)}
          onGenerate={handleGenerate}
        />
      )}
      <SettingsModal
        visible={settingsOpen}
        apiBaseUrl={apiBaseUrl}
        onClose={() => setSettingsOpen(false)}
        onSave={saveApiUrl}
      />
      <LoadingOverlay visible={!!loading} title={loading?.title ?? ''} steps={loading?.steps ?? ['']} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bootBrand: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
});
