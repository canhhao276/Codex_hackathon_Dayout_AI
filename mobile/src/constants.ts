import type Ionicons from '@expo/vector-icons/Ionicons';
import type { NutritionGoal, Origin, Vibe } from './types';

export type IconName = keyof typeof Ionicons.glyphMap;

export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const VENUE_ORIGIN: Origin = {
  lat: 21.0012,
  lng: 105.8035,
  label: '79 Nguyễn Như Kon Tum, Thanh Xuân, Hà Nội',
};

export const QUICK_AREAS: { key: string; title: string; origin: Origin }[] = [
  { key: 'venue', title: 'Thanh Xuân', origin: VENUE_ORIGIN },
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

export const VIBE_OPTIONS: { key: Vibe; label: string; icon: IconName }[] = [
  { key: 'chill_cafe', label: 'Cafe chill', icon: 'cafe-outline' },
  { key: 'interactive_activity', label: 'Vui chơi, workshop', icon: 'color-palette-outline' },
  { key: 'local_food', label: 'Ăn uống', icon: 'restaurant-outline' },
  { key: 'photo_spot', label: 'Chụp ảnh', icon: 'camera-outline' },
  { key: 'night_chill', label: 'Đi tối', icon: 'moon-outline' },
];

export const NUTRITION_OPTIONS: { key: NutritionGoal; label: string; icon: IconName }[] = [
  { key: 'balanced', label: 'Cân bằng', icon: 'nutrition-outline' },
  { key: 'eat_clean', label: 'Eat Clean', icon: 'leaf-outline' },
  { key: 'high_protein', label: 'Giàu đạm', icon: 'barbell-outline' },
  { key: 'low_sugar', label: 'Ít đường', icon: 'water-outline' },
];

export const BUDGET_PRESETS = [150000, 250000, 350000, 500000, 1000000];
export const BUDGET_MIN = 50000; // backend-node chặn dưới 50k

export const START_TIME_OPTIONS: { key: string; label: string }[] = [
  { key: 'now', label: 'Bây giờ' },
  { key: '09:00', label: 'Sáng' },
  { key: '14:00', label: 'Chiều' },
  { key: '18:00', label: 'Tối' },
];

export const DURATION_MIN = 120;
export const DURATION_MAX = 14 * 60;
export const DURATION_DEFAULT = 7 * 60;

// Sở thích mở rộng: FastAPI chỉ chấm điểm theo 5 vibe chuẩn ở trên, nên các sở thích này
// (và sở thích người dùng tự gõ) được gửi qua prompt_note để OpenAI đọc và cân nhắc.
export const EXTRA_VIBES = [
  'Photobooth',
  'Lãng mạn',
  'Thiên nhiên',
  'Triển lãm',
  'Acoustic',
  'Mua sắm',
  'Vận động',
  'Hợp trẻ em',
  'Yên tĩnh',
];

export const NOTE_SUGGESTIONS = [
  'Đi hẹn hò',
  'Nhóm bạn thân',
  'Ít dầu mỡ',
  'Không gian thoáng',
  'Ăn chay',
  'Không ăn cay',
  'Dị ứng hải sản',
  'Có chỗ gửi xe máy',
];

export const DESCRIPTION_EXAMPLES = [
  'Tối nay hẹn hò ở Hồ Tây, mỗi người 400k, ăn healthy',
  'Chiều mai 4 đứa bạn đi Hồ Gươm, chụp ảnh, ăn đặc sản, tầm 300k/người',
  'Sáng chủ nhật dẫn con đi chơi Cầu Giấy, 2 lớn 1 nhỏ, ít đường',
];

export const STORAGE_KEYS = {
  savedPlan: 'dayout.savedPlan.v1',
  apiBaseUrl: 'dayout.apiBaseUrl.v1',
  lastBrief: 'dayout.lastBrief.v1',
} as const;

export const CATEGORY_META: Record<string, { label: string; icon: IconName }> = {
  cafe: { label: 'Cafe', icon: 'cafe-outline' },
  activity: { label: 'Hoạt động', icon: 'color-palette-outline' },
  food: { label: 'Ăn uống', icon: 'restaurant-outline' },
  dessert_chill: { label: 'Tráng miệng', icon: 'ice-cream-outline' },
};
