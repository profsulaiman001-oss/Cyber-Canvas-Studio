# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a full-featured offline Graphic Design Editor PWA (Cyber-Studio) and a shared API server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Cyber-Studio Design Editor (`artifacts/design-editor`)
- **Route**: `/` (root)
- **Type**: React + Vite PWA
- **Description**: A 100% offline graphic design editor inspired by mobile design apps
- **Canvas Engine**: Fabric.js v6
- **Offline Storage**: localForage (IndexedDB)
- **PWA**: vite-plugin-pwa with service worker

#### Features
- **Canvas**: Custom dimensions (Instagram Post, Story, A4, Twitter Banner, custom px)
- **Shapes**: Rectangle, Circle, Triangle
- **Lines**: Straight lines, Bezier curves
- **Text**: IText with font size, weight, italic, alignment, letter spacing, custom fonts
- **Images**: Import from device gallery
- **Layers Panel**: Reorder, lock, hide, delete layers
- **Style Panel**: Fill, stroke, opacity, drop shadow, corner radius
- **Custom Fonts**: Upload .ttf/.otf via FontFace API, persisted in IndexedDB
- **Projects**: Save/load designs as JSON in IndexedDB with thumbnails
- **Export**: PNG/JPG with quality and 1x/2x/3x scale options
- **Undo/Redo**: 50-state history stack
- **Pinch-to-zoom & pan**: Touch and mouse wheel zoom
- **Auto-save**: Debounced 3s auto-save

#### Theme: Cyber-Studio Dark
- Background: `#0B0C10`
- Toolbars: `#11141A`
- Accent: Cyan `#00F5FF` / Electric Blue

#### Key Files
- `src/pages/DesignEditor.tsx` — root editor layout
- `src/hooks/useFabricCanvas.ts` — Fabric.js canvas management
- `src/hooks/useProjects.ts` — IndexedDB project CRUD
- `src/store/editorStore.tsx` — React context state
- `src/components/editor/` — all UI panels and dialogs

### API Server (`artifacts/api-server`)
- **Route**: `/api`
- Shared Express 5 backend (currently minimal, app uses IndexedDB only)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
