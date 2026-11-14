# Kế Hoạch Tác Chiến 4 Giờ & Phân Công AI Agent — Dayout AI
**Cuộc thi:** AI IN YOUR PALM / Codex Community Hackathon – Hanoi (14/11/2026)  
**Thời gian nộp bài (Tools down):** `16:00` | **Thuyết trình:** `16:15` (5 phút/đội)  
**Tech Stack:** Android (React Native Expo) + Bản đồ miễn phí (Leaflet/OSM + OSRM) + Node.js + Python FastAPI + OpenAI API  

---

## Cách Khởi Chạy Nhanh Cho 3 Thành Viên (1 Câu Lệnh Duy Nhất)
Sau khi `git pull` (hoặc chép file `HACKATHON_PLAN.md` này vào thư mục repo `Codex_hackathon_Dayout_AI`), mỗi thành viên chỉ cần mở AI Agent (Codex / Antigravity) và nhắn đúng 1 câu:
- **Người 1:** `"Đọc file HACKATHON_PLAN.md, tôi là Người 1. Hãy tự tạo nhánh Git và thực hiện toàn bộ phần của Người 1."`
- **Người 2:** `"Đọc file HACKATHON_PLAN.md, tôi là Người 2. Hãy tự tạo nhánh Git và thực hiện toàn bộ phần của Người 2."`
- **Người 3:** `"Đọc file HACKATHON_PLAN.md, tôi là Người 3. Hãy tự tạo nhánh Git và thực hiện toàn bộ phần của Người 3."`

---

## Mục Lục Nhanh Cho 3 Thành Viên
1. [Tiêu Chí Chấm Điểm & Luật Sinh Tử (Đọc trong 2 phút)](#1-tiêu-chí-chấm-điểm--luật-sinh-tử)
2. [Phạm Vi MVP "Dayout AI" (Cắt Gọt Chuẩn 4 Giờ)](#2-phạm-vi-mvp-dayout-ai-cắt-gọt-chuẩn-4-giờ)
3. [Kiến Trúc Kỹ Thuật (Android + Free Map Không Cần Key + Node.js + FastAPI)](#3-kiến-trúc-kỹ-thuật-android--free-map--nodejs--fastapi)
4. [Cấu Trúc Thư Mục & Quy Tắc Git Chống Xung Đột 100%](#4-cấu-trúc-thư-mục--quy-tắc-git-chống-xung-đột-100)
5. [Bảng Phân Việc Chi Tiết Cho 3 Người (Code bằng Agent + Việc Thực Địa)](#5-bảng-phân-việc-chi-tiết-cho-3-người)
6. [Timeline Tác Chiến Từng Khung Giờ (11:45 – 16:00)](#6-timeline-tác-chiến-từng-khung-giờ-1145--1600)
7. [Hợp Đồng Dữ Liệu Khóa Cứng (`JSON API Contract`)](#7-hợp-đồng-dữ-liệu-khóa-cứng-json-api-contract)
8. [Bộ 3 Prompt Mẫu Copy-Paste Cho AI Agent (Codex / Antigravity)](#8-bộ-3-prompt-mẫu-copy-paste-cho-ai-agent)
9. [Checklist Cài Máy Android Thật & Kịch Bản Pitch 5 Phút](#9-checklist-cài-máy-android-thật--kịch-bản-pitch-5-phút)

---

## 1. Tiêu Chí Chấm Điểm & Luật Sinh Tử

BGK chấm trên thang **100 điểm** theo từng mức cố định (**không chấm cảm tính qua slide**). Nếu hòa điểm sẽ xét ưu tiên lần lượt: **Tiêu chí 1 -> Tiêu chí 2 -> Tiêu chí 3**.

| Tiêu chí | Điểm tối đa | Điều kiện đạt tối đa | Mức rớt điểm (Cần tránh tuyệt đối!) |
| :--- | :---: | :--- | :--- |
| **1. Demo AI trên điện thoại thật** *(Ưu tiên #1)* | **40 điểm** | **Đóng hẳn (vuốt tắt hoàn toàn) rồi mở lại ứng dụng trên điện thoại Android thật**; luồng AI chính chạy trực tiếp (live). | - `20đ`: Mở lại được nhưng AI lỗi/chập chờn.<br>- **`0đ`**: Không mở lại được trên máy thật, AI giả lập/hardcode, hoặc **chỉ demo trên trình duyệt, giả lập (emulator), ảnh, video**. |
| **2. Vấn đề thật của người dùng** *(Ưu tiên #2)* | **35 điểm** | Nêu rõ nhóm người dùng & nỗi đau cụ thể, **có bằng chứng thực tế (số liệu khảo sát/phỏng vấn)**, và cho thấy **AI giải quyết trực tiếp** (không phải chatbot gắn thêm ở cuối). | - `18đ`: Vấn đề rõ nhưng thiếu bằng chứng thực tế hoặc vai trò của AI mờ nhạt.<br>- `0đ`: Nói chung chung, không rõ người dùng. |
| **3. Khả năng mở rộng thị trường** *(Ưu tiên #3)* | **25 điểm** | Giải thích rõ **cách tiếp cận những người dùng đầu tiên** + hướng **mở rộng toàn cầu**. **Đã có người dùng thực tế ngay trong ngày là lợi thế lớn.** | - `13đ`: Lập luận tiếp cận người dùng yếu.<br>- `0đ`: Khẳng định chung chung kiểu *"ai cũng cần"*. |

### 3 Nguyên tắc sống còn của cả đội:
1. **KHÔNG LÀM CHATBOT:** App phải là công cụ lập kế hoạch không gian trực quan (chọn nhanh sở thích/ngân sách/dinh dưỡng -> AI trả về lộ trình ghim trên bản đồ + chi phí + calo + nút 1 chạm đổi điểm theo thời gian thực).
2. **KHÔNG DÙNG GOOGLE MAPS SDK MẶC ĐỊNH TRÊN ANDROID:** Không có Google Maps API Key có gắn thẻ tín dụng thì `react-native-maps` trên Android sẽ **crash hoặc trắng màn hình**. Dùng **Leaflet + OpenStreetMap/CartoDB qua `react-native-webview`** + **OSRM Routing API** (miễn phí 100%, không cần key).
3. **KHÔNG PHỤ THUỘC WI-FI HỘI TRƯỜNG LÚC DEMO:** Dùng **4G cá nhân + Cloudflare Tunnel HTTPS** (hoặc cáp USB `adb reverse`) và build `.apk` / cài sẵn trên điện thoại Android thật trước `15:00`.

---

## 2. Phạm Vi MVP "Dayout AI" (Cắt Gọt Chuẩn 4 Giờ)

Đáp ứng trọn vẹn 4 cam kết trong đơn đăng ký (*lọc địa điểm theo sở thích, tối ưu đường đi bản đồ, cân đối chi phí, cân đối dinh dưỡng thời gian thực*) chỉ trong **2 màn hình chính** (Bỏ hoàn toàn: Đăng nhập, Mạng xã hội, Chat tự do):

- **Màn 1 — Smart Brief (10 giây thiết lập):**
  - Lấy GPS hiện tại trên máy Android (mặc định tại hội trường *79 Nguyễn Như Kon Tum, Thanh Xuân*) hoặc chọn nhanh khu vực.
  - Chọn Ngân sách/người (`200k – 800k VNĐ`), Số người, Chips Sở thích/Vibe (`Hẹn hò`, `Nhóm bạn`, `Workshop/Vui chơi`, `Ẩm thực`, `Chụp ảnh`) và Chips Chế độ dinh dưỡng (`Cân bằng`, `Eat Clean`, `Giàu Protein`, `Ít đường`).
- **Màn 2 — Bản Đồ Lộ Trình + HUD Chi Phí & Dinh Dưỡng + Timeline:**
  - **Bản đồ tương tác (nửa trên):** Vẽ các điểm dừng đánh số `1 -> 2 -> 3 -> 4` và đường nối lộ trình thực tế tối ưu không đi vòng.
  - **Thanh HUD Thông Minh:** Hiển thị trực tiếp `Tổng chi phí / Ngân sách` (VD: `315k / 350k VNĐ`) và `Tổng năng lượng & Nhãn dinh dưỡng` (VD: `~890 kcal • Đạt chuẩn Eat Clean`).
  - **Timeline Cards (nửa dưới):** Giờ đi, tên quán thật, địa chỉ thật, món gợi ý + giá + kcal, lý do AI chọn, khoảng cách di chuyển sang chặng kế tiếp.
  - **Tính năng ăn điểm "AI Thích Ứng Thời Gian Thực" (1-Tap Replan):** Nút nhanh **"Trời đổ mưa (Đổi điểm trong nhà)"**, **"Giảm 20% ngân sách"**, hoặc nút **"Đổi quán này"** ngay trên từng chặng -> AI tính toán lại điểm thay thế, cập nhật đường đi, tổng tiền và tổng calo trong **3–4 giây**!
  - **Lưu Offline (`AsyncStorage`) & Viral Share:** Vuốt đóng hẳn app mở lại vẫn giữ nguyên lịch trình; bấm **"Share chốt kèo nhóm"** tạo link web cho bạn bè xem & bấm tham gia trên Zalo.

---

## 3. Kiến Trúc Kỹ Thuật (Android + Free Map + Node.js + FastAPI)

```text
[ Máy Android Thật (Expo React Native) ]  <--- NGƯỜI 1 (thư mục: mobile/)
   │  - Bản đồ miễn phí: react-native-webview + Leaflet + CartoDB/OSM Tiles
   │  - Lưu bền vững khi tắt hẳn app: @react-native-async-storage/async-storage
   │
   ▼  HTTPS (qua Cloudflare Quick Tunnel dùng 4G hoặc USB adb reverse)
[ Node.js BFF & Viral Share Server (:3000) ] <--- NGƯỜI 2 (thư mục: backend-node/)
   │  - POST /api/v1/itineraries/generate  (gọi FastAPI + lưu lịch trình + cấp share_url)
   │  - POST /api/v1/itineraries/replan    (gọi FastAPI đổi 1 chặng tức thì)
   │  - GET  /s/:code                      (Trang Web "Thẻ Chốt Kèo Nhóm" mở trên Zalo + Vote)
   │  - GET  /api/v1/stats                 (Đếm số User & Lịch trình thật chiếu cho BGK)
   │
   ▼  HTTP nội bộ (http://127.0.0.1:8000)
[ Python FastAPI AI & Spatial Engine (:8000) ] <--- NGƯỜI 3 (thư mục: ai-fastapi/)
      - Dữ liệu: 60+ quán thật tại Hà Nội (data/hanoi_pois.json) + OSM Overpass API miễn phí
      - AI: OpenAI Structured Outputs (json_schema, model gpt-4o-mini tốc độ 3-4s)
      - Bản đồ đường đi: Lọc bán kính Haversine + Sắp xếp lộ trình + OSRM Free Routing API
```

---

## 4. Cấu Trúc Thư Mục & Quy Tắc Git Chống Xung Đột 100%

Repo chung: `https://github.com/canhhao276/Codex_hackathon_Dayout_AI.git`

```text
Codex_hackathon/
├── HACKATHON_PLAN.md         # File kế hoạch & hợp đồng chung này
├── mobile/                   # CHỈ NGƯỜI 1 SỬA (Nhánh Git: feat/mobile)
├── backend-node/             # CHỈ NGƯỜI 2 SỬA (Nhánh Git: feat/node-api)
└── ai-fastapi/               # CHỈ NGƯỜI 3 SỬA (Nhánh Git: feat/ai-fastapi)
```

**Quy tắc vàng khi dùng AI Agent:**
- Mỗi người chỉ mở và ra lệnh cho Agent tạo/sửa file **nằm bên trong thư mục của mình**.
- **Cấm tự ý đổi tên biến trong JSON Contract (Mục 7)** nếu chưa báo cả nhóm.
- Nhờ tách hẳn 3 thư mục, lúc `13:30` gộp (`git merge`) cả 3 nhánh vào `main` sẽ **không có bất kỳ xung đột (conflict) nào**.

---

## 5. Bảng Phân Việc Chi Tiết Cho 3 Người

| Thành viên | Phần Code (Giao cho AI Agent làm) | Phần Thực Địa & Tích Hợp (Làm song song để lấy điểm tối đa) |
| :--- | :--- | :--- |
| **Người 1**<br>**Mobile & Android Lead**<br>*(Thư mục: `mobile/`)* | - Dựng app Expo React Native.<br>- Làm Màn 1 (Smart Brief) & Màn 2 (Bản đồ Leaflet WebView + HUD Chi phí/Calo + Timeline).<br>- Tích hợp `AsyncStorage` lưu state khi tắt app.<br>- Nối API tạo lịch trình, nút AI Re-plan thời gian thực và nút Share. | - Cắm máy **Android thật** chạy thử UI ngay từ `12:15`.<br>- Lúc `14:30`: Xuất bản cài đặt `.apk` (hoặc cấu hình HTTPS Tunnel qua 4G) lên máy Android thật.<br>- Kiểm tra 5 lần liên tục bài test của BGK: **Vuốt đóng hẳn app -> Mở lại từ màn hình chính -> Bấm chạy AI trực tiếp**. |
| **Người 2**<br>**Node.js BFF, Share Web & DevOps**<br>*(Thư mục: `backend-node/`)* | - Dựng Express server cổng `3000`, nối proxy sang FastAPI cổng `8000`, lưu dữ liệu vào `data/store.json`.<br>- Làm trang Web **Thẻ Chốt Kèo Nhóm** (`GET /s/:code`) có bản đồ mini + nút bạn bè bấm **"Tham gia kèo"**.<br>- Làm trang thống kê `GET /admin/stats` đếm số user & lịch trình thực tế. | - Thiết lập **Cloudflare Quick Tunnel** (`npx cloudflared tunnel --url http://localhost:3000`) lấy link HTTPS miễn phí cho máy Android gọi qua 4G.<br>- **`14:45 – 15:30`:** Cầm máy Android & mã QR link chốt kèo mời **5–10 người tham dự tại hội trường dùng thử thật** để ghi nhận số lượng User thực tế (ăn trọn **25đ Tiêu chí 3**). |
| **Người 3**<br>**FastAPI AI, Spatial & User Evidence**<br>*(Thư mục: `ai-fastapi/`)* | - Dùng Agent tạo `data/hanoi_pois.json` (60+ quán thật quanh Thanh Xuân, Đống Đa, Cầu Giấy, Hoàn Kiếm + giá + kcal + indoor) kết hợp OSM Overpass.<br>- Viết FastAPI cổng `8000` gọi **OpenAI Structured Outputs** + **OSRM Routing API** miễn phí.<br>- Tối ưu tốc độ `/ai/generate` (< 5s) và `/ai/replan` (< 3.5s). | - **`12:00 – 12:40` (Giờ ăn trưa, trong lúc Agent đang sinh data):** Khảo sát nhanh **15–20 bạn trẻ ngay tại hội trường Biblio** (3 câu hỏi ngắn về thời gian tìm quán & nỗi đau đi chơi cuối tuần) để lấy số liệu bằng chứng thật (ăn trọn **35đ Tiêu chí 2**).<br>- Chuẩn bị số liệu & cùng nhóm ráp kịch bản Pitch 5 phút lúc `15:20`. |

---

## 6. Timeline Tác Chiến Từng Khung Giờ (11:45 – 16:00)

| Giờ | Mốc công việc | Kết quả bắt buộc |
| :--- | :--- | :--- |
| **11:45 – 12:00** | **Chia nhánh & Khởi chạy Agent** | Cả 3 pull repo, tạo nhánh riêng, dán Prompt ở Mục 8 vào Agent để dựng khung project. |
| **12:00 – 13:15** | **Xây dựng độc lập + Khảo sát trưa** | - `mobile/` lên xong 2 màn hình & bản đồ Leaflet với mock JSON.<br>- `backend-node/` xong API + trang Web `/s/:code`.<br>- `ai-fastapi/` chạy chuẩn OpenAI JSON + OSRM routing.<br>- Thu thập xong **15+ mẫu khảo sát người dùng thật** tại hội trường. |
| **13:15 – 14:15** | **Ghép nối toàn tuyến (Integration)** | Merge code trên máy chạy server (`:3000` <-> `:8000`), bật Cloudflare Tunnel HTTPS, nối máy Android thật bấm tạo lịch trình & đổi điểm AI end-to-end. |
| **14:15 – 15:00** | **Đóng gói APK Android & Test sát hạch** | **15:00 NGỪNG THÊM TÍNH NĂNG MỚI (Code Freeze).** Cài app lên máy Android, bật 4G, test **Force-close -> Mở lại -> Tạo mới -> Đổi chặng khi trời mưa** mượt 100%. |
| **15:00 – 15:35** | **Lấy User thật tại sự kiện & Đánh bóng** | Cho **5–10 bạn tại sự kiện** dùng thử và bấm "Tham gia kèo" trên link Share để lấy con số Traction thật. |
| **15:35 – 15:55** | **Tập Pitch 5 phút & Nộp bài** | Sạc đầy pin điện thoại (>80%), bật *Không làm phiền*, tập dượt đúng 4 phút 30 giây, nộp bài trước `16:00`! |

---

## 7. Hợp Đồng Dữ Liệu Khóa Cứng (`JSON API Contract`)

### 7.1. Tạo lịch trình mới
- **Mobile gọi Node.js:** `POST /api/v1/itineraries/generate`
- **Node.js gọi FastAPI:** `POST /ai/generate`

**Request JSON:**
```json
{
  "origin": {
    "lat": 21.0012,
    "lng": 105.8035,
    "label": "79 Nguyễn Như Kon Tum, Thanh Xuân, Hà Nội"
  },
  "budget_vnd": 350000,
  "people_count": 2,
  "vibes": ["chill_cafe", "interactive_activity", "local_food"],
  "nutrition_goal": "eat_clean",
  "time_window": { "start": "14:00", "end": "21:00" },
  "prompt_note": "Đi hẹn hò cuối tuần, thích không gian thoáng, ít dầu mỡ"
}
```

**Response JSON (`ItineraryResponse`):**
```json
{
  "itinerary_id": "itin_20261114_01",
  "share_url": "https://example.trycloudflare.com/s/hk26",
  "summary": {
    "title": "Chiều Thanh Xuân Nhẹ Nhàng & Eat Clean",
    "total_cost_per_person_vnd": 315000,
    "budget_per_person_vnd": 350000,
    "total_calories_kcal": 890,
    "nutrition_badge": "Đạt chuẩn Eat Clean • Giàu đạm, ít đường",
    "total_distance_km": 3.4,
    "total_travel_minutes": 14
  },
  "route_polyline": [
    [21.0012, 105.8035],
    [21.0045, 105.8080],
    [21.0102, 105.8125]
  ],
  "stops": [
    {
      "order": 1,
      "stop_id": "poi_tx_01",
      "start_time": "14:00",
      "end_time": "15:45",
      "name": "All Day Coffee",
      "category": "cafe",
      "address": "Khu vực Thanh Xuân / Đống Đa, Hà Nội",
      "lat": 21.0045,
      "lng": 105.8080,
      "indoor": true,
      "recommended_items": ["Cold Brew Cam Sả ít đường", "Bánh chuối yến mạch"],
      "estimated_cost_vnd": 95000,
      "estimated_calories_kcal": 210,
      "nutrition_note": "Ít đường, năng lượng nhẹ buổi chiều",
      "ai_reason": "Không gian yên tĩnh hợp trò chuyện, cách điểm xuất phát 1.1km",
      "distance_to_next_km": 1.5,
      "travel_to_next_minutes": 7
    }
  ]
}
```

### 7.2. AI Đổi lịch trình theo thời gian thực (1-Tap Replan)
- **Mobile gọi Node.js:** `POST /api/v1/itineraries/replan`
- **Node.js gọi FastAPI:** `POST /ai/replan`

**Request JSON:**
```json
{
  "current_itinerary": {},
  "target_stop_order": 2,
  "reason": "rainy_weather",
  "new_budget_vnd": 350000
}
```
*(Giá trị `reason` hỗ trợ: `"rainy_weather"` | `"crowded"` | `"tighter_budget"` | `"lower_calories"`. Kết quả trả về giữ nguyên cấu trúc `ItineraryResponse` mới đã cập nhật lại điểm dừng, `route_polyline`, tổng tiền và tổng calo).*

---

## 8. Bộ 3 Chỉ Dẫn Thực Thi Tự Động Cho AI Agent (Bao Gồm Tự Tạo Nhánh Git)

> **Quy tắc bắt buộc cho AI Agent khi người dùng xưng là Người 1 / Người 2 / Người 3:**  
> Ngay khi người dùng cho biết họ là thành viên số mấy, Agent PHẢI tự động thực hiện từ **Bước 0 (Tạo nhánh Git & `.gitignore` riêng)** cho tới khi hoàn thành và kiểm thử xong toàn bộ module của người đó mà không chạm vào thư mục của thành viên khác.

### 8.1. Chỉ dẫn cho Agent của NGƯỜI 1 (`mobile/` — Nhánh `feat/mobile`)
```text
Hãy đọc file `HACKATHON_PLAN.md` (đặc biệt Mục 7 JSON API Contract) và xây dựng hoàn chỉnh ứng dụng di động Android "Dayout AI" bằng React Native (Expo TypeScript) nằm gọn hoàn toàn trong thư mục `mobile/`.

Yêu cầu thực thi tuần tự bắt buộc:
0. TỰ ĐỘNG TẠO NHÁNH GIT & CHỐNG LỘ FILE NẶNG (Làm đầu tiên trước khi viết code):
   - Kiểm tra Git và tự động chuyển sang nhánh riêng: chạy `git checkout -b feat/mobile` (nếu nhánh đã tồn tại thì chạy `git checkout feat/mobile`). Tuyệt đối không commit trực tiếp lên `main`.
   - Tạo ngay file `mobile/.gitignore` chặn `node_modules/`, `.expo/`, `dist/`, `android/`, `ios/`, `*.apk`, `.env*`.
   - Chỉ được phép tạo và sửa file bên trong thư mục `mobile/`.
1. BẢN ĐỒ MIỄN PHÍ KHÔNG CẦN API KEY: Tuyệt đối KHÔNG dùng Google Maps SDK (`react-native-maps` mặc định sẽ crash trên Android khi không có key). Hãy dùng `react-native-webview` nhúng Leaflet 1.9 + CartoDB Voyager / OpenStreetMap tiles miễn phí. Vẽ các Marker đánh số thứ tự nổi bật 1->2->3->4, vẽ đường nối lộ trình từ mảng `route_polyline`, tự động fitBounds và khi người dùng bấm vào thẻ chặng ở dưới thì bản đồ `flyTo` mượt tới điểm đó.
2. KHÔNG LÀM GIAO DIỆN CHATBOT. Thiết kế UI di động hiện đại, trực quan gồm 2 màn hình chính:
   - Màn 1 (Smart Brief): Nút lấy tọa độ GPS hiện tại bằng `expo-location` (nếu từ chối quyền hoặc đang test thì mặc định về 79 Nguyễn Như Kon Tum: lat 21.0012, lng 105.8035), chọn Ngân sách/người (200k - 800k VNĐ), chọn Số người, chọn Chips Vibe (`chill_cafe`, `interactive_activity`, `local_food`, `photo_spot`, `night_chill`), chọn Chips Dinh dưỡng (`balanced`, `eat_clean`, `high_protein`, `low_sugar`) và 1 ô ghi chú ngắn `prompt_note`.
   - Màn 2 (Interactive Plan): Nửa trên là Bản đồ Leaflet; ngay dưới là Thanh HUD nổi bật hiển thị trực quan Tổng chi phí / Ngân sách (VNĐ) và Tổng Calo (`total_calories_kcal` + `nutrition_badge`) cùng tổng km di chuyển; nửa dưới là danh sách Timeline Cards từng chặng (khung giờ, tên quán, địa chỉ, món gợi ý, chi phí, kcal, `ai_reason`).
3. TÍNH NĂNG AI THÍCH ỨNG THỜI GIAN THỰC: Ngay trên Màn 2, tạo thanh công cụ nhanh gồm nút "Trời mưa (Đổi điểm trong nhà)", "Tiết kiệm ngân sách (-20%)" và trên mỗi thẻ chặng có nút "Đổi quán này" -> gọi `POST /api/v1/itineraries/replan` với loading mượt mà và cập nhật ngay bản đồ + HUD + timeline.
4. LƯU BỀN VỮNG KHI TẮT HẲN APP (Tiêu chí 40 điểm): Dùng `@react-native-async-storage/async-storage` tự động lưu `ItineraryResponse` mới nhất và `apiBaseUrl`. Khi người dùng vuốt đóng hẳn (force-close) ứng dụng rồi mở lại, khôi phục ngay lịch trình gần nhất lên màn hình kèm nút "Tạo lịch trình mới" và nút bánh răng nhỏ cho phép sửa nhanh `apiBaseUrl` ngay trên điện thoại (mặc định `http://localhost:3000`, dễ dàng đổi sang link `https://...trycloudflare.com` khi demo bằng 4G).
5. CHIA SẺ VIRAL: Thêm nút "Share chốt kèo nhóm" sử dụng `Share` gốc của React Native xuất tóm tắt lịch trình đẹp mắt kèm `share_url`.
6. Có sẵn dữ liệu mẫu chuẩn JSON Contract để test UI độc lập nếu chưa bật server, nhưng luôn ưu tiên gọi API thật.
```

### 8.2. Chỉ dẫn cho Agent của NGƯỜI 2 (`backend-node/` — Nhánh `feat/node-api`)
```text
Hãy đọc file `HACKATHON_PLAN.md` (đặc biệt Mục 7 JSON API Contract) và xây dựng hoàn chỉnh service `backend-node/` bằng Node.js + Express (chạy tại cổng 3000) cho dự án "Dayout AI".

Yêu cầu thực thi tuần tự bắt buộc:
0. TỰ ĐỘNG TẠO NHÁNH GIT & CHỐNG LỘ FILE NẶNG (Làm đầu tiên trước khi viết code):
   - Kiểm tra Git và tự động chuyển sang nhánh riêng: chạy `git checkout -b feat/node-api` (nếu nhánh đã tồn tại thì chạy `git checkout feat/node-api`). Tuyệt đối không commit trực tiếp lên `main`.
   - Tạo ngay file `backend-node/.gitignore` chặn `node_modules/`, `.env`, `*.log`.
   - Chỉ được phép tạo và sửa file bên trong thư mục `backend-node/`.
1. API Gateway & Persistence bền vững:
   - Bật CORS đầy đủ, đọc biến môi trường `PORT=3000`, `AI_SERVICE_URL=http://127.0.0.1:8000`, `PUBLIC_BASE_URL` (hoặc tự động suy ra từ header `x-forwarded-proto` / `host` để chạy mượt với Cloudflare Tunnel).
   - `POST /api/v1/itineraries/generate`: Nhận body từ Mobile, gọi sang `${AI_SERVICE_URL}/ai/generate`, sinh mã ngắn `shortCode` (VD 5 ký tự), gắn `itinerary_id` và `share_url` (`${baseUrl}/s/${shortCode}`), lưu vào file JSON bền vững `backend-node/data/store.json`, cập nhật bộ đếm thống kê và trả về đúng cấu trúc `ItineraryResponse`.
   - `POST /api/v1/itineraries/replan`: Gọi sang `${AI_SERVICE_URL}/ai/replan`, cập nhật lại lịch trình đã lưu, giữ hoặc tạo `share_url` và trả về `ItineraryResponse` mới.
   - `GET /health`: Kiểm tra trạng thái Node.js và kết nối tới FastAPI.
2. Trang Web Viral "Thẻ Chốt Kèo Nhóm" (Ăn điểm mở rộng thị trường):
   - `GET /s/:code`: Render trang HTML5 responsive tuyệt đẹp cho điện thoại (dùng CSS hiện đại + nhúng bản đồ Leaflet + OpenStreetMap miễn phí vẽ đúng ghim và lộ trình của kèo đó, hiển thị chi phí/người, tổng kcal, danh sách từng quán).
   - Có form nhỏ ngay trên trang web cho bạn bè nhận link qua Zalo nhập tên và bấm "Chốt tham gia kèo này!" (`POST /api/v1/share/:code/join`) rồi hiển thị danh sách những người đã tham gia ngay trên thẻ.
3. Dashboard Số Liệu Thực Tế Cho BGK:
   - `GET /api/v1/stats` (JSON) và `GET /admin/stats` (Trang web trực quan) hiển thị số lượng Lịch trình AI đã tạo, số lượt AI Re-plan thời gian thực, và tổng số Người dùng/Bạn bè đã tương tác tham gia kèo.
```

### 8.3. Chỉ dẫn cho Agent của NGƯỜI 3 (`ai-fastapi/` — Nhánh `feat/ai-fastapi`)
```text
Hãy đọc file `HACKATHON_PLAN.md` (đặc biệt Mục 7 JSON API Contract) và xây dựng hoàn chỉnh AI & Spatial Engine trong thư mục `ai-fastapi/` bằng Python FastAPI (chạy tại cổng 8000).

Yêu cầu thực thi tuần tự bắt buộc:
0. TỰ ĐỘNG TẠO NHÁNH GIT & BẢO MẬT API KEY (Làm đầu tiên trước khi viết code):
   - Kiểm tra Git và tự động chuyển sang nhánh riêng: chạy `git checkout -b feat/ai-fastapi` (nếu nhánh đã tồn tại thì chạy `git checkout feat/ai-fastapi`). Tuyệt đối không commit trực tiếp lên `main`.
   - Tạo ngay file `ai-fastapi/.gitignore` chặn `.venv/`, `venv/`, `__pycache__/`, `.env` (TUYỆT ĐỐI không đẩy `OPENAI_API_KEY` lên GitHub!).
   - Chỉ được phép tạo và sửa file bên trong thư mục `ai-fastapi/`.
1. Dữ liệu Địa điểm thật & Khả năng mở rộng toàn cầu:
   - Tạo file `ai-fastapi/data/hanoi_pois.json` chứa ít nhất 60 địa điểm CÓ THẬT, nổi tiếng tại Hà Nội (đặc biệt ưu tiên dày đặc quanh Thanh Xuân - Nguyễn Như Kon Tum - Nhân Chính - Vũ Trọng Phụng - Royal City, cùng với Đống Đa, Cầu Giấy, Hoàn Kiếm, Tây Hồ) phủ đủ các loại: `cafe`, `activity` (workshop gốm/vẽ, bowling, boardgame, triển lãm, rạp chiếu phim, công viên), `food` (quán ăn chính đa dạng từ healthy/salad/phở cuốn/bún tới lẩu/nướng), `dessert_chill` (trà, chè, sữa chua, acoustic). Mỗi địa điểm có tọa độ `lat`, `lng` sát thực tế, `address`, `indoor` (boolean), `estimated_cost_vnd`, `recommended_items` (mảng món ăn cụ thể), `estimated_calories_kcal`, `nutrition_tags`, `vibes`.
   - Viết thêm hàm bổ trợ truy vấn OpenStreetMap Overpass API miễn phí (timeout 2.5s) khi tọa độ `origin` nằm ngoài phạm vi Hà Nội để hệ thống chứng minh khả năng hoạt động ở bất kỳ thành phố nào trên thế giới.
2. Endpoint `POST /ai/generate`:
   - Dùng công thức Haversine lọc ~20 địa điểm ứng viên phù hợp bán kính gần `origin`, ngân sách và chế độ dinh dưỡng.
   - Gọi OpenAI API (đọc `OPENAI_API_KEY` từ `.env`, dùng model nhanh `OPENAI_MODEL=gpt-4o-mini` mặc định) với Structured Outputs / JSON Schema nghiêm ngặt để chọn 3-4 điểm dừng theo thứ tự thời gian hợp lý, tổng chi phí không vượt ngân sách (hoặc tối ưu sát nhất), giải thích `ai_reason` ngắn gọn thuyết phục và đánh giá `nutrition_badge` sát thực tế.
   - Tối ưu thứ tự địa lý để không đi vòng vèo, sau đó gọi OSRM Public Routing API miễn phí (`https://router.project-osrm.org/route/v1/driving/...?overview=full&geometries=geojson`, timeout 2.5s; nếu OSRM quá tải thì tự động fallback sang đường nối tọa độ + khoảng cách Haversine * 1.25 để không bao giờ lỗi) nhằm trả về `route_polyline` (mảng `[lat, lng]`), `distance_to_next_km` và `travel_to_next_minutes`.
   - Toàn bộ thời gian xử lý phải nhanh gọn trong khoảng 3 - 5 giây!
3. Endpoint `POST /ai/replan`:
   - Nhận `current_itinerary`, `target_stop_order` (hoặc tự chọn điểm cần đổi nếu `reason` là `rainy_weather` / `tighter_budget`), giữ nguyên các điểm tốt còn lại, dùng OpenAI + tập ứng viên lân cận chọn ngay 1 địa điểm thay thế tối ưu (VD: `rainy_weather` bắt buộc `indoor=true`; `tighter_budget` chọn điểm rẻ hơn; `lower_calories` chọn món nhẹ calo hơn).
   - Tính lại `route_polyline` qua OSRM, cập nhật lại `summary` (tổng tiền, tổng calo, tổng km, tổng phút) và trả về đúng schema `ItineraryResponse` trong dưới 3.5 giây.
4. Có `requirements.txt`, `.env.example`, `GET /health` và hướng dẫn chạy `uvicorn` rõ ràng.
```

---

## 9. Checklist Cài Máy Android Thật & Kịch Bản Pitch 5 Phút

### 9.1. Kết nối máy Android thật an toàn 100% trước 15:00
1. **Chạy 2 Backend trên 1 laptop chính:**
   - Terminal 1 (`ai-fastapi/`): `uvicorn main:app --host 0.0.0.0 --port 8000`
   - Terminal 2 (`backend-node/`): `npm start` (cổng `3000`)
   - Terminal 3 (Tạo HTTPS công khai miễn phí không cần cấu hình Wi-Fi):
     ```bash
     npx cloudflared tunnel --url http://localhost:3000
     ```
     Copy link `https://xxxx.trycloudflare.com` dán vào mục API URL trên App Android!
2. **Đưa App lên máy Android thật:**
   - **Tốt nhất (Có Android SDK / Android Studio trên máy Người 1):** Xuất file `.apk` cài trực tiếp lên điện thoại (`npx expo prebuild --platform android` -> `cd android && .\gradlew assembleRelease`). App có icon **Dayout AI** riêng trên màn hình chính, chạy bằng 4G độc lập hoàn toàn!
   - **Phương án 2 (Dùng Expo Go / Dev Client):** Phát **Hotspot 4G từ chính điện thoại Android** cho laptop (tắt hẳn Wi-Fi hội trường), hoặc cắm cáp USB chạy `adb reverse tcp:8081 tcp:8081` và `adb reverse tcp:3000 tcp:3000`.
3. **Bài kiểm tra bắt buộc 5 lần trước khi nộp bài:**
   - Mở danh sách ứng dụng gần đây trên Android -> **Vuốt tắt hẳn (Force-close) ứng dụng** -> Mở lại từ đầu -> Bấm **Tạo lịch trình mới** -> Bấm **Trời mưa (Đổi điểm)** -> Bấm **Share chốt kèo**.

### 9.2. Kịch bản Thuyết trình 5 Phút (16:15)
- **0:00 – 0:45 | Nỗi đau & Bằng chứng thật (Ăn 35đ Tiêu chí 2):**
  - Trình bày thẳng kết quả khảo sát buổi trưa ngay tại sự kiện: *"Khảo sát [X] bạn trẻ tại đây cho thấy trung bình tốn 45–60 phút nhảy qua 3 app (TikTok xem vibe, Google Maps đo đường, Menu tính tiền/calo) cho 1 buổi đi chơi cuối tuần."*
- **0:45 – 3:15 | Live Demo trên Điện thoại Android thật (Ăn 40đ Tiêu chí 1):**
  - Chiếu màn hình máy Android thật -> **Vuốt đóng hẳn app rồi chạm mở lại ngay trước mặt BGK** (hiện nguyên lịch trình đã lưu).
  - Chọn xuất phát tại *79 Nguyễn Như Kon Tum*, ngân sách `350k`, chế độ `Eat Clean` -> Bấm tạo trực tiếp. Sau 4 giây, bản đồ hiện lộ trình 3 điểm tối ưu, tổng chi phí `315k`, năng lượng `890 kcal`.
  - Bấm nút **"Trời mưa — AI đổi chặng"** -> trong 3 giây AI thay điểm ngoài trời bằng địa điểm trong nhà gần đó, tự động vẽ lại đường đi, tính lại tiền và calo.
- **3:15 – 4:30 | Người dùng thực tế & Mở rộng toàn cầu (Ăn 25đ Tiêu chí 3):**
  - Bấm nút **"Share chốt kèo nhóm"** mở thẻ web trực tiếp và công bố số liệu từ `/admin/stats`: *"Chiều nay đã có [Y] người dùng thực tế tại sự kiện tạo lịch trình và tham gia chốt kèo."*
  - **First Users:** Đánh vào tệp sinh viên & nhân viên văn phòng trẻ Hà Nội qua cơ chế Viral tự nhiên (1 người lập kèo gửi link Zalo kéo 3–4 bạn đi cùng).
  - **Global Scale:** Hệ thống kết hợp **OpenStreetMap toàn cầu + OSRM Routing + OpenAI đa ngôn ngữ**, không phụ thuộc nhập liệu thủ công từng thành phố -> sẵn sàng mở rộng ngay sang Bangkok, Singapore, Tokyo, Seoul cho cả giới trẻ bản địa lẫn khách du lịch tự túc.
- **4:30 – 5:00 | Tổng kết & Q&A.**
