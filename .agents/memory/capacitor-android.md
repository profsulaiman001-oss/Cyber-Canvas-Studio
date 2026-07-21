---
name: Capacitor Android setup
description: How the Capacitor Android integration is structured in this monorepo
---

# Capacitor Android Setup

**Why:** Full offline APK build target alongside the Replit web preview.

## Location
All Capacitor files live inside `artifacts/design-editor/`:
- `capacitor.config.ts` — config file (root of Capacitor project)
- `android/` — generated Android Studio project
- `dist/public/` — Vite build output, used as `webDir`

## Build modes
- **Web dev:** `PORT=... BASE_PATH=/ pnpm run dev` (normal Replit preview)
- **Web build:** `pnpm run build` (needs `BASE_PATH` env)
- **Capacitor build:** `CAPACITOR_BUILD=true` → sets `base: './'` in vite.config, no PORT/BASE_PATH needed

## Key scripts (in design-editor package.json)
- `build:cap` — Capacitor-safe Vite build with relative base
- `cap:build` — full pipeline: build:cap + cap copy + cap sync
- `cap:sync` — sync only (after build)
- `cap:open` — open in Android Studio

## Config values
- appId: `com.pylab.graphicdesign`
- appName: `Graphic Design Studio`
- webDir: `dist/public`
- androidScheme: `https`
- minSdk: 24, targetSdk: 36

## Offline assets
- Fonts bundled via `@fontsource/inter` + `@fontsource/jetbrains-mono` (removed Google Fonts CDN)
- PWA service worker via `vite-plugin-pwa` with `globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,jpeg,woff,woff2,ttf,otf}']`
- 107 entries precached on first load
- navigateFallback: `index.html`

## Node.js requirement
Capacitor CLI v8 requires Node ≥22. Environment was upgraded to `nodejs-24`.

**How to apply:** Run `pnpm run cap:build` from `artifacts/design-editor/` to produce a fresh APK-ready Android project. Open `artifacts/design-editor/android/` in Android Studio to build the APK.
