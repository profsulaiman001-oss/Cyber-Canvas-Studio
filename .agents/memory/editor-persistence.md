---
name: Editor persistence
description: Durable requirements for offline project restore and Fabric history
---

Canvas projects and undo snapshots must use restorable image sources rather than revoked object URLs, and history entries must represent the state immediately before a mutation.

**Why:** Fabric object events run after mutations, so recording the current state makes the first undo a no-op; blob URLs also disappear after they are revoked and cannot be decoded during a later restore.

**How to apply:** Keep imported images and pattern sources backed by data URLs, include custom effect properties in Fabric serialization, and update the committed-history baseline after every load/undo/redo.