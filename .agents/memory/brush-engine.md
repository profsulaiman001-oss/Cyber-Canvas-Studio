---
name: Brush Engine implementation
description: How the brush tool (standard/glow/airbrush) is implemented and wired up
---

- Brush state (preset, color, size) lives in editorStore: `brushPreset`, `brushColor`, `brushSize`
- Activation: `activateBrush(preset, color, size)` in useFabricCanvas — sets `canvas.isDrawingMode = true`
- Standard preset: plain PencilBrush, no shadow
- Glow preset: PencilBrush with thin core (width*0.4) + Shadow(blur=size*4)
- Airbrush: PencilBrush with rgba(r,g,b,0.08) color + width*4
- `path:created` event tags each stroke as `_name = 'Brush Stroke N'` via `tagObj(e.path, 'brush')`
- DesignEditor watches `activeTool === 'brush'` via useEffect and calls activateBrush with current store values
- Deactivation: Done button in BottomToolbar → sets tool to 'select' → useEffect calls deactivateBrush
- UI: AddElementSheet has Draw section (3 preset cards + color picker + size slider), BottomToolbar shows brush active mode

**Why:** Brush state in store allows both AddElementSheet and BottomToolbar to share color/size; useEffect in DesignEditor is the single activation point to avoid double-activation bugs.
