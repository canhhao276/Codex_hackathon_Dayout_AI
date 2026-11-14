import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/** Hình học logo (toạ độ 64×64) — dùng chung cho app và script xuất icon PNG. */
export const LOGO_PATHS = {
  // Đường đi chấm chấm từ điểm xuất phát (dưới trái) uốn tới ghim đích (trên phải).
  route: 'M26 45.5 C 33 44.5, 25.5 34.5, 34 33.6 S 41.5 34, 42.6 32.4',
  // Ghim đích.
  pin: 'M43 10.5c-5.8 0-10.5 4.5-10.5 10.1 0 7.1 8.6 13.6 9.6 14.3a1.6 1.6 0 0 0 1.8 0c1-.7 9.6-7.2 9.6-14.3 0-5.6-4.7-10.1-10.5-10.1Z',
  pinHole: { cx: 43, cy: 20.6, r: 3.7 },
  start: { cx: 18.5, cy: 46.5, r: 4.6 },
};

/** Logo Dayout: một lộ trình trong ngày — điểm xuất phát, đường đi, ghim đích. */
export function LogoMark({ size = 36, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="0" y="0" width="64" height="64" rx={rounded ? 16 : 0} fill={colors.primary} />
      <Path
        d={LOGO_PATHS.route}
        stroke="#FFFFFF"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeDasharray="0.1 6.2"
        fill="none"
      />
      <Circle {...LOGO_PATHS.start} fill="#FFFFFF" />
      <Circle cx={LOGO_PATHS.start.cx} cy={LOGO_PATHS.start.cy} r={1.9} fill={colors.primary} />
      <Path d={LOGO_PATHS.pin} fill="#FFFFFF" />
      <Circle {...LOGO_PATHS.pinHole} fill={colors.primary} />
    </Svg>
  );
}

export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <Text style={[styles.word, { fontSize: size * 0.62 }]}>
        dayout<Text style={styles.dot}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { marginLeft: 9, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  dot: { color: colors.primary },
});
