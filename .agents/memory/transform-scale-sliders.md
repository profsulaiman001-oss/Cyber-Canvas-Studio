---
name: Transform slider scaling
description: Preserve manual non-uniform object dimensions when using the Transform panel scale slider
---

Transform scale sliders must apply a relative multiplier to the object's current `scaleX` and `scaleY`, not replace both axes with the same base percentage. Calculate the scale range dynamically from the artboard dimensions and keep the current value reachable.

**Why:** Users may intentionally stretch a square or circle into a rectangle or ellipse; a uniform reset on the next slider input destroys that transformation.

**How to apply:** When changing a shared scale value, preserve the current `scaleX`/`scaleY` ratio. Derive the upper bound from the largest canvas dimension and object base dimensions, with a high enough minimum to support large artboards.