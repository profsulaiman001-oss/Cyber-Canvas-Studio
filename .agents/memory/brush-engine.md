---
name: Brush Engine implementation
description: How the brush tool (standard/glow/airbrush) is implemented and wired up
---

- Brush state (preset, color, size, neonIntensity) lives in editorStore
- Activation: `activateBrush(preset, color, size)` tracks current preset via `brushPresetRef.current = preset`
- Standard preset: plain PencilBrush, no shadow
- **Glow / Neon preset:** near-transparent core `rgba(r,g,b,0.08)` + width=size*0.18 + Shadow blur=size*8; `path:created` applies `globalCompositeOperation='screen'` for light-emission blending
- Airbrush: PencilBrush with rgba(r,g,b,0.08) color + width*4, no shadow
- `path:created` handler checks `brushPresetRef.current === 'glow'` — if so, sets screen blend on new path
- BottomToolbar shows Neon Intensity slider only when `brushPreset === 'glow'`; dispatches SET_NEON_INTENSITY to store

**Why:** Near-transparent core is required — a fully transparent stroke produces no shadow in the canvas 2D API because the shadow only renders around drawn pixels. The screen blend makes overlapping strokes additively bright like real neon tubes.
