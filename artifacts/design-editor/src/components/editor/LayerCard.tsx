import { useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefCallback } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  Layers2,
  Lock,
  MoreHorizontal,
  Pencil,
  Target,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LayerTag, ObjectMeta } from '@/hooks/useFabricCanvas';

const TAG_COLORS: Record<LayerTag, string> = {
  red: '#FF4D6D',
  cyan: '#00F5FF',
  yellow: '#FFD166',
  green: '#34D399',
  purple: '#A78BFA',
};

const TAG_LABELS: Record<LayerTag, string> = {
  red: 'Red',
  cyan: 'Cyan',
  yellow: 'Yellow',
  green: 'Green',
  purple: 'Purple',
};

export type LayerZOrderAction = 'front' | 'back' | 'forward' | 'backward';

export interface LayerCardProps {
  obj: ObjectMeta;
  depth: number;
  selected: boolean;
  selectedCount: number;
  solo: boolean;
  collapsed: boolean;
  dropTarget: boolean;
  dragging: boolean;
  editing: boolean;
  editingValue: string;
  cardRef: RefCallback<HTMLDivElement>;
  onSelect: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragCancel: () => void;
  onSelectChecked: (checked: boolean) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onToggleSolo: () => void;
  onToggleCollapse: () => void;
  onTagChange: (tag?: LayerTag) => void;
  onZOrder: (action: LayerZOrderAction) => void;
  onStartRename: () => void;
  onEditingValueChange: (value: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onTargetSelect: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onDelete: () => void;
}

function LayerThumb({
  type,
  fill,
  stroke,
  opacity,
  imgSrc,
  thumbnailSrc,
}: {
  type: string;
  fill?: string;
  stroke?: string;
  opacity?: number;
  imgSrc?: string;
  thumbnailSrc?: string;
}) {
  const thumbColor = fill || stroke || '#9CA3AF';
  const surface = {
    background: '#0D1117',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  if (thumbnailSrc || imgSrc) {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{
          ...surface,
          background: 'repeating-conic-gradient(#151922 0% 25%, #10131a 0% 50%) 50% / 8px 8px',
        }}
      >
        <img
          src={thumbnailSrc || imgSrc}
          alt=""
          draggable={false}
          className="h-full w-full object-contain p-1"
          style={{ opacity: thumbnailSrc ? 1 : opacity ?? 1 }}
        />
      </div>
    );
  }

  if (type === 'group') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cyan-300" style={surface}>
        <Folder size={20} />
      </div>
    );
  }

  if (type === 'circle') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={surface}>
        <div className="h-6 w-6 rounded-full" style={{ background: thumbColor, opacity: opacity ?? 1 }} />
      </div>
    );
  }

  if (type === 'triangle') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={surface}>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '11px solid transparent',
            borderRight: '11px solid transparent',
            borderBottom: `24px solid ${thumbColor}`,
            opacity: opacity ?? 1,
          }}
        />
      </div>
    );
  }

  if (type === 'i-text' || type === 'text' || type === 'textbox') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={surface}>
        <span style={{ color: thumbColor, fontSize: 22, fontWeight: 700, lineHeight: 1, opacity: opacity ?? 1 }}>T</span>
      </div>
    );
  }

  if (type === 'line' || type === 'path') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={surface}>
        <div className="h-1 w-7 rounded-full" style={{ background: thumbColor, opacity: opacity ?? 1 }} />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-1.5" style={surface}>
      <div className="h-full w-full rounded-md" style={{ background: thumbColor, opacity: opacity ?? 1 }} />
    </div>
  );
}

function ColorTagSelector({
  name,
  value,
  onChange,
}: {
  name: string;
  value?: LayerTag;
  onChange: (tag?: LayerTag) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <button
        type="button"
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-2 text-[10px] text-slate-300 transition-colors hover:bg-white/[0.08]"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Color tag for ${name}`}
        aria-expanded={open}
        title="Color tag"
      >
        <span className="h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: value ? TAG_COLORS[value] : 'transparent' }} />
        Tag
      </button>
      {open && (
        <div className="flex items-center gap-0.5" aria-label="Choose layer color tag">
          {(Object.keys(TAG_COLORS) as LayerTag[]).map((tag) => (
            <button
              key={tag}
              type="button"
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/10 ${value === tag ? 'bg-white/10' : ''}`}
              onClick={() => {
                onChange(tag);
                setOpen(false);
              }}
              aria-label={`Set ${TAG_LABELS[tag]} tag`}
              title={TAG_LABELS[tag]}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: TAG_COLORS[tag] }} />
            </button>
          ))}
          {value && (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              aria-label="Clear color tag"
              title="Clear tag"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ShelfButton({
  label,
  onClick,
  children,
  disabled = false,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.025] px-1 py-1.5 text-[9px] leading-tight transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/[0.07] disabled:cursor-not-allowed disabled:opacity-35 ${
        destructive ? 'text-rose-300 hover:border-rose-300/20 hover:bg-rose-300/[0.07]' : 'text-slate-300 hover:text-cyan-100'
      }`}
    >
      {children}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

export default function LayerCard({
  obj,
  depth,
  selected,
  selectedCount,
  solo,
  collapsed,
  dropTarget,
  dragging,
  editing,
  editingValue,
  cardRef,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onSelectChecked,
  onToggleVisibility,
  onToggleLock,
  onToggleSolo,
  onToggleCollapse,
  onTagChange,
  onZOrder,
  onStartRename,
  onEditingValueChange,
  onFinishRename,
  onCancelRename,
  onTargetSelect,
  onDuplicate,
  onGroup,
  onDelete,
}: LayerCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const isGroup = obj.type === 'group';
  const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
  const typeLabel = isGroup ? 'GROUP' : isText ? 'TEXT' : obj.type.toUpperCase();

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className="relative mb-2 rounded-xl p-2 transition-[background-color,border-color,box-shadow,opacity] duration-200"
      style={{
        marginLeft: Math.min(depth, 4) * 16,
        background: selected ? 'rgba(0,242,254,0.055)' : '#161b22',
        border: selected ? '1.5px solid #00f2fe' : '1px solid #21262d',
        boxShadow: dropTarget && dragging
          ? '0 0 0 1px rgba(0,242,254,0.55), inset 0 2px 0 rgba(0,242,254,0.75)'
          : selected
            ? '0 0 12px rgba(0,242,254,0.18)'
            : '0 2px 8px rgba(0,0,0,0.14)',
        opacity: dragging ? 0.68 : obj.visible ? 1 : 0.56,
      }}
      data-testid={`layer-item-${obj.id}`}
    >
      {isGroup && (
        <button
          type="button"
          className="absolute -left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg border border-[#21262d] bg-[#161b22] text-slate-400 transition-colors hover:text-cyan-200"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse();
          }}
          aria-label={collapsed ? `Expand ${obj.name}` : `Collapse ${obj.name}`}
          title={collapsed ? 'Expand group' : 'Collapse group'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-cyan-200 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          title={`Drag ${obj.name} to reorder or organize`}
          aria-label={`Drag ${obj.name} to reorder or organize`}
        >
          <GripVertical size={17} />
        </div>

        <LayerThumb
          type={obj.type}
          fill={obj.fill}
          stroke={obj.stroke}
          opacity={obj.opacity}
          imgSrc={obj.imgSrc}
          thumbnailSrc={obj.thumbnailSrc}
        />

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={editingValue}
              onChange={(event) => onEditingValueChange(event.target.value)}
              onBlur={onFinishRename}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancelRename();
                }
              }}
              className="h-7 w-full rounded-md border border-cyan-300/40 bg-black/25 px-2 text-[13px] font-semibold text-foreground outline-none focus:ring-1 focus:ring-cyan-300/40"
              aria-label={`Rename ${obj.name}`}
            />
          ) : (
            <p
              className="cursor-text truncate text-[13px] font-semibold leading-5 text-foreground"
              title={obj.name}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onStartRename();
              }}
            >
              {obj.name}
            </p>
          )}
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 rounded-sm bg-cyan-300/[0.08] px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
              {typeLabel}
            </span>
            {isGroup && (
              <span className="truncate text-[9px] uppercase tracking-wide text-slate-500">
                {obj.children?.length || 0} items
              </span>
            )}
            {obj.tag && (
              <span
                className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/20"
                style={{ background: TAG_COLORS[obj.tag] }}
                title={`${TAG_LABELS[obj.tag]} layer tag`}
              />
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectChecked(checked === true)}
            aria-label={`Select ${obj.name}`}
            className="h-4 w-4 border-slate-500 data-[state=checked]:border-cyan-300 data-[state=checked]:bg-cyan-300 data-[state=checked]:text-slate-950"
            data-testid={`layer-select-${obj.id}`}
          />
          <button
            type="button"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.07] ${obj.visible ? 'text-slate-300' : 'text-slate-500'}`}
            onClick={onToggleVisibility}
            aria-label={obj.visible ? `Hide ${obj.name}` : `Show ${obj.name}`}
            title={obj.visible ? 'Hide layer' : 'Show layer'}
          >
            {obj.visible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button
            type="button"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.07] ${obj.selectable ? 'text-slate-500' : 'text-cyan-200'}`}
            onClick={onToggleLock}
            aria-label={obj.selectable ? `Lock ${obj.name}` : `Unlock ${obj.name}`}
            title={obj.selectable ? 'Lock layer' : 'Unlock layer'}
          >
            {obj.selectable ? <Unlock size={14} /> : <Lock size={14} />}
          </button>
          <button
            type="button"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-cyan-300/[0.08] ${actionsOpen ? 'bg-cyan-300/[0.08] text-cyan-100' : 'text-slate-400 hover:text-cyan-100'}`}
            onClick={() => setActionsOpen((open) => !open)}
            aria-label={actionsOpen ? `Hide actions for ${obj.name}` : `More actions for ${obj.name}`}
            aria-expanded={actionsOpen}
            aria-controls={`layer-actions-${obj.id}`}
            title="More actions"
            data-testid={`layer-more-${obj.id}`}
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </div>

      <div
        id={`layer-actions-${obj.id}`}
        aria-hidden={!actionsOpen}
        className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out ${
          actionsOpen ? 'mt-2 max-h-[240px] opacity-100' : 'pointer-events-none mt-0 max-h-0 opacity-0'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2 rounded-lg border border-white/[0.06] bg-[#0d1117]/70 p-2">
          <div className="grid grid-cols-4 gap-1" aria-label="Layer order controls">
            <ShelfButton label="Bring to Front" onClick={() => onZOrder('front')}>
              <ChevronsUp size={14} />
            </ShelfButton>
            <ShelfButton label="Step Up" onClick={() => onZOrder('forward')}>
              <ArrowUp size={14} />
            </ShelfButton>
            <ShelfButton label="Step Down" onClick={() => onZOrder('backward')}>
              <ArrowDown size={14} />
            </ShelfButton>
            <ShelfButton label="Send to Back" onClick={() => onZOrder('back')}>
              <ChevronsDown size={14} />
            </ShelfButton>
          </div>

          <div className="grid grid-cols-5 gap-1" aria-label="Layer actions">
            <ShelfButton label="Rename" onClick={onStartRename}>
              <Pencil size={14} />
            </ShelfButton>
            <ShelfButton label="Target / Select" onClick={onTargetSelect}>
              <Target size={14} />
            </ShelfButton>
            <ShelfButton label="Duplicate" onClick={onDuplicate}>
              <Copy size={14} />
            </ShelfButton>
            <ShelfButton label="Group" onClick={onGroup} disabled={selectedCount < 2}>
              <Layers2 size={14} />
            </ShelfButton>
            <ShelfButton label="Delete" onClick={onDelete} destructive>
              <Trash2 size={14} />
            </ShelfButton>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2">
            <button
              type="button"
              className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] transition-colors hover:bg-white/[0.06] ${
                solo ? 'text-cyan-200' : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={onToggleSolo}
              aria-label={solo ? `Exit solo mode for ${obj.name}` : `Solo ${obj.name}`}
              title={solo ? 'Exit solo mode' : 'Solo layer'}
              data-testid={`layer-solo-${obj.id}`}
            >
              <Target size={13} />
              {solo ? 'Exit Solo' : 'Solo'}
            </button>
            <ColorTagSelector name={obj.name} value={obj.tag} onChange={onTagChange} />
          </div>
        </div>
      </div>
    </div>
  );
}