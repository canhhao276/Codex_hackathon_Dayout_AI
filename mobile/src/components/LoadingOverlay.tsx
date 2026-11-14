import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  steps: string[];
}

export default function LoadingOverlay({ visible, title, steps }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    setStepIdx(0);
    setElapsed(0);
    const started = Date.now();
    const stepTimer = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0.2, duration: 150, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setStepIdx((i) => Math.min(i + 1, steps.length - 1));
    }, 1100);
    const clock = setInterval(() => setElapsed((Date.now() - started) / 1000), 100);
    return () => {
      clearInterval(stepTimer);
      clearInterval(clock);
    };
  }, [visible, steps.length, fade]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>{title}</Text>
          <Animated.Text style={[styles.step, { opacity: fade }]}>{steps[stepIdx]}</Animated.Text>
          <Text style={styles.timer}>{elapsed.toFixed(1)}s</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  title: { marginTop: 14, fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  step: { marginTop: 8, fontSize: 14, color: colors.textMuted, textAlign: 'center', minHeight: 40 },
  timer: { marginTop: 4, fontSize: 12, color: colors.primary, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
