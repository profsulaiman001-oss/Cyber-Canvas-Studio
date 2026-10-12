---
name: Fabric text selection timing
description: Fabric IText selection events can expose stale selection endpoints.
---

Fabric 7's IText selection-change event fires before updating the selection index that changed. Read `selectionStart` and `selectionEnd` in a microtask after the canvas event to capture the completed range. Textarea offsets are UTF-16 code-unit positions, while Fabric formatting uses grapheme indexes; convert the textarea offsets to grapheme counts before calling character-style helpers.

**Why:** Reading selection endpoints synchronously can format only part of a drag-selected range or the previous range.

**How to apply:** Defer canvas selection reads until after Fabric finishes both endpoint updates, and keep textarea-to-Fabric index conversion consistent with Fabric's grapheme segmentation.
