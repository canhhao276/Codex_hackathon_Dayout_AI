// Dayout — nền giấy kem ấm, chữ mực, một màu nhấn hồng xiêm (persimmon). Không gradient, ít emoji.
export const colors = {
  bg: '#F6F2EA',
  card: '#FFFFFF',
  sunken: '#EFE9DE',
  text: '#1D1B18',
  textMuted: '#7A746A',
  textFaint: '#A8A196',
  border: '#E6DFD2',
  primary: '#E2552C',
  primaryDark: '#B9401D',
  primarySoft: '#FCEBE4',
  ink: '#1D1B18',
  accent: '#E2552C',
  accentSoft: '#FCEBE4',
  success: '#2E7A57',
  successSoft: '#E4F1EA',
  danger: '#C2362B',
  dangerSoft: '#FBE7E4',
  info: '#2F64C8',
  infoSoft: '#E7EEFB',
  amber: '#A86A12',
  amberSoft: '#FBF1DE',
  overlay: 'rgba(29, 27, 24, 0.5)',
};

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

export const shadow = {
  shadowColor: '#3B2F1E',
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
