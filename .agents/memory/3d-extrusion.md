---
name: True 3D extrusion rendering
description: How the 3D depth effect renders successive offset layers behind objects
---

- `_depth3d` property stored on FabricObject; legacy `angle` remains the extrusion direction while newer configs may also carry `depthAngle`, `lightAngle`, `lightIntensity`, `shadowDepth`, `shadowFalloff`, `specularHardness`, `darkenIntensity`, `bevel`, and `bevelTaper`
- Rendered in `after:render` event via `draw3DLayer(ctx, obj, cfg, vp)`
- Algorithm: temporarily override the object, draw a soft cast shadow, then paint back-to-front offset slabs with per-layer directional gradients and restore the original front face on top
- Lighting is intentionally Canvas2D/Fabric-native: light angle controls directional gradients, intensity controls the highlight, shadow depth/falloff control the cast shadow, specular hardness tightens the highlight, and darken intensity shades the far slabs

**Why:** Back-to-front `source-over` rendering keeps the extrusion behind the face while allowing each wall layer and the cast shadow to respond to separate lighting controls; destination-over becomes invisible when the background is opaque.
**How to apply:** Preserve `angle` when loading older projects, and write both `angle` and `depthAngle` when creating new configs so existing files keep their depth direction.
