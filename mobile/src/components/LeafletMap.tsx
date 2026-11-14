// Bản Android/iOS: Leaflet chạy trong react-native-webview. Bản web: LeafletMap.web.tsx (iframe).
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMapPayload, MAP_HTML, type LeafletMapHandle, type LeafletMapProps } from './mapHtml';

export type { LeafletMapHandle } from './mapHtml';

const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(({ itinerary, origin, onStopPress, destination }, ref) => {
  const webRef = useRef<WebView<object>>(null);
  const source = useMemo(() => ({ html: MAP_HTML, baseUrl: 'https://dayout.ai/' }), []);

  const payload = useMemo(() => buildMapPayload(itinerary, origin, destination), [itinerary, origin, destination]);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const inject = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`try{${js}}catch(e){};true;`);
  }, []);

  const pushPlan = useCallback(() => {
    inject(`window.renderPlan(${JSON.stringify(payloadRef.current)});`);
  }, [inject]);

  useEffect(() => {
    pushPlan();
  }, [payload, pushPlan]);

  useImperativeHandle(
    ref,
    () => ({
      focusStop: (order: number) => inject(`window.focusStop(${Number(order)});`),
      fitAll: () => inject('window.fitAll();'),
    }),
    [inject],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === 'ready') pushPlan();
        if (msg.type === 'stop' && typeof msg.order === 'number') onStopPress?.(msg.order);
      } catch {
        // ignore
      }
    },
    [onStopPress, pushPlan],
  );

  return (
    <View style={styles.wrap}>
      <WebView<object>
        ref={webRef}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onLoadEnd={pushPlan}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        style={styles.web}
      />
    </View>
  );
});

LeafletMap.displayName = 'LeafletMap';
export default LeafletMap;

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#EAF0F7' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
