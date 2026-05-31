---
name: True 3D extrusion rendering
description: How the 3D depth effect renders successive offset layers behind objects
---

- `_depth3d` property stored on FabricObject: `{ enabled, steps, color, angle }`
- Rendered in `after:render` event via `draw3DLayer(ctx, obj, cfg, vp)`
- Algorithm: temporarily override obj.fill=color, shadow=null, strokeWidth=0; iterate i=1..steps; each step translates by (cos(angle)*i, sin(angle)*i); uses `destination-over` composite so layers go behind the object
- Opacity tapers: `baseOpacity * max(0.25, 1 - 0.65 * (i/steps))`
- After loop, original fill/shadow/strokeWidth are restored

**Why:** Using canvas destination-over compositing (not Fabric shadows) gives true directional 3D stacking with the correct visual illusion. Tried shadows in v1 but they couldn't achieve the multi-layer directional look.
**How to apply:** Call `apply3DDepth(obj, { enabled: true, steps: 8, color: '#333', angle: 225 })` from PropertiesPanel.
