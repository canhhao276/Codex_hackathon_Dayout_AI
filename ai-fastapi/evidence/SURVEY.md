# Khảo sát nhanh tại hội trường (12:00 – 12:40) — Bằng chứng cho Tiêu chí 2 (35đ)

**Mục tiêu:** 15–20 bạn trẻ, mỗi bạn ~60 giây, 3 câu hỏi + 1 câu bonus.
**Ghi kết quả:** điền từng dòng vào [`survey_responses.csv`](survey_responses.csv) (hoặc ghi giấy rồi nhập lại), sau đó chạy:

```bash
.venv/Scripts/python evidence/tally_survey.py      # Windows
.venv/bin/python evidence/tally_survey.py          # macOS/Linux
```

Script sẽ in số liệu và tạo `evidence/survey_summary.md` gồm câu chốt dùng thẳng cho pitch.

> ⚠️ Chỉ nhập câu trả lời THẬT. BGK có thể hỏi lại người được khảo sát; số liệu bịa sẽ mất trọn 35 điểm.

---

## Câu mở đầu (≤10 giây)

> "Chào bạn, mình đang làm app AI lên lịch đi chơi cuối tuần cho hackathon. Bạn cho mình xin 1 phút trả lời 3 câu ngắn được không ạ?"

## 3 câu hỏi chính

**Q1. Lần gần nhất đi chơi/hẹn hò cuối tuần, bạn mất khoảng bao lâu để chốt xong lịch trình (đi đâu, ăn gì, đường đi, chi phí)?**
Ghi số phút ước lượng vào cột `q1_minutes` (VD: `45`). Nếu bạn ấy nói khoảng thì lấy số giữa: "<15 phút" → `10`, "15–30" → `20`, "30–60" → `45`, "hơn 1 tiếng" → `75`.

**Q2. Bạn phải mở bao nhiêu app/nguồn để lên kế hoạch?** (TikTok/Instagram xem review, Google Maps, Facebook group, Zalo nhóm, Shopee Food/menu…)
Ghi số lượng vào `q2_apps_count`, liệt kê tên ngắn vào `q2_apps` cách nhau bởi `|` (VD: `tiktok|maps|zalo`).

**Q3. Điều gì làm bạn mệt nhất khi lên kế hoạch đi chơi?** (cho chọn tối đa 2)
Ghi mã vào `q3_pains`, cách nhau bởi `|`:

| Mã | Nỗi đau |
| :-- | :-- |
| `A` | Không biết đi đâu / quán nào hợp vibe |
| `B` | Đường đi vòng vèo, các điểm xa nhau |
| `C` | Không ước lượng được tổng chi phí, hay lố ngân sách |
| `D` | Khó kiểm soát ăn uống / calo / ăn healthy |
| `E` | Cả nhóm bàn mãi không chốt được kèo |
| `F` | Thời tiết (mưa) làm hỏng kế hoạch |

## Câu bonus (traction cho Tiêu chí 3)

**Q4. Nếu có app chỉ cần 10 giây chọn ngân sách + sở thích là ra lộ trình trên bản đồ kèm tổng tiền & calo, bạn có muốn dùng thử ngay không? (1 = không, 5 = rất muốn)**
Ghi vào `q4_would_try`. Nếu bạn ấy cho 4–5 → mời quét QR link chốt kèo (Người 2) để thành **user thật**.

## Cột trong CSV

| Cột | Ý nghĩa |
| :-- | :-- |
| `id` | Số thứ tự 1, 2, 3… |
| `age_group` | `18-22`, `23-27`, `28-35`, `35+` |
| `occupation` | `sinh_vien`, `van_phong`, `khac` |
| `q1_minutes` | Số phút (số nguyên) |
| `q2_apps_count` | Số app (số nguyên) |
| `q2_apps` | Tên app, ngăn bởi `|` |
| `q3_pains` | Mã nỗi đau, ngăn bởi `|` |
| `q4_would_try` | 1–5 (có thể bỏ trống) |
| `quote` | 1 câu nói nguyên văn đáng giá (tùy chọn, rất mạnh khi pitch) |
