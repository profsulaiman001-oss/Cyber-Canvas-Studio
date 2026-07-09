---
name: Bezier Pen Engine
description: How the pen tool implements Photoshop-style click+drag bezier anchors
---

## Flow
- `mouse:down` (pen active): record `penDownPointerRef = pointer`. Do NOT commit a node yet.
- `mouse:move` (pen active + penMouseDownRef true): compute drag delta from `penDownPointerRef`.
  If `dist > 3 / zoom`: set `cpOut = anchor + delta`, `cpIn = anchor - delta`; call `setPenLiveHandle` for the SVG overlay; call `updatePenPreview` with live ghost node.
- `mouse:up` (pen active + penMouseDownRef): commit `PenPoint {x, y, cpOut?, cpIn?}` to `penPointsRef`. Clear all live state. Call `updatePenPreview(newPts, null)`.

## Path Building
`buildBezierPathStr(pts, closed)`:
- For each segment `prev → curr`: use `prev.cpOut` as cp1, `curr.cpIn` as cp2.
- If both handles equal their anchors → emit `L`; otherwise emit `C cp1.x cp1.y cp2.x cp2.y curr.x curr.y`.

## PenPoint Type
```ts
export interface PenPoint {
  x: number; y: number;
  cpOut?: { x: number; y: number }; // outgoing handle (absolute design coords)
  cpIn?:  { x: number; y: number }; // incoming handle (mirrored from drag)
}
```

## SVG Overlay (Canvas.tsx)
- `buildSvgBezierPath(pts, zoom, vpX, vpY)` converts PenPoint[] to SVG path string in canvas-pixel space.
- Tangent arms rendered as SVG lines + diamond rects for each committed cpOut.
- `penLiveHandle` (from hook state) drives the in-progress drag preview.
- First anchor shown in red with a dashed circle when ≥3 nodes placed (close-path indicator).

**Why:** Click-only pen created only straight corners. Drag-to-create handles is the Photoshop/Figma standard that allows smooth bezier curves on node commit.
