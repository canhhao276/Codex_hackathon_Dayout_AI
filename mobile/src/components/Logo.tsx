import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/** Logo Dayout: ghim bản đồ có mặt trời bên trong — "một ngày đi chơi". */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="0" y="0" width="64" height="64" rx="16" fill={colors.primary} />
      <Path
        d="M32 12c-9.4 0-17 7.4-17 16.6 0 11.8 14.2 22.6 15.9 23.8a1.9 1.9 0 0 0 2.2 0C34.8 51.2 49 40.4 49 28.6 49 19.4 41.4 12 32 12Z"
        fill="#FFFFFF"
      />
      <Circle cx="32" cy="28.5" r="6.2" fill={colors.primary} />
      <Path
        d="M32 18.6v2.6M32 35.8v2.6M22.1 28.5h2.6M39.3 28.5h2.6M25 21.5l1.8 1.8M37.2 33.7l1.8 1.8M25 35.5l1.8-1.8M37.2 23.3l1.8-1.8"
        stroke={colors.primary}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
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
