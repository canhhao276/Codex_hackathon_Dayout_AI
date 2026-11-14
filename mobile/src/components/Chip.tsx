import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** @deprecated dùng icon */
  emoji?: string;
  tone?: 'primary' | 'accent' | 'success';
  small?: boolean;
}

export default function Chip({ label, selected, onPress, icon, tone = 'primary', small }: Props) {
  const on = tone === 'success' ? colors.success : tone === 'accent' ? colors.primary : colors.ink;
  const fg = selected ? '#FFFFFF' : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        small && styles.small,
        selected && { backgroundColor: on, borderColor: on },
        pressed && { opacity: 0.75 },
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 14 : 16} color={selected ? '#FFFFFF' : colors.textMuted} style={styles.icon} />}
      <Text style={[styles.text, small && styles.smallText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  small: { paddingHorizontal: 12, paddingVertical: 6 },
  icon: { marginRight: 6 },
  text: { fontSize: 14, fontWeight: '600' },
  smallText: { fontSize: 13 },
});
