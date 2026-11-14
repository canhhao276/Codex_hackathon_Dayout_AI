import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPlaces, type PlaceHit } from '../places';
import { colors, radius } from '../theme';

interface Props {
  placeholder: string;
  onPick: (hit: PlaceHit) => void;
}

/** Ô nhập địa chỉ tự do trong Hà Nội, gợi ý theo thời gian thực (Photon / OpenStreetMap). */
export default function PlaceSearch({ placeholder, onPick }: Props) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setHits([]);
      setErr(null);
      return;
    }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await searchPlaces(text);
        if (my === seq.current) {
          setHits(res);
          if (!res.length) setErr('Không tìm thấy địa điểm trong Hà Nội.');
        }
      } catch {
        if (my === seq.current) setErr('Không tìm được, kiểm tra kết nối mạng.');
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : q ? (
          <Pressable hitSlop={8} onPress={() => setQ('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      {err && <Text style={styles.err}>{err}</Text>}
      {hits.length > 0 && (
        <View style={styles.list}>
          {hits.map((h, i) => (
            <Pressable
              key={`${h.lat},${h.lng},${i}`}
              onPress={() => {
                onPick(h);
                setQ('');
                setHits([]);
              }}
              style={({ pressed }) => [styles.item, i > 0 && styles.itemBorder, pressed && { backgroundColor: colors.sunken }]}
            >
              <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {h.title}
                </Text>
                {!!h.subtitle && (
                  <Text style={styles.itemSub} numberOfLines={1}>
                    {h.subtitle}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  input: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text, marginLeft: 8, paddingVertical: 0 },
  err: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: 10,
    overflow: 'hidden',
  },
  item: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10 },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
