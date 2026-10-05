---
name: Fabric word spacing
description: Custom word spacing must update Fabric text measurement and cached rendering for every text class.
---

Patch `FabricText.prototype._getGraphemeBox`, not only `IText`, so `FabricText`, `IText`, and `Textbox` share the spacing behavior. After changing the custom spacing value, call `initDimensions()` and mark the object dirty so its cached render is refreshed.

**Why:** Fabric's `wordSpacing` extension is not a native cache-tracked property, and editable text is only one of the text classes used by the editor.

**How to apply:** Keep grapheme measurement, dimension recalculation, and cache invalidation together whenever the custom word-spacing behavior changes.
