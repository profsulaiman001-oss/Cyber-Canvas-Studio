---
name: Color Studio gradient context
description: Durable rules for applying colors and presets while editing gradient stops.
---

The Color Studio must preserve the active gradient tab and focused stop whenever a solid color comes from the spectrum, a Recent Colors swatch, or the Eyedropper. Those actions update only that stop. A Recent Gradient swatch is the explicit exception: it restores the complete saved gradient configuration.

**Why:** Treating every sampled or recent color as a solid fill used to silently destroy the active gradient mode and lose the user's stop selection.

**How to apply:** Keep the active mode and selected-stop index in the Eyedropper context, preview stop changes without creating undo/history entries during scrubbing, and commit the stop plus Recent history only through Apply or another explicit preset action.