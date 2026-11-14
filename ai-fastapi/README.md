# ai-fastapi — Dayout AI: AI & Spatial Engine (cổng 8000)

Phần của **Người 3** (nhánh `feat/ai-fastapi`). Nhận yêu cầu từ Node BFF (Người 2), trả về `ItineraryResponse` **đúng JSON Contract ở Mục 7 của `HACKATHON_PLAN.md`**.

```
Request ─► lọc Haversine ~20 quán thật quanh origin (data/hanoi_pois.json, ngoài Hà Nội → OSM Overpass)
        ─► OpenAI Structured Outputs (gpt-4o) chọn 3–4 điểm theo id + viết ai_reason
        ─► sửa ngân sách (đổi quán rẻ hơn nếu lố) ─► sắp thứ tự tối ưu (thử mọi hoán vị, phạt giờ ăn/giờ mở cửa)
        ─► OSRM free routing (timeout tự co theo deadline, sập thì nối thẳng × 1.25) ─► xếp giờ ─► JSON
```

- AI chỉ được chọn id có trong danh sách ứng viên (JSON-schema `enum`), nên **không bịa ra quán**. Giá, kcal và tọa độ lấy từ dữ liệu; quãng đường lấy từ OSRM.
- Không có key OpenAI, hoặc OpenAI quá chậm? Hệ thống tự chuyển sang thuật toán chấm điểm dự phòng nên **không bao giờ trả lỗi**. Header `X-AI-Engine` cho biết engine nào đã chạy, VD `openai+osrm` hoặc `heuristic+fallback`.
- Thời gian đo với OpenAI thật (14/11, Wi-Fi hội trường): mỗi lần gọi gpt-4o ~2.3s (gpt-4o-mini 3–5s) → `/ai/generate` ~3s, `/ai/replan` ~2.5s. Server tự "làm nóng" OpenAI khi khởi động nên lần bấm đầu tiên cũng nhanh.

## Chạy nhanh

```bash
cd ai-fastapi
cp .env.example .env            # rồi điền OPENAI_API_KEY (file .env đã bị git-ignore)

# Cách 1: uv (nhanh)
uv venv --python 3.12 .venv && uv pip install --python .venv -r requirements.txt
# Cách 2: pip
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/pip

.venv/Scripts/uvicorn main:app --host 0.0.0.0 --port 8000             # macOS/Linux: .venv/bin/uvicorn
```

Windows có sẵn script: `powershell -ExecutionPolicy Bypass -File start.ps1` (tự tạo venv, cài thư viện, chạy server).

Kiểm tra: `curl http://127.0.0.1:8000/health` → `openai_configured: true` là AI thật đang bật.
Test offline (giả lập OpenAI/OSRM/Overpass): `.venv/Scripts/python -m pytest -q`.

## Endpoints

| Method | Path | Mô tả |
| :-- | :-- | :-- |
| `GET` | `/health` | Trạng thái, OpenAI bật/tắt, số POI |
| `POST` | `/ai/generate` | Body = Request 7.1 → `ItineraryResponse` |
| `POST` | `/ai/replan` | Body = Request 7.2 → `ItineraryResponse` mới |
| `GET` | `/ai/pois` | (debug) Toàn bộ dữ liệu địa điểm |

Header trả về: `X-AI-Engine` (`openai`/`heuristic`/`noop` + `osrm`/`fallback`), `X-Process-Time-Ms`, và riêng replan có `X-Replan-Changed` (`0` = không cần đổi gì, VD trời mưa nhưng mọi điểm đã ở trong nhà).

Lỗi: `422` khi body sai (VD replan thiếu `current_itinerary.stops`), `503` khi không tìm thấy địa điểm quanh origin (ngoài Hà Nội và Overpass không phản hồi).

## Ghi chú tích hợp

### Cho Người 2 (backend-node)
- **Generate:** chuyển nguyên body từ mobile sang `POST {AI_SERVICE_URL}/ai/generate`. FastAPI đã sinh `itinerary_id` (`itin_YYYYMMDD_xxxxxx`) và để `share_url: ""`. Node ghi đè `share_url` (và `itinerary_id` nếu muốn) trước khi lưu và trả về cho mobile.
- **Replan:** gửi `current_itinerary` là **toàn bộ** itinerary đang lưu, kể cả `share_url`. FastAPI giữ nguyên `itinerary_id` và `share_url`.
- **Field tùy chọn trong body replan (không bắt buộc, không đổi contract):** `nutrition_goal`, `vibes`, `origin`. Nếu Node lưu request generate ban đầu thì gửi kèm 3 field này để AI đổi điểm sát sở thích hơn. Nếu không gửi, FastAPI tự suy ra từ `nutrition_badge` và `route_polyline[0]`.
- **Timeout gợi ý phía Node:** generate 10s, replan 8s.

### Cho Người 1 (mobile)
- Nút **"Trời mưa"**: `reason: "rainy_weather"`, `target_stop_order: null`. Engine tự đổi **mọi** điểm ngoài trời sang điểm trong nhà gần đó. Nếu header `X-Replan-Changed: 0` thì có thể hiện toast "Lịch trình đã 100% trong nhà".
- Nút **"Tiết kiệm (-20%)"**: `reason: "tighter_budget"`, `new_budget_vnd: round(budget * 0.8)`. Nếu bỏ trống, engine tự lấy 80% tổng hiện tại.
- Nút **"Đổi quán này"** trên từng thẻ: `reason: "crowded"`, `target_stop_order: <order>`.
- `lower_calories` cũng được hỗ trợ: đổi điểm có kcal cao nhất, hoặc đổi điểm chỉ định qua `target_stop_order`.
- Chặng cuối có `distance_to_next_km = 0`, `travel_to_next_minutes = 0`.
- `route_polyline` bắt đầu tại điểm xuất phát (origin) và đi qua lần lượt các điểm dừng.

### Mẹo demo trước BGK
Chọn thêm vibe **"Chụp ảnh" (`photo_spot`)** để lịch trình có 1 điểm ngoài trời (công viên/hồ). Khi bấm **"Trời mưa"**, BGK sẽ thấy rõ AI thay điểm đó bằng một điểm trong nhà gần bên, vẽ lại đường đi, tính lại tiền và calo.

## Dữ liệu `data/hanoi_pois.json`
79 địa điểm có thật, gồm 20 `cafe`, 29 `activity`, 21 `food`, 9 `dessert_chill`, tập trung quanh Thanh Xuân/Royal City, Đống Đa, Ba Đình, Cầu Giấy, Hoàn Kiếm, Hai Bà Trưng, Tây Hồ. Mỗi điểm có `lat/lng`, `address`, `indoor`, `estimated_cost_vnd` (mỗi người), `recommended_items`, `estimated_calories_kcal`, `nutrition_tags`, `vibes`, `open_time/close_time`.
Giá và kcal là **ước lượng** cho 1 người. Nên kiểm tra lại giá thực tế trước khi pitch nếu BGK hỏi.

Khi origin nằm **ngoài Hà Nội**, engine gửi truy vấn Overpass song song tới 2 mirror (timeout ~2.5s) để lấy quán/công viên/bảo tàng thật quanh vị trí. Nhờ vậy hệ thống chạy được ở mọi thành phố (Bangkok, Singapore, Tokyo…), đúng luận điểm Global Scale trong pitch.

## Bằng chứng người dùng (Tiêu chí 2)
Xem [`evidence/SURVEY.md`](evidence/SURVEY.md): kịch bản khảo sát 3 câu, file nhập liệu `survey_responses.csv`, và `tally_survey.py` để xuất số liệu kèm câu chốt cho pitch.
