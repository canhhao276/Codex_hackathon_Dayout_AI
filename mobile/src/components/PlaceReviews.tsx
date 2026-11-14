// Panel "Ảnh & đánh giá" mở ngay dưới thẻ địa điểm.
//  - Google: ảnh thật, điểm sao, số lượt và tối đa 5 bình luận (qua Node, cần GOOGLE_MAPS_API_KEY trên server).
//  - Cộng đồng Dayout: sao + bình luận do chính người dùng app gửi (lưu ở Node). Không có dữ liệu bịa.
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getPlaceReviews, postPlaceReview, type PlaceReviews as Reviews } from '../api';
import { findPlacePhoto } from '../places';
import { colors, radius } from '../theme';
import type { Stop } from '../types';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color="#F2A900"
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

const timeAgo = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} giờ trước` : `${Math.round(h / 24)} ngày trước`;
};

export default function PlaceReviews({ stop, apiBaseUrl }: { stop: Stop; apiBaseUrl: string }) {
  const [data, setData] = useState<Reviews | null>(null);
  const [wikiPhoto, setWikiPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myStars, setMyStars] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getPlaceReviews(apiBaseUrl, stop);
      setData(res);
      if (!res.google?.photos?.length) {
        findPlacePhoto(stop.name, stop.lat, stop.lng).then(setWikiPhoto).catch(() => undefined);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được đánh giá');
    }
  }, [apiBaseUrl, stop]);

  useEffect(() => {
    load();
  }, [load]);

  const openMaps = () => {
    const url =
      data?.google?.maps_url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.name}, ${stop.address || `${stop.lat},${stop.lng}`}`)}`;
    Linking.openURL(url).catch(() => undefined);
  };

  const submit = async () => {
    if (!myStars || sending) return;
    setSending(true);
    try {
      const community = await postPlaceReview(apiBaseUrl, {
        stop_id: stop.stop_id,
        place_name: stop.name,
        name: name.trim(),
        rating: myStars,
        comment: comment.trim(),
      });
      setData((d) => (d ? { ...d, community } : d));
      setSent(true);
      setComment('');
    } catch (e: any) {
      setError(e?.message ?? 'Gửi đánh giá thất bại');
    } finally {
      setSending(false);
    }
  };

  if (!data && !error) {
    return (
      <View style={[styles.panel, styles.center]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Đang tải ảnh & đánh giá…</Text>
      </View>
    );
  }

  const g = data?.google;
  const photos = g?.photos?.length ? g.photos : wikiPhoto ? [{ url: wikiPhoto, author: 'Wikimedia Commons' }] : [];
  const c = data?.community;

  return (
    <View style={styles.panel}>
      {!!error && <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text>}

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {photos.map((p, i) => (
            <View key={p.url} style={{ marginRight: 8 }}>
              <Image source={{ uri: p.url }} style={styles.photo} resizeMode="cover" />
              {!!p.author && i === 0 && <Text style={styles.credit} numberOfLines={1}>📷 {p.author}</Text>}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Google — chỉ hiện khi server có GOOGLE_MAPS_API_KEY; không có key thì mở Google Maps (miễn phí). */}
      {!g ? (
        <Pressable onPress={openMaps} style={styles.mapsCard}>
          <Ionicons name="logo-google" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.section}>Xem điểm & bình luận trên Google Maps</Text>
            <Text style={styles.muted}>Ảnh thật, số sao và đánh giá của người dùng Google</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : (
      <>
      <View style={styles.sectionHead}>
        <Text style={styles.section}>Đánh giá Google</Text>
        {g?.rating != null && (
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{g.rating.toFixed(1)}</Text>
            <Stars value={g.rating} />
            <Text style={styles.muted}> ({g.rating_count.toLocaleString('vi-VN')})</Text>
          </View>
        )}
      </View>
      {g?.reviews?.length ? (
        g.reviews.map((r, i) => (
          <View key={`${r.author}_${i}`} style={styles.review}>
            <View style={styles.reviewHead}>
              {r.author_photo ? (
                <Image source={{ uri: r.author_photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{r.author.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.author} numberOfLines={1}>{r.author}</Text>
                <View style={styles.scoreRow}>
                  <Stars value={r.rating} size={12} />
                  {!!r.time && <Text style={styles.muted}>  {r.time}</Text>}
                </View>
              </View>
            </View>
            {!!r.text && <Text style={styles.reviewText} numberOfLines={5}>{r.text}</Text>}
          </View>
        ))
      ) : (
        <Text style={styles.muted}>
          {data?.google_status === 'no_key'
            ? 'Chưa bật Google Places trên server (GOOGLE_MAPS_API_KEY).'
            : data?.google_status === 'not_found'
              ? 'Google chưa có đánh giá cho địa điểm này.'
              : data?.google_status === 'error'
                ? 'Không lấy được đánh giá Google lúc này.'
                : 'Chưa có bình luận.'}
        </Text>
      )}
      <Pressable onPress={openMaps} style={styles.mapsBtn} hitSlop={6}>
        <Ionicons name="logo-google" size={14} color={colors.primary} />
        <Text style={styles.mapsText}>Xem tất cả trên Google Maps</Text>
      </Pressable>
      </>
      )}

      {/* Cộng đồng Dayout */}
      <View style={[styles.sectionHead, { marginTop: 14 }]}>
        <Text style={styles.section}>Cộng đồng Dayout</Text>
        {!!c?.count && (
          <View style={styles.scoreRow}>
            <Text style={styles.score}>{c.avg.toFixed(1)}</Text>
            <Stars value={c.avg} />
            <Text style={styles.muted}> ({c.count})</Text>
          </View>
        )}
      </View>
      {c?.reviews?.length ? (
        c.reviews.slice(0, 5).map((r) => (
          <View key={r.id} style={styles.review}>
            <View style={styles.scoreRow}>
              <Text style={styles.author}>{r.name}</Text>
              <Text style={styles.muted}>  {timeAgo(r.created_at)}</Text>
            </View>
            <Stars value={r.rating} size={12} />
            {!!r.comment && <Text style={styles.reviewText}>{r.comment}</Text>}
          </View>
        ))
      ) : (
        <Text style={styles.muted}>Chưa có đánh giá từ người dùng Dayout. Bạn là người đầu tiên!</Text>
      )}

      {/* Gửi đánh giá */}
      <View style={styles.form}>
        <Text style={styles.formTitle}>{sent ? 'Cảm ơn bạn! Đánh giá thêm?' : 'Bạn đã đến đây? Chấm điểm nhé'}</Text>
        <View style={{ flexDirection: 'row', marginVertical: 6 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} onPress={() => setMyStars(i)} hitSlop={4} style={{ marginRight: 6 }}>
              <Ionicons name={myStars >= i ? 'star' : 'star-outline'} size={26} color="#F2A900" />
            </Pressable>
          ))}
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Tên của bạn (tuỳ chọn)"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          maxLength={40}
        />
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Cảm nhận về đồ ăn, không gian, giá…"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={submit}
          disabled={!myStars || sending}
          style={[styles.submit, (!myStars || sending) && { opacity: 0.5 }]}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Gửi đánh giá</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: { alignItems: 'center', gap: 8 },
  photo: { width: 180, height: 120, borderRadius: radius.md, backgroundColor: colors.sunken },
  credit: { fontSize: 10, color: colors.textFaint, marginTop: 2, maxWidth: 180 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap' },
  section: { fontSize: 14, fontWeight: '800', color: colors.text },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  score: { fontSize: 16, fontWeight: '800', color: colors.text, marginRight: 4 },
  muted: { fontSize: 12, color: colors.textMuted },
  review: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  reviewHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800' },
  author: { fontSize: 13, fontWeight: '700', color: colors.text },
  reviewText: { fontSize: 13, color: colors.text, marginTop: 3, lineHeight: 18 },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  mapsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  mapsText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  form: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.sunken },
  formTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
  },
  submit: { marginTop: 8, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
