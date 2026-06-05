import { RefObject, useRef, useEffect, useState } from 'react';
import { PenPoint, VectorAnchor } from '@/hooks/useFabricCanvas';

export interface DragInfo {
  w: number;
  h: number;
  angle: number;
  clientX: number;
  clientY: number;
}

interface CanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  hasObjects: boolean;
  gridEnabled: boolean;
  gridSize: number;
  transparentBg: boolean;
  penPoints: PenPoint[];
  penActive: boolean;
  onPenClose: () => void;
  zoom: number;
  vpX: number;
  vpY: number;
  dragInfo: DragInfo | null;
  brushActive?: boolean;
  eyedropperActive?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
  selectedElementId?: string | null;
  onNudgeElement?: (direction: 'up' | 'down' | 'left' | 'right', amount: number) => void;
  vectorAnchors?: VectorAnchor[];
  onVectorAnchorDragStart?: (idx: number) => void;
  onVectorAnchorDragMove?: (totalDx: number, totalDy: number) => void;
  onVectorAnchorDragEnd?: () => void;
  guides?: { h: number[]; v: number[] };
  gridLocked?: boolean;
  onGuideMove?: (axis: 'h' | 'v', idx: number, newDesignPos: number) => void;
}

export default function CanvasWorkspace({
  canvasRef, containerRef, hasObjects,
  gridEnabled, gridSize, transparentBg,
  penPoints, penActive,
  zoom, vpX, vpY,
  dragInfo, brushActive, eyedropperActive,
  canvasWidth = 1080,
  canvasHeight = 1080,
  selectedElementId = null,
  onNudgeElement,
  vectorAnchors = [],
  onVectorAnchorDragStart,
  onVectorAnchorDragMove,
  onVectorAnchorDragEnd,
  guides,
  gridLocked = false,
  onGuideMove,
}: CanvasProps) {
  const tileSize = gridSize * zoom;
  const showEmptyHint = !hasObjects && !penActive && !brushActive;
  const showPenSvg = penActive && penPoints.length > 0;
  const [nudgeStep, setNudgeStep] = useState<number>(2);
  const [showNudgePad, setShowNudgePad] = useState<boolean>(false);

  const canvasCursor = eyedropperActive ? 'crosshair' : penActive ? 'crosshair' : brushActive ? 'none' : 'default';

  /* ── Drag tooltip position ── */
  let tooltipLeft = 0, tooltipTop = 0;
  if (dragInfo && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    tooltipLeft = Math.min(dragInfo.clientX - rect.left + 14, rect.width - 130);
    tooltipTop = Math.max(dragInfo.clientY - rect.top - 38, 4);
  }

  const increaseStep = () => {
    if (nudgeStep === 1) setNudgeStep(2);
    else if (nudgeStep === 2) setNudgeStep(5);
    else if (nudgeStep === 5) setNudgeStep(10);
    else if (nudgeStep === 10) setNudgeStep(20);
  };
  const decreaseStep = () => {
    if (nudgeStep === 2) setNudgeStep(1);
    else if (nudgeStep === 5) setNudgeStep(2);
    else if (nudgeStep === 10) setNudgeStep(5);
    else if (nudgeStep === 20) setNudgeStep(10);
  };
  const handleNudgeAction = (direction: 'up' | 'down' | 'left' | 'right') => {
    onNudgeElement?.(direction, nudgeStep);
  };

  /* ── Vector anchor drag ── */
  const anchorDragRef = useRef<{ idx: number; startClientX: number; startClientY: number } | null>(null);
  const onVectorDragMoveRef = useRef(onVectorAnchorDragMove);
  const onVectorDragEndRef = useRef(onVectorAnchorDragEnd);
  useEffect(() => { onVectorDragMoveRef.current = onVectorAnchorDragMove; }, [onVectorAnchorDragMove]);
  useEffect(() => { onVectorDragEndRef.current = onVectorAnchorDragEnd; }, [onVectorAnchorDragEnd]);

  useEffect(() => {
    if (!vectorAnchors.length) return;
    const onMove = (e: MouseEvent) => {
      if (!anchorDragRef.current) return;
      const dx = e.clientX - anchorDragRef.current.startClientX;
      const dy = e.clientY - anchorDragRef.current.startClientY;
      onVectorDragMoveRef.current?.(dx, dy);
    };
    const onUp = () => {
      if (anchorDragRef.current) {
        onVectorDragEndRef.current?.();
        anchorDragRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [vectorAnchors.length]);

  /* ── Guide line drag ── */
  const guideDragRef = useRef<{ axis: 'h' | 'v'; idx: number; startClient: number; startDesign: number } | null>(null);
  const onGuideMoveRef = useRef(onGuideMove);
  useEffect(() => { onGuideMoveRef.current = onGuideMove; }, [onGuideMove]);

  useEffect(() => {
    if (gridLocked) return;
    const onMove = (e: MouseEvent) => {
      const drag = guideDragRef.current; if (!drag) return;
      const delta = drag.axis === 'h' ? e.clientY - drag.startClient : e.clientX - drag.startClient;
      const newDesignPos = Math.max(0, Math.round(drag.startDesign + delta / zoom));
      onGuideMoveRef.current?.(drag.axis, drag.idx, newDesignPos);
    };
    const onUp = () => { guideDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [gridLocked, zoom]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative flex items-center justify-center p-4 select-none"
      style={{ background: `radial-gradient(circle at 50% 50%, #141722 0%, #08090C 100%)`, cursor: canvasCursor }}
      data-testid="canvas-workspace"
    >
      <div
        className="relative overflow-hidden shadow-2xl transition-all duration-300 border border-neutral-800/40"
        style={{
          width: `${canvasWidth * zoom}px`,
          height: `${canvasHeight * zoom}px`,
          maxWidth: '100%', maxHeight: '100%',
          background: transparentBg ? `repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 20px 20px` : `#ffffff`,
        }}
      >
        <canvas ref={canvasRef} id="fabric-canvas" className="absolute top-0 left-0 w-full h-full" data-testid="fabric-canvas" />

        {/* High-contrast grid overlay — white lines with dark shadow for visibility on any background */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: gridEnabled ? 1 : 0,
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px),
              linear-gradient(rgba(255,255,255,0.25) 1.5px, transparent 1.5px),
              linear-gradient(90deg, rgba(255,255,255,0.25) 1.5px, transparent 1.5px)
            `,
            backgroundSize: `${tileSize}px ${tileSize}px, ${tileSize}px ${tileSize}px, ${tileSize}px ${tileSize}px, ${tileSize}px ${tileSize}px`,
            backgroundPosition: `${vpX % tileSize - 0.5}px ${vpY % tileSize - 0.5}px, ${vpX % tileSize - 0.5}px ${vpY % tileSize - 0.5}px, ${vpX % tileSize}px ${vpY % tileSize}px, ${vpX % tileSize}px ${vpY % tileSize}px`,
          }}
        />

        {/* Horizontal guide lines */}
        {guides?.h.map((pos, i) => {
          const yPx = pos * zoom + vpY;
          if (yPx < 0 || yPx > canvasHeight * zoom) return null;
          return (
            <div
              key={`gh${i}`}
              style={{
                position: 'absolute', left: 0, right: 0,
                top: yPx, height: 2,
                background: 'rgba(255, 80, 80, 0.85)',
                boxShadow: '0 0 4px rgba(255,80,80,0.7)',
                cursor: gridLocked ? 'default' : 'ns-resize',
                pointerEvents: gridLocked ? 'none' : 'auto',
                zIndex: 15,
              }}
              onMouseDown={(e) => {
                if (gridLocked) return;
                e.stopPropagation();
                guideDragRef.current = { axis: 'h', idx: i, startClient: e.clientY, startDesign: pos };
              }}
            />
          );
        })}

        {/* Vertical guide lines */}
        {guides?.v.map((pos, i) => {
          const xPx = pos * zoom + vpX;
          if (xPx < 0 || xPx > canvasWidth * zoom) return null;
          return (
            <div
              key={`gv${i}`}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: xPx, width: 2,
                background: 'rgba(255, 80, 80, 0.85)',
                boxShadow: '0 0 4px rgba(255,80,80,0.7)',
                cursor: gridLocked ? 'default' : 'ew-resize',
                pointerEvents: gridLocked ? 'none' : 'auto',
                zIndex: 15,
              }}
              onMouseDown={(e) => {
                if (gridLocked) return;
                e.stopPropagation();
                guideDragRef.current = { axis: 'v', idx: i, startClient: e.clientX, startDesign: pos };
              }}
            />
          );
        })}

        {/* Empty-state hint */}
        <div
          aria-hidden={!showEmptyHint}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-fade-in"
          style={{ opacity: showEmptyHint ? 1 : 0 }}
        >
          <p className="text-neutral-400 text-sm tracking-wider font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
            Tap + to add your first element
          </p>
        </div>

        {/* Pen SVG overlay */}
        <svg
          aria-hidden={!showPenSvg}
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          style={{ overflow: 'visible', display: showPenSvg ? 'block' : 'none' }}
        >
          {penPoints.length >= 2 && (
            <polyline
              points={penPoints.map((p) => `${p.x * zoom + vpX},${p.y * zoom + vpY}`).join(' ')}
              fill="none" stroke="#00F5FF" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6"
            />
          )}
          {penPoints.map((p, i) => {
            const cx = p.x * zoom + vpX;
            const cy = p.y * zoom + vpY;
            const isFirst = i === 0;
            return (
              <g key={`pt-${i}-${Math.round(p.x)}-${Math.round(p.y)}`}>
                <circle cx={cx} cy={cy} r={isFirst ? 7 : 5} fill={isFirst ? '#ff6b6b' : '#00F5FF'} stroke="#fff" strokeWidth="1.5" />
                {isFirst && penPoints.length >= 3 && (
                  <circle cx={cx} cy={cy} r={12} fill="none" stroke="#ff6b6b" strokeWidth="1" opacity="0.5" strokeDasharray="3 2" />
                )}
              </g>
            );
          })}
        </svg>

        {/* Vector anchor editor overlay */}
        {vectorAnchors.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full z-30"
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            {/* Connection lines between anchors */}
            {vectorAnchors.length >= 2 && vectorAnchors.map((anchor, i) => {
              const next = vectorAnchors[i + 1];
              if (!next) return null;
              return (
                <line key={`al${i}`}
                  x1={anchor.screenX} y1={anchor.screenY}
                  x2={next.screenX} y2={next.screenY}
                  stroke="rgba(0,245,255,0.3)" strokeWidth="1" strokeDasharray="4 3"
                />
              );
            })}
            {vectorAnchors.map((anchor, i) => (
              <g
                key={`anchor-${i}`}
                style={{ pointerEvents: 'auto', cursor: 'move' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onVectorAnchorDragStart?.(i);
                  anchorDragRef.current = { idx: i, startClientX: e.clientX, startClientY: e.clientY };
                }}
              >
                {/* Outer glow ring */}
                <circle cx={anchor.screenX} cy={anchor.screenY} r={10} fill="rgba(0,245,255,0.12)" stroke="rgba(0,245,255,0.4)" strokeWidth={1} />
                {/* Inner dot */}
                <circle cx={anchor.screenX} cy={anchor.screenY} r={5} fill="#00F5FF" stroke="white" strokeWidth={1.5} />
                {/* Index label */}
                <text x={anchor.screenX + 10} y={anchor.screenY - 8} fill="#00F5FF" fontSize="9" fontFamily="monospace">{i + 1}</text>
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* ── Floating navigation overlays ── */}
      {selectedElementId && (
        <button
          onClick={() => setShowNudgePad(!showNudgePad)}
          className="absolute bottom-4 left-4 z-40 p-3 rounded-full bg-slate-900 border border-neutral-700/60 shadow-lg active:scale-95 transition-transform text-cyan-400 hover:text-cyan-300"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
        </button>
      )}

      {selectedElementId && showNudgePad && (
        <div
          className="absolute bottom-20 left-4 bg-slate-950/95 border border-cyan-500/30 p-4 rounded-xl flex flex-col items-center gap-3 shadow-2xl z-40 backdrop-blur-md"
          style={{ width: '160px', boxShadow: '0 10px 25px -5px rgba(0, 245, 255, 0.15)' }}
        >
          <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-400/70">Nudge Tool</div>
          <div className="grid grid-cols-3 gap-1.5 w-full aspect-square max-w-[120px]">
            <div />
            <button onClick={() => handleNudgeAction('up')} className="bg-slate-900 border border-neutral-800 hover:border-cyan-500/40 rounded-lg flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors py-2">▲</button>
            <div />
            <button onClick={() => handleNudgeAction('left')} className="bg-slate-900 border border-neutral-800 hover:border-cyan-500/40 rounded-lg flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors py-2">◀</button>
            <div className="bg-slate-950 border border-neutral-900 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold text-neutral-300 select-none">{nudgeStep}px</div>
            <button onClick={() => handleNudgeAction('right')} className="bg-slate-900 border border-neutral-800 hover:border-cyan-500/40 rounded-lg flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors py-2">▶</button>
            <div />
            <button onClick={() => handleNudgeAction('down')} className="bg-slate-900 border border-neutral-800 hover:border-cyan-500/40 rounded-lg flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors py-2">▼</button>
            <div />
          </div>
          <div className="flex items-center gap-2 w-full mt-1 border-t border-neutral-900 pt-2.5 justify-between">
            <button onClick={decreaseStep} disabled={nudgeStep <= 1} className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-xs font-bold text-neutral-400 disabled:opacity-30 border border-neutral-800">-</button>
            <span className="text-[10px] text-neutral-400 font-medium">Step Speed</span>
            <button onClick={increaseStep} disabled={nudgeStep >= 20} className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-xs font-bold text-neutral-400 disabled:opacity-30 border border-neutral-800">+</button>
          </div>
        </div>
      )}

      {/* Pen instruction */}
      <div aria-hidden={!penActive} className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20" style={{ display: penActive ? 'flex' : 'none' }}>
        <div className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.8)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.35)' }}>
          {penPoints.length === 0 ? 'Tap to place first anchor point' : penPoints.length < 3 ? `${penPoints.length} point${penPoints.length > 1 ? 's' : ''} — keep tapping` : 'Tap first point to close shape'}
        </div>
      </div>

      {/* Drag telemetry */}
      <div
        aria-hidden={!dragInfo}
        className="absolute pointer-events-none z-30 px-2 py-1 rounded-lg text-xs font-mono whitespace-nowrap"
        style={{
          display: dragInfo ? 'block' : 'none', left: tooltipLeft, top: tooltipTop,
          background: 'rgba(0,0,0,0.92)', color: '#00F5FF',
          border: '1px solid rgba(0,245,255,0.4)', boxShadow: '0 0 10px rgba(0,245,255,0.25)',
        }}
      >
        {dragInfo ? `${dragInfo.w} × ${dragInfo.h} px${dragInfo.angle !== 0 ? `  ·  ${dragInfo.angle}°` : ''}` : ''}
      </div>
    </div>
  );
}