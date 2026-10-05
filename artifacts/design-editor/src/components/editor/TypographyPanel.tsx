import { useCallback, useEffect, useRef, useState } from 'react';
import { IText } from 'fabric';
import type { CanvasController } from '@/hooks/useFabricCanvas';
import { useEditor } from '@/store/editorStore';
import type { CanvasTextProperties } from '@/types/canvas';
import { usePanelOutsideDismissal } from './usePanelOutsideDismissal';
import TypographyQuickStrip from './TypographyQuickStrip';
import type {
  TypographyAlignment,
  TypographyTransform,
} from './TypographyStudio';

interface TypographyPanelProps {
  controller: CanvasController;
}

interface GlowConfig {
  enabled?: boolean;
  color?: string;
  intensity?: number;
}

const DEFAULT_VALUES = {
  fontSize: 40,
  letterSpacing: 0,
  lineHeight: 1.16,
  wordSpacing: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function isTextObject(object: { type?: string } | null): object is IText & CanvasTextProperties {
  return object?.type === 'i-text' || object?.type === 'text' || object?.type === 'textbox';
}

function getAlignment(value: string | undefined): TypographyAlignment {
  return value === 'center' || value === 'right' || value === 'justify' ? value : 'left';
}

function transformText(text: string, transform: TypographyTransform): string {
  if (transform === 'uppercase') return text.toLocaleUpperCase();
  if (transform === 'lowercase') return text.toLocaleLowerCase();
  if (transform === 'capitalize') {
    return text
      .toLocaleLowerCase()
      .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_match, separator: string, letter: string) => (
        `${separator}${letter.toLocaleUpperCase()}`
      ));
  }
  return text;
}

export default function TypographyPanel({ controller }: TypographyPanelProps) {
  const { state, dispatch } = useEditor();
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedObject = controller.selectedObject;
  const textObj = isTextObject(selectedObject) ? selectedObject : null;
  const [fontSize, setFontSize] = useState(DEFAULT_VALUES.fontSize);
  const [letterSpacing, setLetterSpacing] = useState(DEFAULT_VALUES.letterSpacing);
  const [lineHeight, setLineHeight] = useState(DEFAULT_VALUES.lineHeight);
  const [wordSpacing, setWordSpacing] = useState(DEFAULT_VALUES.wordSpacing);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [alignment, setAlignment] = useState<TypographyAlignment>('left');
  const [textTransform, setTextTransform] = useState<TypographyTransform>('none');
  const [glowEnabled, setGlowEnabled] = useState(false);
  const [neonEnabled, setNeonEnabled] = useState(false);

  useEffect(() => {
    if (!textObj) {
      setFontSize(DEFAULT_VALUES.fontSize);
      setLetterSpacing(DEFAULT_VALUES.letterSpacing);
      setLineHeight(DEFAULT_VALUES.lineHeight);
      setWordSpacing(DEFAULT_VALUES.wordSpacing);
      setFontFamily('Inter');
      setAlignment('left');
      setTextTransform('none');
      setGlowEnabled(false);
      setNeonEnabled(false);
      return;
    }

    const size = Number(textObj.fontSize) || DEFAULT_VALUES.fontSize;
    const glow = (textObj as IText & { _glow?: GlowConfig })._glow;
    setFontSize(size);
    setLetterSpacing(((Number(textObj.charSpacing) || 0) * size) / 1000);
    setLineHeight(Number(textObj.lineHeight) || DEFAULT_VALUES.lineHeight);
    setWordSpacing(Number(textObj.wordSpacing) || 0);
    setFontFamily(String(textObj.fontFamily || 'Inter'));
    setAlignment(getAlignment(String(textObj.textAlign || 'left')));
    setTextTransform(textObj.typographyTransform || 'none');
    setGlowEnabled(!!glow?.enabled);
    setNeonEnabled(!!textObj.typographyNeon);
  }, [textObj, state.activePanel]);

  usePanelOutsideDismissal({
    active: state.activePanel === 'typography',
    panelRef,
    triggerSelector: '[data-testid="toolbar-typography"]',
  });

  const applyTextProps = useCallback((props: Record<string, unknown>) => {
    if (!textObj) return;
    textObj.set(props);
    textObj.initDimensions();
    textObj.setCoords();
    textObj.dirty = true;
    controller.getCanvas()?.renderAll();
    controller.commitChange();
  }, [controller, textObj]);

  const handleFontSizeChange = (value: number) => {
    const next = clamp(value, 8, 300);
    setFontSize(next);
    applyTextProps({
      fontSize: next,
      charSpacing: (letterSpacing * 1000) / next,
    });
  };

  const handleLetterSpacingChange = (value: number) => {
    const next = clamp(value, -50, 200);
    setLetterSpacing(next);
    applyTextProps({
      charSpacing: (next * 1000) / Math.max(1, fontSize),
    });
  };

  const handleLineHeightChange = (value: number) => {
    const next = clamp(value, 0.5, 4);
    setLineHeight(next);
    applyTextProps({ lineHeight: next });
  };

  const handleWordSpacingChange = (value: number) => {
    const next = clamp(value, -50, 200);
    setWordSpacing(next);
    applyTextProps({ wordSpacing: next });
  };

  const handleFontFamilyChange = (font: string) => {
    setFontFamily(font);
    applyTextProps({ fontFamily: font });
    dispatch({
      type: 'SET_RECENT_FONTS',
      payload: [font, ...state.recentFonts.filter((recent) => recent !== font)].slice(0, 6),
    });
  };

  const handleAlignmentChange = (next: TypographyAlignment) => {
    setAlignment(next);
    applyTextProps({ textAlign: next });
  };

  const handleTextTransformChange = (next: TypographyTransform) => {
    if (!textObj) return;
    const originalText = textObj.typographyOriginalText ?? textObj.text ?? '';
    const properties: Record<string, unknown> = {
      text: transformText(originalText, next),
      typographyTransform: next,
      typographyOriginalText: next === 'none' ? undefined : originalText,
    };
    setTextTransform(next);
    applyTextProps(properties);
  };

  const applyGlow = (enabled: boolean, config?: GlowConfig) => {
    if (!textObj) return;
    controller.applyGlow(
      textObj,
      enabled
        ? {
            enabled: true,
            color: config?.color || '#00F5FF',
            intensity: config?.intensity || 20,
          }
        : null,
    );
    controller.getCanvas()?.renderAll();
    controller.commitChange();
  };

  const handleGlowChange = (enabled: boolean) => {
    setGlowEnabled(enabled);
    if (!enabled) {
      setNeonEnabled(false);
      textObj?.set({ typographyNeon: false });
      applyGlow(false);
      return;
    }
    const currentGlow = (textObj as (IText & { _glow?: GlowConfig }) | null)?._glow;
    applyGlow(true, currentGlow);
  };

  const handleNeonChange = (enabled: boolean) => {
    if (!textObj) return;
    setNeonEnabled(enabled);
    setGlowEnabled(enabled);
    textObj.set({ typographyNeon: enabled });
    applyGlow(enabled, { color: '#00F5FF', intensity: 60 });
  };

  if (state.activePanel !== 'typography') return null;

  return (
    <div ref={panelRef}>
      <TypographyQuickStrip
        hasTextSelection={!!textObj}
        fontSize={fontSize}
        letterSpacing={letterSpacing}
        lineHeight={lineHeight}
        wordSpacing={wordSpacing}
        fontFamily={fontFamily}
        alignment={alignment}
        textTransform={textTransform}
        glowEnabled={glowEnabled}
        neonEnabled={neonEnabled}
        onFontSizeChange={handleFontSizeChange}
        onLetterSpacingChange={handleLetterSpacingChange}
        onLineHeightChange={handleLineHeightChange}
        onWordSpacingChange={handleWordSpacingChange}
        onFontFamilyChange={handleFontFamilyChange}
        onAlignmentChange={handleAlignmentChange}
        onTextTransformChange={handleTextTransformChange}
        onGlowChange={handleGlowChange}
        onNeonChange={handleNeonChange}
      />
    </div>
  );
}
