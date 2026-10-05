import type { IText } from 'fabric';
import type {
  CanvasTextProperties,
  CharacterSpan,
  CharacterStyle,
  CharacterStylePatch,
} from '@/types/canvas';

type StyledTextObject = IText & CanvasTextProperties;

export function getCharacterCount(text: string): number {
  return Array.from(text).length;
}

export function getCharacterStyleAt(
  object: StyledTextObject,
  index: number,
): CharacterStyle {
  const style: CharacterStyle = {
    fill: typeof object.fill === 'string' ? object.fill : undefined,
    fontWeight: String(object.fontWeight || 'normal'),
    fontStyle: String(object.fontStyle || 'normal'),
    underline: !!object.underline,
  };

  for (const span of object.characterSpans || []) {
    if (index >= span.start && index <= span.end) {
      if (span.fill !== undefined) style.fill = span.fill;
      if (span.fontWeight !== undefined) style.fontWeight = span.fontWeight;
      if (span.fontStyle !== undefined) style.fontStyle = span.fontStyle;
      if (span.underline !== undefined) style.underline = span.underline;
    }
  }
  return style;
}

export function getCharacterRangeStyleState(
  object: StyledTextObject,
  start: number,
  end: number,
): CharacterStyle {
  const count = getCharacterCount(object.text || '');
  if (count === 0) return {};

  const rangeStart = Math.max(0, Math.min(count - 1, Math.floor(start)));
  const rangeEnd = Math.max(rangeStart, Math.min(count - 1, Math.floor(end)));
  const styles = Array.from(
    { length: rangeEnd - rangeStart + 1 },
    (_, offset) => getCharacterStyleAt(object, rangeStart + offset),
  );
  const first = styles[0] || {};

  return {
    fill: first.fill,
    fontWeight: styles.every((style) => style.fontWeight === 'bold') ? 'bold' : 'normal',
    fontStyle: styles.every((style) => style.fontStyle === 'italic') ? 'italic' : 'normal',
    underline: styles.every((style) => style.underline === true),
  };
}

function compressStyles(stylesByIndex: Map<number, CharacterStyle>): CharacterSpan[] {
  const entries = [...stylesByIndex.entries()].sort(([a], [b]) => a - b);
  const spans: CharacterSpan[] = [];
  let current: CharacterSpan | null = null;

  for (const [index, style] of entries) {
    const serializedStyle = (value: CharacterStyle) => JSON.stringify({
      fill: value.fill,
      fontWeight: value.fontWeight,
      fontStyle: value.fontStyle,
      underline: value.underline,
    });
    const sameStyle = current && serializedStyle(current) === serializedStyle(style);

    if (current && sameStyle && index === current.end + 1) {
      current.end = index;
      continue;
    }

    current = { start: index, end: index, ...style };
    spans.push(current);
  }

  return spans;
}

export function applyCharacterRangeStyle(
  object: StyledTextObject,
  start: number,
  end: number,
  patch: CharacterStylePatch,
): CharacterSpan[] {
  const count = getCharacterCount(object.text || '');
  if (count === 0) return object.characterSpans || [];

  const rangeStart = Math.max(0, Math.min(count - 1, Math.floor(start)));
  const rangeEnd = Math.max(0, Math.min(count - 1, Math.floor(end)));
  if (rangeStart > rangeEnd) return object.characterSpans || [];

  const stylesByIndex = new Map<number, CharacterStyle>();
  for (const span of object.characterSpans || []) {
    const boundedStart = Math.max(0, span.start);
    const boundedEnd = Math.min(count - 1, span.end);
    for (let index = boundedStart; index <= boundedEnd; index += 1) {
      const existing = stylesByIndex.get(index) || {};
      const merged = { ...existing };
      if (span.fill !== undefined) merged.fill = span.fill;
      if (span.fontWeight !== undefined) merged.fontWeight = span.fontWeight;
      if (span.fontStyle !== undefined) merged.fontStyle = span.fontStyle;
      if (span.underline !== undefined) merged.underline = span.underline;
      stylesByIndex.set(index, merged);
    }
  }

  for (let index = rangeStart; index <= rangeEnd; index += 1) {
    const nextStyle = { ...(stylesByIndex.get(index) || {}), ...patch };
    stylesByIndex.set(index, nextStyle);
  }

  const spans = compressStyles(stylesByIndex);
  object.setSelectionStyles(patch, rangeStart, rangeEnd + 1);
  object.set('characterSpans', spans);
  object.initDimensions();
  object.setCoords();
  object.dirty = true;
  return spans;
}
