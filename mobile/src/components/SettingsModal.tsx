import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { checkHealth } from '../api';
import { DEFAULT_API_BASE_URL } from '../constants';
import { normalizeBaseUrl } from '../format';
import { colors, radius } from '../theme';

interface Props {
  visible: boolean;
  apiBaseUrl: string;
  onClose: () => void;
  onSave: (url: string) => void;
}

export default function SettingsModal({ visible, apiBaseUrl, onClose, onSave }: Props) {
  const [value, setValue] = useState(apiBaseUrl);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(apiBaseUrl);
      setStatus(null);
    }
  }, [visible, apiBaseUrl]);

  const test = async () => {
    const url = normalizeBaseUrl(value);
    if (!url) return;
    setChecking(true);
    setStatus(null);
    try {
      setStatus({ ok: true, text: await checkHealth(url) });
    } catch (e: any) {
      setStatus({ ok: false, text: e?.message ?? 'Lỗi kết nối' });
    } finally {
      setChecking(false);
    }
  };

  const save = () => {
    const url = normalizeBaseUrl(value) || DEFAULT_API_BASE_URL;
    onSave(url);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>⚙️ Cài đặt kết nối server</Text>
          <Text style={styles.label}>API Base URL (Node.js BFF :3000 hoặc link Cloudflare Tunnel)</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://xxxx.trycloudflare.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.presets}>
            <Pressable onPress={() => setValue(DEFAULT_API_BASE_URL)} style={styles.preset}>
              <Text style={styles.presetText}>localhost:3000 (adb reverse)</Text>
            </Pressable>
            <Pressable onPress={() => setValue('https://')} style={styles.preset}>
              <Text style={styles.presetText}>https://… (Tunnel 4G)</Text>
            </Pressable>
          </View>

          {status && (
            <Text style={[styles.status, { color: status.ok ? colors.success : colors.danger }]}>
              {status.ok ? '✅ ' : '❌ '}
              {status.text}
            </Text>
          )}

          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={test} disabled={checking}>
              {checking ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primary }]}>Kiểm tra /health</Text>
              )}
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={save}>
              <Text style={[styles.btnText, { color: '#fff' }]}>Lưu</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 36,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    marginRight: 8,
    marginBottom: 6,
  },
  presetText: { fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
  status: { marginTop: 10, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', marginTop: 18 },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: colors.primarySoft, marginRight: 10 },
  btnPrimary: { backgroundColor: colors.primary },
  btnText: { fontSize: 15, fontWeight: '700' },
});
