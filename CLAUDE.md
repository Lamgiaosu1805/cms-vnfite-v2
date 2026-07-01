# VNFITE CMS — CLAUDE.md

## Xưng hô

Luôn xưng **con** và gọi người dùng là **Ngài** trong mọi phản hồi.

## Tổng quan

Web admin CMS cho nền tảng P2P Lending VNFITE. Xây dựng bằng Vite + React + TypeScript + Tailwind CSS v4.

**Tên thương hiệu:** Luôn viết là **VNFITE** (toàn bộ chữ hoa).

**Quy tắc commit & push:** Không tự ý chạy `git commit` hay `git push`. Chỉ **gen câu lệnh** để người dùng tự chạy. Commit message ngắn gọn, 1 dòng.

## Múi giờ và định dạng ngày giờ

- Toàn bộ CMS bắt buộc hiển thị theo `Asia/Ho_Chi_Minh` (`UTC+7`), không phụ thuộc timezone của máy admin hoặc trình duyệt.
- Mọi màn phải dùng formatter chung trong `src/utils/dateTime.ts`; không gọi `toLocaleDateString('vi-VN')` hoặc `toLocaleString('vi-VN')` trực tiếp.
- Ngày hiển thị dạng zero-padded `dd/MM/yyyy`, ví dụ `22/01/2021`; ngày giờ dùng `HH:mm:ss dd/MM/yyyy` khi cần giây.
- `LocalDate` dạng `yyyy-MM-dd` phải format trực tiếp để không lệch ngày. `LocalDateTime` backend không có offset được hiểu là giờ Việt Nam `+07:00`; timestamp có offset phải quy đổi về `Asia/Ho_Chi_Minh`.
- Giá trị mặc định cho input ngày như ngày tra CIC phải lấy ngày hiện tại tại Việt Nam, không lấy ngày local của trình duyệt.

## Tech Stack

- **Framework:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- **Icons:** lucide-react
- **HTTP Client:** axios (xem quy tắc bên dưới)

## Môi trường

| Env | URL | Backend |
|-----|-----|---------|
| Test | `https://cms-test.vnfite.com.vn` | `http://42.113.122.119:7080` |
| Live | `https://cms.vnfite.com.vn` | `https://cms.vnfite.com.vn` (same host) |

Vite dev proxy: `/cms` → `http://42.113.122.119:7080` (tránh CORS khi dev local).

## HTTP Client

**Bắt buộc dùng axios** để call API — không dùng `fetch` hay `XMLHttpRequest` trực tiếp. Cấu hình interceptor (Bearer token, error handling, base URL) tập trung ở `src/api/client.ts`.

Màn `Giao dịch nạp/rút` dùng `GET /cms/transactions` với phân trang và bộ lọc. Dữ liệu thuộc `payment-service/payment_db`; CMS web và `cms_db` không được mirror hoặc tự tính lại giao dịch.

## Dark Mode

CMS đã có dark mode. Toggle bằng nút mặt trăng/mặt trời ở header, lưu vào `localStorage` key `cms_theme`. Cơ chế: toggle class `dark` trên `document.documentElement` → Tailwind `dark:` variant.

**Bắt buộc:** Khi thiết kế hoặc sửa bất kỳ component nào, phải thêm `dark:` classes cho mọi màu nền, chữ, border, input, modal — không chỉ làm một chế độ.

## Thuật ngữ

Dùng **"người gọi vốn"** và **"nhà đầu tư"** — không dùng "người vay" hay "cho vay" ở bất kỳ đâu trong UI, label, tiêu đề.

## Brand Colors

- **Đỏ chính:** `#C82020` → `#8B0A0A` (gradient)
- **Vàng accent:** `#E8A030`
- **Nền nhạt:** `#FFF8F7`

## Roles

| Role | Quyền |
|------|-------|
| `SUPER_ADMIN` | Toàn quyền, quản lý admin khác |
| `ADMIN` | Quản lý user, loan, dashboard |
| `OPS` | Xem dashboard, vận hành |

## Quy ước code

- State machine trong `App.tsx`: `loading → setup | login → change-password → main`
- Tách biệt API calls vào `src/api/client.ts`
- Pages trong `src/pages/`, components dùng lại trong `src/components/`
- Không dùng `any` — TypeScript strict

## Deploy

- Push lên `main` → CI/CD tự deploy test
- Deploy live: tạo PR `main → release`, chỉ owner merge được
