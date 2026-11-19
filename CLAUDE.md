# Quy tắc làm việc trong repo BANGTIENDO

Repo này dùng để lưu trữ và đồng bộ file giữa laptop, PC và các phiên Claude trên cloud.
Mỗi thư mục ở cấp gốc là một **thư mục làm việc** riêng (một dự án hoặc một mảng công việc).
Mọi phiên Claude phải tuân thủ các quy tắc dưới đây.

## Quy tắc 1: Bắt đầu phiên — hỏi gắn vào thư mục nào

Trước khi làm bất kỳ việc gì khác trong phiên:

1. Đồng bộ repo về bản mới nhất: `git pull` (nếu lỗi do lịch sử khác nhau, báo người dùng, không tự `reset --hard`).
2. Liệt kê các thư mục làm việc hiện có ở cấp gốc (bỏ qua `.git`, `.claude` và các file lẻ như `README.md`, `CLAUDE.md`).
   Với mỗi thư mục, nếu có thể, kèm ngày của log gần nhất trong `_logs/`.
3. **Hỏi người dùng** (dùng công cụ hỏi lựa chọn nếu có) phiên này sẽ gắn vào:
   - một thư mục có sẵn, hoặc
   - tạo thư mục mới — hỏi tên thư mục.
4. Không được tự chọn thư mục thay người dùng, kể cả khi chỉ có một thư mục.
5. Nếu tạo mới: tên thư mục dùng chữ không dấu, không khoảng trắng (ví dụ `bao-cao-thang-11`),
   tạo kèm `README.md` mô tả ngắn mục đích thư mục và thư mục con `_logs/`.
6. Sau khi gắn, mọi file tạo ra hoặc sửa trong phiên đều nằm trong thư mục đó
   (trừ khi người dùng yêu cầu rõ khác).

## Quy tắc 2: Luôn lưu log mỗi phiên theo từng thư mục

Mỗi phiên có đúng một file log, đặt trong thư mục đã gắn:

```
<thư-mục>/_logs/YYYY-MM-DD_HHMM_<nơi-chạy>.md
```

- `YYYY-MM-DD_HHMM`: thời điểm bắt đầu phiên (giờ Việt Nam, UTC+7).
- `<nơi-chạy>`: `laptop`, `pc` hoặc `cloud` (hỏi người dùng nếu không rõ).

Nội dung file log:

```markdown
# Log phiên YYYY-MM-DD HH:MM — <nơi-chạy>

- **Thư mục:** <tên thư mục>
- **Mục tiêu:** <người dùng muốn làm gì>

## Diễn biến
- HH:MM — <việc đã làm / quyết định quan trọng>

## File đã tạo / sửa / xóa
- `đường/dẫn` — <mô tả ngắn>

## Kết quả
<đã xong gì, còn lỗi gì>

## Việc tiếp theo
- <việc còn dang dở cho phiên sau>
```

Cách ghi:

- Tạo file log ngay sau khi người dùng chọn thư mục.
- Cập nhật log sau mỗi bước quan trọng, không đợi đến cuối phiên.
- Cuối phiên (hoặc khi người dùng kết thúc công việc): hoàn thiện mục **Kết quả** và **Việc tiếp theo**,
  rồi commit và push lên `main`:
  `git add <thư-mục> && git commit -m "<thư-mục>: log phiên YYYY-MM-DD HH:MM" && git push`.
- Không ghi mật khẩu, token, API key hay thông tin bí mật vào log.
- Không sửa hay xóa log của các phiên trước.

## Quy tắc chung

- Khi bắt đầu làm việc với một thư mục có sẵn, đọc log gần nhất trong `_logs/` để nắm việc dang dở.
- Không xóa thư mục làm việc hoặc dữ liệu của thư mục khác nếu người dùng không yêu cầu rõ ràng.
