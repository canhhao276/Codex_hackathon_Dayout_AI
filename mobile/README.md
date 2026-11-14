# Dayout AI — Mobile (Android, Expo React Native)

Người 1 · nhánh `feat/mobile` · chỉ sửa trong thư mục `mobile/`.

## Tính năng
- **Màn 1 — Smart Brief:** GPS (`expo-location`, từ chối quyền → mặc định 79 Nguyễn Như Kon Tum), chọn nhanh khu vực, ngân sách/người 200k–800k, số người, chips Vibe, chips Dinh dưỡng, giờ bắt đầu, ghi chú `prompt_note`.
- **Màn 2 — Interactive Plan:** bản đồ Leaflet 1.9 + CartoDB/OSM trong `react-native-webview` (không cần API key), marker đánh số 1→4, polyline `route_polyline`, fitBounds, chạm thẻ → `flyTo`, chạm marker → cuộn tới thẻ. HUD chi phí/ngân sách + kcal + `nutrition_badge` + km.
- **AI Replan 1 chạm:** "Trời mưa", "Tiết kiệm −20%", "Nhẹ calo hơn", "Đổi quán này" trên từng thẻ → `POST /api/v1/itineraries/replan`. Chặng mới có nhãn **AI MỚI ĐỔI** và HUD hiện chênh lệch ▲/▼.
- **Lưu bền vững:** `AsyncStorage` lưu lịch trình, request, brief và `apiBaseUrl` → force-close mở lại vẫn còn.
- **⚙️ Đổi API URL ngay trên máy** + nút kiểm tra `GET /health`.
- **Share chốt kèo nhóm:** `Share` gốc, có `share_url`.
- **Dữ liệu mẫu** chỉ hiện khi server lỗi và người dùng chọn "Xem bản mẫu" (có banner "DỮ LIỆU MẪU").

## Chạy dev
```bash
cd mobile
npm install
npx expo start            # quét QR bằng Expo Go (Android) — cùng mạng với laptop
```
Gọi backend:
- **USB:** `adb reverse tcp:3000 tcp:3000` → API URL `http://localhost:3000` (mặc định).
- **4G / Tunnel:** `npx cloudflared tunnel --url http://localhost:3000` → dán `https://xxxx.trycloudflare.com` vào ⚙️.

## Build APK cài máy thật (không cần Android Studio)
```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview   # ~10-15 phút, tải .apk từ link trả về
```
Có Android SDK + JDK 17 thì build local: `npx expo prebuild --platform android && cd android && ./gradlew assembleRelease`.

## Bài test BGK (làm 5 lần)
Vuốt tắt hẳn app → mở lại (lịch trình còn nguyên) → Tạo mới → Trời mưa → Share chốt kèo.

## Cấu trúc
```
App.tsx                      điều phối màn hình, gọi API, lưu state
src/types.ts                 JSON Contract (Mục 7)
src/api.ts                   fetch + timeout + chuẩn hoá response
src/storage.ts               AsyncStorage
src/sampleData.ts            dữ liệu mẫu + replan mẫu (offline)
src/components/LeafletMap.tsx  bản đồ WebView + Leaflet
src/screens/BriefScreen.tsx  Màn 1
src/screens/PlanScreen.tsx   Màn 2
```
