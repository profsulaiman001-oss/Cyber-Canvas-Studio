import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import {
  applyColorAdjustmentTree,
  DEFAULT_COLOR_ADJUSTMENTS,
  readColorAdjustments,
  type ColorAdjustments,
} from '@/lib/colorAdjustments';
import {
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AdjustStudioModal, {
  ADJUSTMENT_CONTROLS,
  formatAdjustmentValue,
  type AdjustmentKey,
} from './AdjustStudioModal';

interface AdjustPanelProps {
  controller: CanvasController;
}

export default function AdjustPanel({ controller }: AdjustPanelProps) {
  const { state } = useEditor();
  const isOpen = state.activePanel === 'adjust';
  const selectedObject = controller.selectedObject;
  const [expanded, setExpanded] = useState(false);
  const [activeKey, setActiveKey] = useState<AdjustmentKey>('brightness');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [adjustments, setAdjustments] = useState<ColorAdjustments>(DEFAULT_COLOR_ADJUSTMENTS);

  const getSelectedRoots = () => {
    const activeObjects = controller.getCanvas()?.getActiveObjects() ?? [];
    if (activeObjects.length) return activeObjects;
    return selectedObject ? [selectedObject] : [];
  };

  const selectedRoots = getSelectedRoots();
  const hasSelection = selectedRoots.length > 0;
  const activeAdjustment = ADJUSTMENT_CONTROLS.find(({ key }) => key === activeKey) ?? ADJUSTMENT_CONTROLS[0];
  const ActiveIcon = activeAdjustment.icon;
  const activeValue = adjustments[activeAdjustment.key];

  useEffect(() => {
    setAdjustments(readColorAdjustments(getSelectedRoots()[0] ?? null));
  // Selection identity and ids are the state that changes when canvas selection changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObject, state.selectedObjectIds]);

  useEffect(() => {
    if (!isOpen) {
      setExpanded(false);
      setSelectorOpen(false);
    }
  }, [isOpen]);

  const applyAdjustments = (next: ColorAdjustments) => {
    const canvas = controller.getCanvas();
    const roots = getSelectedRoots();
    if (!canvas || roots.length === 0) return;

    roots.forEach((root) => applyColorAdjustmentTree(root, next));
    canvas.requestRenderAll();
  };

  const update = (key: AdjustmentKey, value: number) => {
    const next = { ...adjustments, [key]: value };
    setAdjustments(next);
    applyAdjustments(next);
  };

  const resetAll = () => {
    const reset = { ...DEFAULT_COLOR_ADJUSTMENTS };
    setAdjustments(reset);
    applyAdjustments(reset);
    controller.commitChange();
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(720px,calc(100vw-20px))] -translate-x-1/2"
      data-testid="adjust-panel"
    >
      <AdjustStudioModal
        expanded={expanded}
        hasSelection={hasSelection}
        adjustments={adjustments}
        onChange={update}
        onCommit={() => controller.commitChange()}
        onResetAll={resetAll}
      />

      <div
        className="flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2.5"
        style={{
          background: '#11141A',
          borderColor: 'rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
        data-testid="adjustment-mini-bar"
      >
        <DropdownMenu open={selectorOpen} onOpenChange={setSelectorOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Adjustment parameter: ${activeAdjustment.label}`}
              title={activeAdjustment.label}
              data-testid="adjustment-selector-toggle"
            >
              <ActiveIcon size={14} aria-hidden="true" />
              <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-56 border-cyan-400/20 bg-[#11141A] text-foreground"
            data-testid="adjustment-selector"
          >
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">
              Adjust Parameter
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {ADJUSTMENT_CONTROLS.map(({ key, label, icon: Icon }) => {
              const isActive = key === activeKey;
              return (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => setActiveKey(key)}
                  className={`gap-2 text-xs focus:bg-primary/10 focus:text-foreground ${isActive ? 'text-primary' : 'text-foreground'}`}
                  data-testid={`adjustment-option-${key}`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon size={14} className="shrink-0 text-primary" aria-hidden="true" />
                  <span>{label}</span>
                  <span className="ml-auto flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_7px_rgba(0,245,255,0.95)]" />}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-0 w-full flex-1">
          <Slider
            min={activeAdjustment.min}
            max={activeAdjustment.max}
            step={activeAdjustment.step}
            value={[activeValue]}
            onValueChange={([value]) => update(activeAdjustment.key, value)}
            onValueCommit={() => controller.commitChange()}
            disabled={!hasSelection}
            aria-label={`${activeAdjustment.label} value`}
            className="w-full"
            data-testid={`adjustment-slider-${activeAdjustment.key}`}
          />
        </div>
        <span
          className="min-w-[52px] shrink-0 text-right font-mono text-[10px] tabular-nums text-primary"
          data-testid="adjustment-active-value"
        >
          {formatAdjustmentValue(activeAdjustment.key, activeValue)}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
          aria-label={expanded ? 'Collapse adjustments studio' : 'Expand adjustments studio'}
          aria-expanded={expanded}
          data-testid="adjust-studio-toggle"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
      {!hasSelection && (
        <p className="mt-1 text-center text-[10px] text-muted-foreground">Select a canvas object to adjust its colors</p>
      )}
    </div>
  );
}