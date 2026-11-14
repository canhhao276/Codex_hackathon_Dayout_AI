// Bản WEB (chỉ để xem nhanh trên trình duyệt khi phát triển): cùng trang Leaflet, nhúng bằng iframe srcDoc.
// Metro tự chọn file này khi chạy `expo start --web`; Android vẫn dùng LeafletMap.tsx (WebView).
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildMapPayload, MAP_HTML, type LeafletMapHandle, type LeafletMapProps } from './mapHtml';

export type { LeafletMapHandle } from './mapHtml';

// Trang bản đồ gọi window.ReactNativeWebView.postMessage → chuyển thành postMessage lên trang cha.
const BRIDGE =
  '<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({__dayoutMap:true,data:m},"*")}};</script>';

const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(({ itinerary, origin, onStopPress }, ref) => {
  const frameRef = useRef<any>(null);
  const html = useMemo(() => MAP_HTML.replace('<script>', `${BRIDGE}<script>`), []);
  const payload = useMemo(() => buildMapPayload(itinerary, origin), [itinerary, origin]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  // iframe srcDoc cùng origin với trang → gọi thẳng hàm trong iframe.
  const call = useCallback((fn: string, arg?: unknown) => {
    try {
      const w = frameRef.current?.contentWindow;
      if (w && typeof w[fn] === 'function') w[fn](arg);
    } catch {
      // ignore
    }
  }, []);

  const pushPlan = useCallback(() => call('renderPlan', payloadRef.current), [call]);

  useEffect(() => {
    pushPlan();
  }, [payload, pushPlan]);

  useEffect(() => {
    const onMsg = (e: any) => {
      if (!e?.data?.__dayoutMap) return;
      try {
        const msg = JSON.parse(e.data.data);
        if (msg.type === 'ready') pushPlan();
        if (msg.type === 'stop' && typeof msg.order === 'number') onStopPress?.(msg.order);
      } catch {
        // ignore
      }
    };
    const g: any = globalThis;
    g.addEventListener?.('message', onMsg);
    return () => g.removeEventListener?.('message', onMsg);
  }, [onStopPress, pushPlan]);

  useImperativeHandle(
    ref,
    () => ({
      focusStop: (order: number) => call('focusStop', Number(order)),
      fitAll: () => call('fitAll'),
    }),
    [call],
  );

  return (
    <View style={styles.wrap}>
      {React.createElement('iframe' as any, {
        ref: frameRef,
        srcDoc: html,
        onLoad: pushPlan,
        title: 'Bản đồ lộ trình',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
    </View>
  );
});

LeafletMap.displayName = 'LeafletMap';
export default LeafletMap;

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#e8eef5' },
});
