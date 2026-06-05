---
name: Canvas coordinate alignment
description: How fitToContainer must size the Fabric canvas to avoid export/click coordinate mismatch
---

## The Rule

`fitToContainer` must size the Fabric canvas to exactly `dw*zoom × dh*zoom` (design area) with **no viewport translation**:

```javascript
const cw = Math.round(designWidth.current * newZoom);
const ch = Math.round(designHeight.current * newZoom);
c.setDimensions({ width: cw, height: ch });
c.setViewportTransform([newZoom, 0, 0, newZoom, 0, 0]);
```

**Why:** Fabric v6's `setDimensions` sets BOTH HTML canvas attributes AND inline CSS styles (it calls `setCSSDimensions` internally). If the canvas is set to the full container size (W×H), Fabric overrides the CSS to W×H. The canvas then overflows the inner design-area div (dw*zoom × dh*zoom), which clips at its own boundary. The design area starts at offset `(vpX, vpY)` inside the W×H canvas, so the inner div's top-left shows canvas pixel `(0,0)` — which is BEFORE the design area origin. Clicks and drags anywhere in the visible inner div are displaced by `(vpX, vpY)` canvas pixels, producing wrong design coordinates that misalign with the export.

**How to apply:** Every time the canvas is resized or zoomed (fitToContainer, mouse:wheel, pinch zoom), compute `cw = dw*zoom`, `ch = dh*zoom`, call `setDimensions({width: cw, height: ch})` then `setViewportTransform([zoom, 0, 0, zoom, 0, 0])`. The inner div in Canvas.tsx is already sized to `dw*zoom × dh*zoom` via inline style — so it exactly matches the canvas and no overflow/clip occurs.

**Export is unchanged:** Export resets viewport to identity, sets canvas to design dimensions, calls `toDataURL`, then restores via `fitToContainer()`. This is correct because design object positions are always in design-space coordinates.

**getCenter formula stays correct:** `cx = (c.width/2 - vt[4]) / zoom = (dw*zoom/2 - 0) / zoom = dw/2` ✓
