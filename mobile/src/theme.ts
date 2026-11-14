// Dayout — tông xanh dương & trắng: nền trắng xanh nhạt, chữ xanh than, một màu nhấn xanh "mặt hồ".
export const colors = {
  bg: '#F4F7FB',
  card: '#FFFFFF',
  sunken: '#EAF0F7',
  text: '#14213D',
  textMuted: '#5B6B82',
  textFaint: '#9AA8BA',
  border: '#DCE4EE',
  primary: '#1F6FD1',
  primaryDark: '#1556A8',
  primarySoft: '#E6F0FC',
  ink: '#14213D',
  accent: '#1F6FD1',
  accentSoft: '#E6F0FC',
  success: '#12805C',
  successSoft: '#E3F4EE',
  danger: '#C8372D',
  dangerSoft: '#FBE8E6',
  info: '#1F6FD1',
  infoSoft: '#E6F0FC',
  // Điểm ngoài trời: xanh lá ngọc (hài hoà với xanh dương, khác biệt đủ để nhận ra).
  outdoor: '#0F9B8E',
  amber: '#A86A12',
  amberSoft: '#FBF1DE',
  overlay: 'rgba(20, 33, 61, 0.45)',
};

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

export const shadow = {
  shadowColor: '#14213D',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export const type = {
  display: { fontSize: 28, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.6 },
  title: { fontSize: 17, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted },
  overline: { fontSize: 11, fontWeight: '700' as const, color: colors.textMuted, letterSpacing: 0.8 },
};
