import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
  tone?: 'primary' | 'accent' | 'success';
  small?: boolean;
}

export default function Chip({ label, selected, onPress, emoji, tone = 'primary', small }: Props) {
  const toneColor = tone === 'accent' ? colors.accent : tone === 'success' ? colors.success : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(79,70,229,0.12)', borderless: false }}
      style={[
        styles.chip,
        small && styles.small,
        selected && { backgroundColor: toneColor, borderColor: toneColor },
      ]}
    >
      <Text style={[styles.text, small && styles.smallText, selected && styles.textSelected]}>
        {emoji ? `${emoji} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  small: { paddingHorizontal: 11, paddingVertical: 6 },
  text: { fontSize: 14, fontWeight: '600', color: colors.text },
  smallText: { fontSize: 13 },
  textSelected: { color: '#fff' },
});
