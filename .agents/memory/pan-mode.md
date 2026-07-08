---
name: Pan mode architecture
description: How pan/scroll works on desktop and mobile — container-scroll approach, touch guards, NaN crash prevention
---

## Rule
Pan uses container `overflow:auto` scroll, not Fabric viewportTransform. Touch pan is exclusively handled in Canvas.tsx touch handlers. The Fabric `mouse:down`/`mouse:move` pan path must be skipped for touch events.

**Why:** Fabric synthesizes `mouse:down` from `TouchEvent`, but `.clientX` on a TouchEvent is `undefined`. Allowing the Fabric pan path to run on touch sets `lastPanX = undefined`, then `ct.scrollLeft -= NaN` silently corrupts the scroll container → total black-screen viewport crash on mobile.

**How to apply:**
- `Canvas.tsx` container: `touchAction: 'none'` in CSS + `{ passive: false }` on touchstart/touchmove listeners. Always call `e.preventDefault()` in both handlers (even when pan is inactive) — this is the sole guard preventing native browser touch-scroll when the pan tool is OFF.
- `Canvas.tsx` touch handlers: only scroll `ct.scrollLeft/Top` when `panActive && e.touches.length === 1`.
- `useFabricCanvas.ts` `mouse:down`: gate the pan block behind `!('touches' in me)` — skip entirely for touch events.
- `useFabricCanvas.ts` `mouse:move`: gate behind `isPanning && !('touches' in opt.e)` — same NaN-safety guard.
- Pinch-to-zoom: separate touchstart/touchmove bound to `canvasEl.current` (not the container), only fires for `e.touches.length === 2`.
- `PAN_MARGIN = 600px` extra space on all sides for scroll room; `fitToContainer` scrolls to `PAN_MARGIN` to center canvas on init/resize.
