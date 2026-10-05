import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BringToFront,
  Clipboard,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  Grid3X3,
  Group,
  ImageDown,
  Layers,
  Lock,
  Maximize2,
  Paintbrush,
  Palette,
  PanelTop,
  Redo2,
  RotateCcw,
  Scissors,
  SendToBack,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Unlock,
  Ungroup,
  X,
  ZoomIn,
} from 'lucide-react';

export interface ContextMenuActions {
  onPaste: () => void;
  onPasteInPlace: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onResetZoom: () => void;
  onFitCanvas: () => void;
  onToggleGrid: () => void;
  onToggleGuides: () => void;
  onToggleSnap: () => void;
  onToggleRulers: () => void;
  onBackground: () => void;
  onToggleTransparency: () => void;
  onCanvasDimensions: () => void;
  onImportAsset: () => void;
  onExportCanvas: () => void;
  onCut: () => void;
  onCopy: () => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCenterHorizontal: () => void;
  onCenterVertical: () => void;
  onCenterBoth: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
  onDistributeHorizontal: () => void;
  onDistributeVertical: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleLock: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onResetRotation: () => void;
  onResetScale: () => void;
  onQuickColor: () => void;
  onToggleShadow: () => void;
  onMask: () => void;
  onUnmask: () => void;
  onExportSelection: () => void;
  onSaveComponent: () => void;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  hasSelection: boolean;
  selectionCount: number;
  selectedIsGroup: boolean;
  canPaste: boolean;
  canPasteStyle: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  actions: ContextMenuActions;
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-cyan-400/10 disabled:pointer-events-none disabled:opacity-35"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-cyan-300/90">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[9px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-white/10 px-1.5 py-1.5 first:border-t-0">{children}</div>;
}

export default function ContextMenu({
  open,
  x,
  y,
  hasSelection,
  selectionCount,
  selectedIsGroup,
  canPaste,
  canPasteStyle,
  menuRef,
  onClose,
  actions,
}: ContextMenuProps) {
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const menu = menuRef.current;
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const margin = 8;
    const menuWidth = menu.getBoundingClientRect().width;
    const menuHeight = menu.getBoundingClientRect().height;
    const left = Math.max(margin, Math.min(x, viewportWidth - menuWidth - margin));
    const top = Math.max(margin, Math.min(y, viewportHeight - menuHeight - margin));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, [menuRef, open, x, y]);

  if (!open) return null;

  const run = (action: () => void) => {
    onClose();
    action();
  };

  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const width = Math.min(292, Math.max(0, viewportWidth - 16));
  const maxHeight = Math.max(0, viewportHeight - 80);
  const left = Math.max(8, Math.min(x, viewportWidth - width - 8));
  const top = Math.max(8, Math.min(y, viewportHeight - maxHeight - 8));

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={hasSelection ? 'Object context menu' : 'Canvas context menu'}
      className="fixed flex max-h-[calc(100vh-80px)] flex-col overflow-hidden rounded-xl border border-cyan-300/20 bg-[#11141A]/[.98] text-foreground shadow-2xl backdrop-blur-xl"
      style={{ left, top, width, maxHeight: 'calc(100dvh - 80px)', zIndex: 999999 }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#11141A] px-3 py-2">
        <div className="flex items-center gap-2">
          {hasSelection ? <Layers size={14} className="text-cyan-300" /> : <PanelTop size={14} className="text-cyan-300" />}
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
            {hasSelection
              ? `${selectionCount} ${selectionCount === 1 ? 'object' : 'objects'} selected`
              : 'Canvas actions'}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close context menu"
          title="Close"
          onPointerDown={(event) => {
            event.stopPropagation();
            onClose();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-cyan-400/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          data-testid="context-menu-close"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        data-testid="context-menu-list"
      >
        {!hasSelection ? (
          <>
          <Section>
            <MenuItem icon={<Clipboard size={14} />} label="Paste" onClick={() => run(actions.onPaste)} disabled={!canPaste} hint="⌘/Ctrl V" />
            <MenuItem icon={<Clipboard size={14} />} label="Paste in Place" onClick={() => run(actions.onPasteInPlace)} disabled={!canPaste} />
            <MenuItem icon={<Square size={14} />} label="Select All Objects" onClick={() => run(actions.onSelectAll)} hint="⌘/Ctrl A" />
            <MenuItem icon={<Redo2 size={14} />} label="Clear Selection" onClick={() => run(actions.onClearSelection)} />
          </Section>
          <Section>
            <MenuItem icon={<ZoomIn size={14} />} label="Reset Zoom to 100%" onClick={() => run(actions.onResetZoom)} />
            <MenuItem icon={<Maximize2 size={14} />} label="Fit Canvas to Viewport" onClick={() => run(actions.onFitCanvas)} />
            <MenuItem icon={<Grid3X3 size={14} />} label="Toggle Grid Overlay" onClick={() => run(actions.onToggleGrid)} />
            <MenuItem icon={<Settings2 size={14} />} label="Toggle Alignment Guides" onClick={() => run(actions.onToggleGuides)} />
            <MenuItem icon={<Settings2 size={14} />} label="Toggle Snapping" onClick={() => run(actions.onToggleSnap)} />
            <MenuItem icon={<PanelTop size={14} />} label="Toggle Rulers" onClick={() => run(actions.onToggleRulers)} />
          </Section>
          <Section>
            <MenuItem icon={<Palette size={14} />} label="Change Background" onClick={() => run(actions.onBackground)} />
            <MenuItem icon={<Square size={14} />} label="Toggle Transparency" onClick={() => run(actions.onToggleTransparency)} />
            <MenuItem icon={<Maximize2 size={14} />} label="Change Canvas Dimensions" onClick={() => run(actions.onCanvasDimensions)} />
            <MenuItem icon={<ImageDown size={14} />} label="Import Asset" onClick={() => run(actions.onImportAsset)} />
            <MenuItem icon={<ImageDown size={14} />} label="Export Full Canvas" onClick={() => run(actions.onExportCanvas)} />
          </Section>
          </>
        ) : (
          <>
          <Section>
            <MenuItem icon={<Scissors size={14} />} label="Cut" onClick={() => run(actions.onCut)} hint="⌘/Ctrl X" />
            <MenuItem icon={<Copy size={14} />} label="Copy" onClick={() => run(actions.onCopy)} hint="⌘/Ctrl C" />
            <MenuItem icon={<Paintbrush size={14} />} label="Copy Style" onClick={() => run(actions.onCopyStyle)} />
            <MenuItem icon={<Paintbrush size={14} />} label="Paste Style" onClick={() => run(actions.onPasteStyle)} disabled={!canPasteStyle} />
            <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={() => run(actions.onDuplicate)} hint="⌘/Ctrl D" />
            <MenuItem icon={<Trash2 size={14} />} label="Delete" onClick={() => run(actions.onDelete)} hint="Delete" />
          </Section>
          <Section>
            <MenuItem icon={<AlignCenterHorizontal size={14} />} label="Center on Canvas" onClick={() => run(actions.onCenterBoth)} />
            <MenuItem icon={<AlignCenterVertical size={14} />} label="Center Horizontally" onClick={() => run(actions.onCenterHorizontal)} />
            <MenuItem icon={<AlignCenterHorizontal size={14} />} label="Center Vertically" onClick={() => run(actions.onCenterVertical)} />
            <MenuItem icon={<AlignStartVertical size={14} />} label="Align Left" onClick={() => run(actions.onAlignLeft)} />
            <MenuItem icon={<AlignCenterVertical size={14} />} label="Align Center" onClick={() => run(actions.onAlignCenter)} />
            <MenuItem icon={<AlignEndVertical size={14} />} label="Align Right" onClick={() => run(actions.onAlignRight)} />
            <MenuItem icon={<AlignStartHorizontal size={14} />} label="Align Top" onClick={() => run(actions.onAlignTop)} />
            <MenuItem icon={<AlignCenterHorizontal size={14} />} label="Align Middle" onClick={() => run(actions.onAlignMiddle)} />
            <MenuItem icon={<AlignEndHorizontal size={14} />} label="Align Bottom" onClick={() => run(actions.onAlignBottom)} />
            <MenuItem icon={<AlignCenterHorizontal size={14} />} label="Distribute Horizontally" onClick={() => run(actions.onDistributeHorizontal)} disabled={selectionCount < 3} />
            <MenuItem icon={<AlignCenterVertical size={14} />} label="Distribute Vertically" onClick={() => run(actions.onDistributeVertical)} disabled={selectionCount < 3} />
          </Section>
          <Section>
            <MenuItem icon={<BringToFront size={14} />} label="Bring Forward" onClick={() => run(actions.onBringForward)} />
            <MenuItem icon={<SendToBack size={14} />} label="Send Backward" onClick={() => run(actions.onSendBackward)} />
            <MenuItem icon={<BringToFront size={14} />} label="Bring to Front" onClick={() => run(actions.onBringToFront)} />
            <MenuItem icon={<SendToBack size={14} />} label="Send to Back" onClick={() => run(actions.onSendToBack)} />
            <MenuItem icon={<Group size={14} />} label="Group Selection" onClick={() => run(actions.onGroup)} disabled={selectionCount < 2} />
            <MenuItem icon={<Ungroup size={14} />} label="Ungroup Selection" onClick={() => run(actions.onUngroup)} disabled={!selectedIsGroup} />
          </Section>
          <Section>
            <MenuItem icon={<Lock size={14} />} label="Lock / Unlock" onClick={() => run(actions.onToggleLock)} />
            <MenuItem icon={<FlipHorizontal2 size={14} />} label="Flip Horizontal" onClick={() => run(actions.onFlipHorizontal)} />
            <MenuItem icon={<FlipVertical2 size={14} />} label="Flip Vertical" onClick={() => run(actions.onFlipVertical)} />
            <MenuItem icon={<RotateCcw size={14} />} label="Reset Rotation" onClick={() => run(actions.onResetRotation)} />
            <MenuItem icon={<Maximize2 size={14} />} label="Reset Scale / Aspect Ratio" onClick={() => run(actions.onResetScale)} />
          </Section>
          <Section>
            <MenuItem icon={<Palette size={14} />} label="Quick Color Picker / Fill" onClick={() => run(actions.onQuickColor)} />
            <MenuItem icon={<Sparkles size={14} />} label="Toggle Inner Shadow" onClick={() => run(actions.onToggleShadow)} />
            <MenuItem icon={<Square size={14} />} label="Mask with Shape" onClick={() => run(actions.onMask)} disabled={selectionCount < 2} />
            <MenuItem icon={<Square size={14} />} label="Unmask" onClick={() => run(actions.onUnmask)} />
          </Section>
          <Section>
            <MenuItem icon={<ImageDown size={14} />} label="Export Selection As…" onClick={() => run(actions.onExportSelection)} />
            <MenuItem icon={<FolderOpen size={14} />} label="Save as Reusable Component" onClick={() => run(actions.onSaveComponent)} />
          </Section>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}