import type { NutritionGoal, Origin, Vibe } from './types';

export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const VENUE_ORIGIN: Origin = {
  lat: 21.0012,
  lng: 105.8035,
  label: '79 Nguyễn Như Kon Tum, Thanh Xuân, Hà Nội',
};

export const QUICK_AREAS: { key: string; title: string; origin: Origin }[] = [
  { key: 'venue', title: 'Hội trường Thanh Xuân', origin: VENUE_ORIGIN },
  {
    key: 'hoan_kiem',
    title: 'Hồ Gươm',
    origin: { lat: 21.0287, lng: 105.8524, label: 'Hồ Hoàn Kiếm, Hoàn Kiếm, Hà Nội' },
  },
  {
    key: 'cau_giay',
    title: 'Cầu Giấy',
    origin: { lat: 21.0328, lng: 105.7938, label: 'Công viên Cầu Giấy, Cầu Giấy, Hà Nội' },
  },
  {
    key: 'tay_ho',
    title: 'Hồ Tây',
    origin: { lat: 21.0583, lng: 105.8262, label: 'Hồ Tây, Tây Hồ, Hà Nội' },
  },
  {
    key: 'dong_da',
    title: 'Đống Đa',
    origin: { lat: 21.0136, lng: 105.8235, label: 'Thái Hà, Đống Đa, Hà Nội' },
  },
];

export const VIBE_OPTIONS: { key: Vibe; label: string; emoji: string }[] = [
  { key: 'chill_cafe', label: 'Cafe chill', emoji: '☕' },
  { key: 'interactive_activity', label: 'Workshop / Vui chơi', emoji: '🎳' },
  { key: 'local_food', label: 'Ẩm thực địa phương', emoji: '🍜' },
  { key: 'photo_spot', label: 'Chụp ảnh', emoji: '📸' },
  { key: 'night_chill', label: 'Chill buổi tối', emoji: '🌙' },
];

export const NUTRITION_OPTIONS: { key: NutritionGoal; label: string; emoji: string }[] = [
  { key: 'balanced', label: 'Cân bằng', emoji: '⚖️' },
  { key: 'eat_clean', label: 'Eat Clean', emoji: '🥗' },
  { key: 'high_protein', label: 'Giàu Protein', emoji: '💪' },
  { key: 'low_sugar', label: 'Ít đường', emoji: '🍃' },
];

export const BUDGET_PRESETS = [150000, 250000, 350000, 500000, 800000, 1200000];
export const BUDGET_MIN = 50000; // backend-node chặn dưới 50k
export const BUDGET_MAX = 3000000;
export const BUDGET_STEP = 50000;

export const START_TIME_OPTIONS: { key: string; label: string }[] = [
  { key: 'now', label: 'Ngay bây giờ' },
  { key: '09:00', label: 'Sáng 9:00' },
  { key: '14:00', label: 'Chiều 14:00' },
  { key: '18:00', label: 'Tối 18:00' },
];

export const DURATION_MIN = 120;
export const DURATION_MAX = 14 * 60;
export const DURATION_DEFAULT = 7 * 60;

// Sở thích mở rộng: FastAPI chỉ chấm điểm theo 5 vibe chuẩn ở trên, nên các sở thích này
// (và sở thích người dùng tự gõ) được gửi qua prompt_note để OpenAI đọc và cân nhắc.
export const EXTRA_VIBES = [
  'Lãng mạn',
  'Thiên nhiên / Công viên',
  'Nghệ thuật / Triển lãm',
  'Âm nhạc / Acoustic',
  'Mua sắm',
  'Thể thao / Vận động',
  'Hợp trẻ em',
  'Yên tĩnh, ít người',
];

export const NOTE_SUGGESTIONS = [
  'Đi hẹn hò cuối tuần',
  'Nhóm bạn thân',
  'Ít dầu mỡ',
  'Không gian thoáng',
  'Ăn chay',
  'Không ăn cay',
  'Dị ứng hải sản',
  'Có chỗ gửi xe máy',
];

export const STORAGE_KEYS = {
  savedPlan: 'dayout.savedPlan.v1',
  apiBaseUrl: 'dayout.apiBaseUrl.v1',
  lastBrief: 'dayout.lastBrief.v1',
} as const;

export const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  cafe: { label: 'Cafe', emoji: '☕' },
  activity: { label: 'Hoạt động', emoji: '🎨' },
  food: { label: 'Ăn uống', emoji: '🍜' },
  dessert_chill: { label: 'Tráng miệng & Chill', emoji: '🍧' },
};
