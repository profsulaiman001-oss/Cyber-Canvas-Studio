export interface CharacterStyle {
  fill?: string;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
}

/**
 * Character indexes are zero-based grapheme positions; both endpoints are inclusive.
 */
export interface CharacterSpan extends CharacterStyle {
  start: number;
  end: number;
}

export interface CanvasTextProperties {
  characterSpans?: CharacterSpan[];
  /** Additional design-space pixels between word separators. */
  wordSpacing?: number;
  typographyNeon?: boolean;
  typographyTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  typographyOriginalText?: string;
}

export type CharacterStylePatch = Partial<CharacterStyle>;
