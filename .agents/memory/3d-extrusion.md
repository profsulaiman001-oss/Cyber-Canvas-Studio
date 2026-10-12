---
name: True 3D extrusion rendering
description: How the 3D depth effect renders successive offset layers behind objects
---

- `_depth3d` property stored on FabricObject; legacy `angle` remains the extrusion direction while newer configs may also carry `depthAngle`, `lightAngle`, `lightIntensity`, `shadowDepth`, `shadowFalloff`, `specularHardness`, `darkenIntensity`, `bevel`, and `bevelTaper`
- Hook the Fabric object's own `render(ctx)` so its cast shadow and back-to-front depth slabs draw immediately before its face in the normal stack pass; the context already includes viewport and parent transforms
- Algorithm: temporarily override the object, draw a soft cast shadow, then paint back-to-front offset slabs with per-layer directional gradients; restore object properties in `finally` and let the wrapped base renderer paint the face once
- Lighting is intentionally Canvas2D/Fabric-native: light angle controls directional gradients, intensity controls the highlight, shadow depth/falloff control the cast shadow, specular hardness tightens the highlight, and darken intensity shades the far slabs

**Why:** A canvas-wide `after:render` pass paints effects above every object regardless of layer order. Back-to-front `source-over` rendering inside each object keeps extrusion and cast shadow within its z-order while destination-over becomes invisible on opaque backgrounds.
**How to apply:** Install hooks before the ordered render pass, including after loading or restoring objects; dirty containing groups when child effect settings change, preserve legacy `angle`, and write both `angle` and `depthAngle` for new configs.
