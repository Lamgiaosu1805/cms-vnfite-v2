# VNFITE CMS — CLAUDE.md

## Tổng quan

Web admin CMS cho nền tảng P2P Lending VNFITE. Xây dựng bằng Vite + React + TypeScript + Tailwind CSS v4.

**Tên thương hiệu:** Luôn viết là **VNFITE** (toàn bộ chữ hoa).

**Quy tắc commit & push:** Không tự ý chạy `git commit` hay `git push`. Chỉ **gen câu lệnh** để người dùng tự chạy. Commit message ngắn gọn, 1 dòng.

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
