# VNFITE CMS - AGENTS.md

This file is the Codex entrypoint for the VNFITE CMS web project.

Read `CLAUDE.md` first for the source of truth. If this file and `CLAUDE.md` disagree, follow `CLAUDE.md` and update this file.

## Project Boundary

This repository is the CMS web frontend only.

Related projects:

- Backend microservices: `/Users/lamgs/Desktop/p2p-lending`
- Mobile app: `/Users/lamgs/Desktop/APP/VnFiteInvest`
- CMS web: `/Users/lamgs/Desktop/APP/VnFiteCMS`

Do not move frontend CMS code back into the backend repository. The backend keeps `apps/api/cms-service`; this project owns only the web UI that calls that service.

## Stack

- Vite
- React 19
- TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- Icons: `lucide-react`
- HTTP client: `axios`

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run build:test
npm run build:prod
npm run preview
```

## API Rules

- Use `axios` only.
- Do not call `fetch` or `XMLHttpRequest` directly.
- Keep API configuration, bearer token handling, base URL, and error handling centralized in `src/api/client.ts`.
- Local Vite dev proxy maps `/cms` to `http://42.113.122.119:7080`.

## Environments

- Test CMS URL: `https://cms-test.vnfite.com.vn`
- Test backend: `http://42.113.122.119:7080`
- Live CMS URL: `https://cms.vnfite.com.vn`
- Live backend: same host through `/cms`

## Product And Brand

- Always write the brand as `VNFITE`.
- Main red: `#C82020`
- Dark red: `#8B0A0A`
- Accent gold: `#E8A030`
- Soft background: `#FFF8F7`

## UI Guidance

- CMS is an admin/operations tool, so favor dense, scannable, work-focused interfaces.
- Avoid marketing-style hero layouts inside the admin app.
- Use tables, filters, summaries, forms, badges, tabs, and modals where they improve operator workflow.
- Use `lucide-react` icons for actions and navigation.
- Keep colors restrained; red should indicate VNFITE brand and important actions, not dominate every surface.

## Code Rules

- Keep TypeScript strict.
- Do not use `any` unless there is no practical alternative and the reason is clear.
- App state machine lives in `src/App.tsx`: `loading -> setup | login -> change-password -> main`.
- Shared UI components live in `src/components/`.
- Pages live in `src/pages/`.
- Keep side effects and API calls predictable and centralized.

## Git

- Do not commit or push unless the user explicitly asks.
- When asked to commit, use a short one-line commit message.
- Push to `main` deploys test through CI/CD.
- Live deploy is through PR from `main` to `release`.

## Before Finishing Changes

- Run `npm run lint` for UI/code changes when feasible.
- Run `npm run build` for broader changes or before deployment-related work.
- Report clearly if a check was not run.
