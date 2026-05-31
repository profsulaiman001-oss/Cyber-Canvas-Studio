---
name: Fabric v6 quirks
description: Non-obvious Fabric.js v6 API differences vs v5 and edge cases in this codebase
---

- `canvas.toJSON()` requires explicit extra-props array: `(c as any).toJSON(['_uid', '_name', '_innerShadow', '_textureKey', '_depth3d', '_glow'])`
- `canvas.loadFromJSON(json)` requires `(c as any).loadFromJSON(json)`
- `bringObjectForward` / `sendObjectBackwards` require `(c as any).bringObjectForward(obj)`
- `after:render` fires post ctx.restore() — use `ctx.setTransform(vp...)` before drawing overlays
- `PencilBrush.shadow` is a real `Shadow` object and works for glow effect
- `canvas.isDrawingMode = true` enables freehand; `path:created` event fires when stroke completes
- `FabricImage.fromURL(url)` is async and preferred over `fabric.Image.fromURL` callback style

**Why:** These are undocumented breaking changes from v5 → v6 that caused TypeScript errors and runtime failures in previous sessions.
