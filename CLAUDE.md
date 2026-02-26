# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Vite dev server (port 5173), proxies /api to backend
npm run start:backend    # Start Express backend (port 3001)
npm run build            # TypeScript check + Vite production build
npm run lint             # ESLint
npm test                 # Vitest (all tests)
npx vitest run tests/diff.test.ts    # Run a single test file
npx tsx scraper/scrape.ts            # Run scraper manually
```

## Architecture

Three-layer TypeScript monorepo: React frontend, Express backend, Playwright scraper.

**Frontend** (`src/`) — React 18 + Vite. Single-page dashboard with no router. Renders course data from `data/stats.json` (static on GitHub Pages) or `/api/stats` (dev proxy). Components:
- `App.tsx` — Main dashboard: fetches stats, computes diffs (added/removed courses), renders dual-region card layout with theme toggle
- `components/EventMonitor.tsx` — Conditional event page monitor, shown only when event URLs are configured and data exists

**Backend** (`server/index.ts`) — Express 5 on port 3001. Three endpoints:
- `GET /api/stats` — serves `data/stats.json`
- `GET /api/config` — serves `data/event_config.json`
- `POST /api/config` — updates event config and triggers immediate scrape

Has a node-cron job (daily 00:00 Asia/Shanghai) that runs the scraper.

**Scraper** (`scraper/scrape.ts`) — Playwright headless Chromium. Three exported functions:
- `scrapeHQ(url?)` — scrapes global DLI self-paced courses page (tab navigation, "Show More" expansion, cookie banner dismissal)
- `scrapeChina(url?)` — scrapes China DLI courses page (tab-based, Chinese price parsing)
- `scrapeGTCEvent(url, isChina?)` — scrapes event training pages

The `main()` function orchestrates all scraping, preserves previous data for diff comparison, and writes to `data/stats.json`.

**Data** (`data/`) — JSON file-based storage, no database:
- `stats.json` — current + previous scrape snapshots with timestamp
- `event_config.json` — configurable event page URLs

## Data Flow

GitHub Actions scrape (daily 22:00 UTC / 6:00 AM Beijing) → Playwright scrapes NVIDIA pages → writes `data/stats.json` → auto-commits to main → triggers GitHub Pages deploy → frontend reads static JSON.

In development: Vite proxies `/api/*` to Express backend on port 3001.

## CI/CD Workflows (`.github/workflows/`)

- `scrape.yml` — Daily scrape + commit (skips bot commits to prevent loops)
- `deploy.yml` — Build + deploy to GitHub Pages (copies data/ to dist/data/)
- `test.yml` — Runs `npm test` on push/PR
- `configure-event.yml` — Manual dispatch to update event_config.json

## Key Conventions

- TypeScript strict mode across all configs
- Types (`Course`, `Section`, `RegionData`, `Stats`) are defined inline in `App.tsx` and duplicated in the scraper — not in a shared types file
- Theme preference persisted to localStorage
- Vite base path is `/dashboard/` for GitHub Pages
- Production frontend reads static files (`./data/stats.json`); dev uses API proxy
- Git workflow: pull with rebase (`git pull --rebase origin main`) before pushing
