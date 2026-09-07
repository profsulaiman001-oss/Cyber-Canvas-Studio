import { useCallback, useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useEditor } from '@/store/editorStore';
import type { CanvasController } from '@/hooks/useFabricCanvas';
import type { FabricObject } from 'fabric';
import {
  ChevronDown,
  ChevronUp,
  FlipHorizontal2,
  FlipVertical2,
  Lock,
  Maximize2,
  RotateCcw,
  RotateCw,
  Unlock,
} from 'lucide-react';

interface TransformPanelProps {
  controller: CanvasController;
}

type TransformProperty = 'scale' | 'rotation';

const MIN_SCALE_PERCENT = 10;
const MAX_SCALE_PERCENT = 500;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function readDimension(obj: FabricObject, axis: 'width' | 'height') {
  const value = axis === 'width' ? obj.getScaledWidth() : obj.getScaledHeight();
  return Math.max(1, Math.round(value));
}

function readScalePercent(obj: FabricObject) {
  const scaleX = Math.abs(obj.scaleX ?? 1);
  const scaleY = Math.abs(obj.scaleY ?? 1);
  return clamp(Math.round(((scaleX + scaleY) / 2) * 100), MIN_SCALE_PERCENT, MAX_SCALE_PERCENT);
}

function readAngle(obj: FabricObject) {
  return Math.round(normalizeAngle(obj.angle ?? 0));
}

function NumericInput({
  label,
  value,
  unit,
  onChange,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-2.5 transition-colors focus-within:border-primary/60 focus-within:bg-primary/[0.06]">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm font-mono tabular-nums text-foreground outline-none"
          aria-label={`${label} in pixels or degrees`}
        />
        <span className="text-[10px] font-semibold text-primary">{unit}</span>
      </span>
    </label>
  );
}

export default function TransformPanel({ controller }: TransformPanelProps) {
  const { state } = useEditor();
  const obj = controller.selectedObject;
  const isOpen = state.activePanel === 'transform';
  const [activeProperty, setActiveProperty] = useState<TransformProperty>('scale');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aspectLocked, setAspectLocked] = useState(true);
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [rotationInput, setRotationInput] = useState('');
  const [scalePercent, setScalePercent] = useState(100);
  const [rotation, setRotation] = useState(0);

  const syncFromObject = useCallback(() => {
    if (!obj) {
      setWidthInput('');
      setHeightInput('');
      setRotationInput('');
      setScalePercent(100);
      setRotation(0);
      return;
    }
    setWidthInput(String(readDimension(obj, 'width')));
    setHeightInput(String(readDimension(obj, 'height')));
    setRotationInput(String(readAngle(obj)));
    setScalePercent(readScalePercent(obj));
    setRotation(readAngle(obj));
  }, [obj]);

  useEffect(() => {
    syncFromObject();
    setSelectorOpen(false);
    setExpanded(false);
  }, [syncFromObject]);

  useEffect(() => {
    syncFromObject();
  }, [syncFromObject, controller.dragInfo?.w, controller.dragInfo?.h, controller.dragInfo?.angle]);

  const showHud = useCallback(() => {
    if (obj) controller.showTransformHud(obj);
  }, [controller, obj]);

  const hideHud = useCallback(() => {
    controller.hideTransformHud();
  }, [controller]);

  const applyObjectTransform = useCallback((changes: Partial<{
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
    angle: number;
    flipX: boolean;
    flipY: boolean;
  }>, keepHud = true) => {
    if (!obj) return;
    obj.set(changes);
    obj.setCoords();
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
    syncFromObject();
    if (keepHud) controller.showTransformHud(obj);
  }, [controller, obj, syncFromObject]);

  const applyScale = (value: number) => {
    const next = clamp(Math.round(value), MIN_SCALE_PERCENT, MAX_SCALE_PERCENT);
    setScalePercent(next);
    applyObjectTransform({ scaleX: next / 100, scaleY: next / 100 });
  };

  const applyRotation = (value: number) => {
    const next = clamp(Number.isFinite(value) ? value : 0, 0, 360);
    setRotation(next);
    setRotationInput(String(Math.round(next)));
    applyObjectTransform({ angle: next });
  };

  const applyDimension = (axis: 'width' | 'height', rawValue: string) => {
    if (!obj) return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const currentWidth = Math.max(0.001, obj.getScaledWidth());
    const currentHeight = Math.max(0.001, obj.getScaledHeight());
    const nextWidth = axis === 'width' ? parsed : (aspectLocked ? parsed * (currentWidth / currentHeight) : currentWidth);
    const nextHeight = axis === 'height' ? parsed : (aspectLocked ? parsed * (currentHeight / currentWidth) : currentHeight);
    const baseWidth = Math.max(0.001, Math.abs(obj.width || 1));
    const baseHeight = Math.max(0.001, Math.abs(obj.height || 1));

    if (axis === 'width') setWidthInput(rawValue);
    else setHeightInput(rawValue);
    if (aspectLocked) {
      if (axis === 'width') setHeightInput(String(Math.round(nextHeight)));
      else setWidthInput(String(Math.round(nextWidth)));
    }
    setScalePercent(clamp(Math.round(((nextWidth / baseWidth + nextHeight / baseHeight) / 2) * 100), MIN_SCALE_PERCENT, MAX_SCALE_PERCENT));
    applyObjectTransform({
      scaleX: nextWidth / baseWidth,
      scaleY: nextHeight / baseHeight,
    });
  };

  const resetTransform = () => {
    applyObjectTransform({
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      angle: 0,
      flipX: false,
      flipY: false,
    });
    setScalePercent(100);
    setRotation(0);
    setRotationInput('0');
  };

  const runPreset = (action: () => void) => {
    showHud();
    action();
    window.setTimeout(hideHud, 450);
  };

  if (!isOpen || !obj) return null;

  const isScale = activeProperty === 'scale';
  const activeLabel = isScale ? 'Scale / Size' : 'Rotation Angle';

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(680px,calc(100vw-24px))] -translate-x-1/2"
      data-testid="transform-panel"
    >
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ease-in-out ${
          expanded ? 'mb-2 max-h-[620px] opacity-100' : 'pointer-events-none max-h-0 opacity-0'
        }`}
        style={{
          background: '#11141A',
          border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
          boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
        }}
      >
        <div className="space-y-3 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Maximize2 size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Transform</span>
            </div>
            <button
              type="button"
              onClick={resetTransform}
              onPointerDown={showHud}
              onPointerUp={hideHud}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-primary transition-colors hover:bg-primary/10"
              data-testid="button-reset-transform"
            >
              <RotateCcw size={11} />
              Reset Transform
            </button>
          </div>

          <div className="flex items-end gap-2">
            <NumericInput
              label="Width"
              value={widthInput}
              unit="px"
              onChange={(value) => applyDimension('width', value)}
              onFocus={showHud}
              onBlur={hideHud}
            />
            <button
              type="button"
              onClick={() => setAspectLocked((locked) => !locked)}
              className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-primary/10"
              style={{
                color: aspectLocked ? '#00F5FF' : 'rgba(255,255,255,0.5)',
                borderColor: aspectLocked ? 'rgba(0,245,255,0.5)' : 'rgba(255,255,255,0.12)',
                background: aspectLocked ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.04)',
              }}
              aria-label={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              aria-pressed={aspectLocked}
              data-testid="button-toggle-aspect-lock"
            >
              {aspectLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
            <NumericInput
              label="Height"
              value={heightInput}
              unit="px"
              onChange={(value) => applyDimension('height', value)}
              onFocus={showHud}
              onBlur={hideHud}
            />
          </div>

          <div className="space-y-2">
            <NumericInput
              label="Rotation"
              value={rotationInput}
              unit="deg"
              onChange={(value) => {
                setRotationInput(value);
                const parsed = Number(value);
                if (Number.isFinite(parsed)) applyRotation(parsed);
              }}
              onFocus={showHud}
              onBlur={hideHud}
            />
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => runPreset(() => applyRotation(rotation - 90))}
                className="flex h-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                title="Rotate 90° counter-clockwise"
              >
                <RotateCcw size={12} />
                90° CCW
              </button>
              <button
                type="button"
                onClick={() => runPreset(() => applyRotation(rotation + 90))}
                className="flex h-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                title="Rotate 90° clockwise"
              >
                <RotateCw size={12} />
                90° CW
              </button>
              <button
                type="button"
                onClick={() => runPreset(() => applyObjectTransform({ flipX: !obj.flipX }))}
                className="flex h-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                title="Flip horizontal"
              >
                <FlipHorizontal2 size={14} />
                Flip H
              </button>
              <button
                type="button"
                onClick={() => runPreset(() => applyObjectTransform({ flipY: !obj.flipY }))}
                className="flex h-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                title="Flip vertical"
              >
                <FlipVertical2 size={14} />
                Flip V
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-[10px] text-muted-foreground">
              {aspectLocked ? 'Width and height stay proportional' : 'Width and height edit independently'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Lock ratio</span>
              <Switch checked={aspectLocked} onCheckedChange={setAspectLocked} aria-label="Lock aspect ratio" />
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 rounded-2xl px-3 py-2.5"
        style={{
          background: '#11141A',
          border: '1px solid rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
        data-testid="transform-mini-bar"
      >
        <div className="relative min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => setSelectorOpen((open) => !open)}
            className="flex max-w-[150px] items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-white/10"
            style={{ color: '#00F5FF', background: selectorOpen ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.05)' }}
            aria-expanded={selectorOpen}
            aria-haspopup="listbox"
            aria-controls="transform-property-selector"
            data-testid="button-toggle-transform-selector"
          >
            <Maximize2 size={13} />
            <span className="truncate">{activeLabel}</span>
            <ChevronDown size={13} className={`shrink-0 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
          </button>
          {selectorOpen && (
            <div
              id="transform-property-selector"
              role="listbox"
              className="absolute bottom-full left-0 z-10 mb-2 w-48 rounded-xl border border-white/10 p-1.5 shadow-2xl"
              style={{ background: '#11141A' }}
            >
              {([
                ['scale', 'Scale / Size'],
                ['rotation', 'Rotation Angle'],
              ] as [TransformProperty, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={activeProperty === value}
                  onClick={() => {
                    setActiveProperty(value);
                    setSelectorOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/10"
                  style={{
                    color: activeProperty === value ? '#00F5FF' : 'rgba(255,255,255,0.7)',
                    background: activeProperty === value ? 'rgba(0,245,255,0.1)' : 'transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Slider
            min={isScale ? MIN_SCALE_PERCENT : 0}
            max={isScale ? MAX_SCALE_PERCENT : 360}
            step={1}
            value={[isScale ? scalePercent : rotation]}
            onPointerDown={showHud}
            onPointerUp={hideHud}
            onPointerCancel={hideHud}
            onValueChange={([value]) => (isScale ? applyScale(value) : applyRotation(value))}
            className="min-w-0 flex-1"
            aria-label={activeLabel}
          />
          <span className="w-16 shrink-0 text-right text-[10px] font-mono tabular-nums text-primary">
            {isScale ? `${readDimension(obj, 'width')}px` : `${Math.round(rotation)}°`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          style={{ color: '#00F5FF', background: expanded ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.05)' }}
          aria-label={expanded ? 'Collapse transform controls' : 'Expand transform controls'}
          data-testid="button-toggle-transform-expanded"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </div>
  );
}