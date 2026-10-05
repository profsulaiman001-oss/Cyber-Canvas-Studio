import { FabricText } from 'fabric';
import type { CanvasTextProperties } from '@/types/canvas';

type WordSpacedText = FabricText & CanvasTextProperties;
type PatchedFabricTextPrototype = typeof FabricText.prototype & {
  __spiexelWordSpacingPatched?: boolean;
};

const prototype = FabricText.prototype as PatchedFabricTextPrototype;

if (!prototype.__spiexelWordSpacingPatched) {
  const originalGetGraphemeBox = FabricText.prototype._getGraphemeBox;
  FabricText.prototype._getGraphemeBox = function (
    grapheme,
    lineIndex,
    charIndex,
    previousGrapheme,
    skipLeft,
  ) {
    const box = originalGetGraphemeBox.call(
      this,
      grapheme,
      lineIndex,
      charIndex,
      previousGrapheme,
      skipLeft,
    );
    const spacing = Number((this as WordSpacedText).wordSpacing || 0);
    if (grapheme === ' ' && Number.isFinite(spacing) && spacing !== 0) {
      box.width += spacing;
      box.kernedWidth += spacing;
    }
    return box;
  };

  Object.defineProperty(prototype, '__spiexelWordSpacingPatched', {
    value: true,
    configurable: true,
  });
}
