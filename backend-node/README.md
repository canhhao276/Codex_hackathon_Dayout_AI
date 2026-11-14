# Dayout AI — `backend-node/` (Người 2)

Service **Node.js + Express (cổng 3000)** đóng vai trò API Gateway cho Mobile App (`Người 1`), lưu trữ bền vững lịch trình & người tham gia, render trang Web **Thẻ Chốt Kèo Nhóm** (`/s/:code`) dùng bản đồ Leaflet miễn phí và **Live Traction Dashboard** (`/admin/stats`) cho BGK.

## 1. Cài đặt & Khởi chạy nhanh

```bash
cd backend-node
npm install
npm start
```

Mặc định server chạy tại `http://localhost:3000` và gọi sang FastAPI AI Engine của Người 3 ở `http://127.0.0.1:8000`.
> **Chế độ dự phòng thông minh:** Nếu FastAPI (`:8000`) chưa bật hoặc mất kết nối tạm thời, `backend-node/` tự động kích hoạt `fallbackPlanner.js` (dữ liệu quán thật tại Thanh Xuân / Hà Nội + OSRM routing) để Mobile App và Web Share vẫn chạy 100% đúng JSON Contract (header `X-AI-Source: fallback`).

## 2. Mở HTTPS Public qua Cloudflare Quick Tunnel (Cho máy Android dùng 4G)

Mở thêm 1 terminal khác (không cần đăng nhập Cloudflare):

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Copy đường dẫn `https://xxxx.trycloudflare.com` dán vào phần cài đặt `apiBaseUrl` trong App Android. Node server tự đọc header `X-Forwarded-Proto` và `X-Forwarded-Host` nên mọi `share_url` trả về sẽ tự động dùng link `https://xxxx.trycloudflare.com/s/...` ngay lập tức!

## 3. Các Endpoint & Trang Web Quan Trọng

| Phương thức & Đường dẫn | Mục đích |
| :--- | :--- |
| `GET /health` | Kiểm tra Node.js và trạng thái kết nối FastAPI (`:8000`) |
| `POST /api/v1/itineraries/generate` | Nhận yêu cầu từ Mobile, gọi AI tạo lộ trình, lưu và gắn `share_url` |
| `POST /api/v1/itineraries/replan` | AI thích ứng thời gian thực (trời mưa, giảm ngân sách, đông quán, giảm calo) |
| `GET /s/:code` | **Thẻ Chốt Kèo Nhóm** (bản đồ Leaflet + form RSVP chốt tham gia + mã QR) |
| `GET /s/demo` | Thẻ chốt kèo mẫu tại Thanh Xuân để test giao diện & mời bạn bè dùng thử ngay |
| `POST /api/v1/share/:code/join` | Bạn bè bấm chốt tham gia kèo không cần cài app |
| `GET /api/v1/stats` | JSON số liệu người dùng & lượt tạo/replan |
| `GET /admin/stats` | **Dashboard Live Traction** tự động cập nhật mỗi 5s để chiếu cho BGK |

## 4. Chạy Kiểm Thử Tự Động

```bash
cd backend-node
npm test
```
