import { RefObject, useRef, useEffect } from 'react';
import { PenPoint, VectorAnchor } from '@/hooks/useFabricCanvas';

/** Build an SVG path string from committed bezier nodes, in canvas-pixel coords */
function buildSvgBezierPath(
  pts: PenPoint[], zoom: number, vpX: number, vpY: number,
): string {
  if (pts.length < 1) return '';
  const sx = (x: number) => x * zoom + vpX;
  const sy = (y: number) => y * zoom + vpY;
  let d = `M ${sx(pts[0].x)} ${sy(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cp1 = prev.cpOut ?? { x: prev.x, y: prev.y };
    const cp2 = curr.cpIn ?? { x: curr.x, y: curr.y };
    if (cp1.x === prev.x && cp1.y === prev.y && cp2.x === curr.x && cp2.y === curr.y) {
      d += ` L ${sx(curr.x)} ${sy(curr.y)}`;
    } else {
      d += ` C ${sx(cp1.x)} ${sy(cp1.y)} ${sx(cp2.x)} ${sy(cp2.y)} ${sx(curr.x)} ${sy(curr.y)}`;
    }
  }
  return d;
}

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
  vectorAnchors?: VectorAnchor[];
  onVectorAnchorDragStart?: (idx: number) => void;
  onVectorAnchorDragMove?: (totalDx: number, totalDy: number) => void;
  onVectorAnchorDragEnd?: () => void;
  guides?: { h: number[]; v: number[] };
  gridLocked?: boolean;
  onGuideMove?: (axis: 'h' | 'v', idx: number, newDesignPos: number) => void;
  panActive?: boolean;
  /** Live bezier handle being dragged for the in-progress pen node */
  penLiveHandle?: { x: number; y: number; cpOut: { x: number; y: number } } | null;
  /** Index of the currently highlighted anchor in the node editor */
  selectedAnchorIdx?: number | null;
  vectorAnchorOnly?: VectorAnchor[];
}

/* Extra scroll room on each side for panning — canvas element stays design-sized,
   the outer scroll area is always this much wider/taller so the user can pan freely. */
export const PAN_MARGIN = 600;

export default function CanvasWorkspace({
  canvasRef, containerRef, hasObjects,
  gridEnabled, gridSize, transparentBg,
  penPoints, penActive,
  zoom, vpX, vpY,
  dragInfo, brushActive, eyedropperActive,
  canvasWidth = 1080,
  canvasHeight = 1080,
  vectorAnchors = [],
  onVectorAnchorDragStart,
  onVectorAnchorDragMove,
  onVectorAnchorDragEnd,
  guides,
  gridLocked = false,
  onGuideMove,
  panActive = false,
  penLiveHandle = null,
  selectedAnchorIdx = null,
}: CanvasProps) {
  const tileSize = gridSize * zoom;
  const showEmptyHint = !hasObjects && !penActive && !brushActive;
  const showPenSvg = penActive && penPoints.length > 0;

  const canvasCursor = eyedropperActive ? 'crosshair' : penActive ? 'crosshair' : brushActive ? 'none' : panActive ? 'grab' : 'default';

  /* ── Drag tooltip position ── */
  let tooltipLeft = 0, tooltipTop = 0;
  if (dragInfo && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    tooltipLeft = Math.min(dragInfo.clientX - rect.left + 14, rect.width - 130);
    tooltipTop = Math.max(dragInfo.clientY - rect.top - 38, 4);
  }

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

  /* ── Single-finger touch pan on container when pan tool is active ── */
  const touchPanRef = useRef<{ lastX: number; lastY: number } | null>(null);
  useEffect(() => {
    const ct = containerRef.current;
    if (!ct) return;
    const onTouchStart = (e: TouchEvent) => {
      // Always prevent native browser touch-scroll — we own scrolling via JS.
      // This is the sole fix for "panning when tool is OFF": the browser never
      // gets a chance to scroll the overflow:auto container natively.
      e.preventDefault();
      if (!panActive || e.touches.length !== 1) return;
      const t = e.touches[0];
      touchPanRef.current = { lastX: t.clientX, lastY: t.clientY };
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // always block native scroll
      if (!touchPanRef.current || !panActive || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - touchPanRef.current.lastX;
      const dy = t.clientY - touchPanRef.current.lastY;
      touchPanRef.current = { lastX: t.clientX, lastY: t.clientY };
      ct.scrollLeft -= dx;
      ct.scrollTop -= dy;
    };
    const onTouchEnd = () => { touchPanRef.current = null; };
    ct.addEventListener('touchstart', onTouchStart, { passive: false });
    ct.addEventListener('touchmove', onTouchMove, { passive: false });
    ct.addEventListener('touchend', onTouchEnd);
    return () => {
      ct.removeEventListener('touchstart', onTouchStart);
      ct.removeEventListener('touchmove', onTouchMove);
      ct.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, panActive]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative select-none"
      style={{
        background: `radial-gradient(circle at 50% 50%, #141722 0%, #08090C 100%)`,
        cursor: canvasCursor,
        overflow: 'auto',
        scrollbarWidth: 'none',
        touchAction: 'none', // disable native browser touch-scroll; JS owns all scrolling
      }}
      data-testid="canvas-workspace"
    >
      {/* Large scroll area — always PAN_MARGIN wider/taller than the canvas on each side.
          This gives the user room to pan in any direction without objects disappearing. */}
      <div
        style={{
          width: `${canvasWidth * zoom + 2 * PAN_MARGIN}px`,
          height: `${canvasHeight * zoom + 2 * PAN_MARGIN}px`,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* The actual design canvas, centered inside the scroll area */}
        <div
          className="overflow-hidden shadow-2xl border border-neutral-800/40"
          style={{
            position: 'absolute',
            left: `${PAN_MARGIN}px`,
            top: `${PAN_MARGIN}px`,
            width: `${canvasWidth * zoom}px`,
            height: `${canvasHeight * zoom}px`,
            background: transparentBg ? `repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 20px 20px` : `#ffffff`,
          }}
        >
          <canvas ref={canvasRef} id="fabric-canvas" className="absolute top-0 left-0 w-full h-full" data-testid="fabric-canvas" />

          {/* High-contrast grid overlay */}
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

          {/* Bezier Pen SVG overlay */}
          <svg
            aria-hidden={!showPenSvg}
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
            style={{ overflow: 'visible', display: showPenSvg ? 'block' : 'none' }}
          >
            {/* Committed bezier path */}
            {penPoints.length >= 2 && (
              <path
                d={buildSvgBezierPath(penPoints, zoom, vpX, vpY)}
                fill="none" stroke="#00F5FF" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7"
              />
            )}
            {/* Handle tangent lines for each committed node */}
            {penPoints.map((p, i) => {
              if (!p.cpOut) return null;
              const ax = p.x * zoom + vpX, ay = p.y * zoom + vpY;
              const hx = p.cpOut.x * zoom + vpX, hy = p.cpOut.y * zoom + vpY;
              // mirror: cpIn
              const mx = (2 * p.x - p.cpOut.x) * zoom + vpX;
              const my = (2 * p.y - p.cpOut.y) * zoom + vpY;
              return (
                <g key={`h-${i}`} pointerEvents="none">
                  <line x1={mx} y1={my} x2={hx} y2={hy} stroke="rgba(0,245,255,0.45)" strokeWidth="1" strokeDasharray="3 2" />
                  <rect x={hx - 4} y={hy - 4} width={8} height={8} fill="#00F5FF" stroke="white" strokeWidth={1.2} transform={`rotate(45 ${hx} ${hy})`} opacity="0.85" />
                  <rect x={mx - 4} y={my - 4} width={8} height={8} fill="#00F5FF" stroke="white" strokeWidth={1.2} transform={`rotate(45 ${mx} ${my})`} opacity="0.6" />
                  <line x1={ax} y1={ay} x2={hx} y2={hy} stroke="rgba(0,245,255,0.25)" strokeWidth="1" />
                  <line x1={ax} y1={ay} x2={mx} y2={my} stroke="rgba(0,245,255,0.25)" strokeWidth="1" />
                </g>
              );
            })}
            {/* Live handle being dragged for the in-progress node */}
            {penLiveHandle && (() => {
              const ax = penLiveHandle.x * zoom + vpX, ay = penLiveHandle.y * zoom + vpY;
              const hx = penLiveHandle.cpOut.x * zoom + vpX, hy = penLiveHandle.cpOut.y * zoom + vpY;
              const mx = (2 * penLiveHandle.x - penLiveHandle.cpOut.x) * zoom + vpX;
              const my = (2 * penLiveHandle.y - penLiveHandle.cpOut.y) * zoom + vpY;
              return (
                <g pointerEvents="none">
                  <circle cx={ax} cy={ay} r={6} fill="#00F5FF" stroke="white" strokeWidth={1.5} opacity="0.9" />
                  <line x1={mx} y1={my} x2={hx} y2={hy} stroke="rgba(0,245,255,0.7)" strokeWidth="1.5" strokeDasharray="4 2" />
                  <rect x={hx - 5} y={hy - 5} width={10} height={10} fill="#00F5FF" stroke="white" strokeWidth={1.5} transform={`rotate(45 ${hx} ${hy})`} />
                  <rect x={mx - 5} y={my - 5} width={10} height={10} fill="transparent" stroke="#00F5FF" strokeWidth={1.5} transform={`rotate(45 ${mx} ${my})`} />
                </g>
              );
            })()}
            {/* Anchor dots */}
            {penPoints.map((p, i) => {
              const cx = p.x * zoom + vpX;
              const cy = p.y * zoom + vpY;
              const isFirst = i === 0;
              return (
                <g key={`pt-${i}-${Math.round(p.x)}-${Math.round(p.y)}`}>
                  <circle cx={cx} cy={cy} r={isFirst ? 7 : 5} fill={isFirst ? '#ff6b6b' : '#00F5FF'} stroke="#fff" strokeWidth="1.5" />
                  {isFirst && penPoints.length >= 3 && (
                    <circle cx={cx} cy={cy} r={13} fill="none" stroke="#ff6b6b" strokeWidth="1.5" opacity="0.6" strokeDasharray="4 2" />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Vector anchor + handle editor overlay */}
          {vectorAnchors.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full z-30"
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              {/* Handle tangent arms */}
              {vectorAnchors
                .filter(a => a.kind === 'handle' && a.pairScreenX !== null)
                .map((a, i) => (
                  <line key={`arm-${i}`}
                    x1={a.screenX} y1={a.screenY}
                    x2={a.pairScreenX!} y2={a.pairScreenY!}
                    stroke="rgba(123,47,255,0.6)" strokeWidth="1.2" strokeDasharray="4 2"
                    pointerEvents="none"
                  />
                ))}

              {/* Anchors and handles */}
              {vectorAnchors.map((anchor, i) => {
                const isHandle = anchor.kind === 'handle';
                // Find anchor-only index to compare with selectedAnchorIdx
                const anchorOnlyIdx = !isHandle
                  ? vectorAnchors.slice(0, i).filter(a => a.kind === 'anchor').length
                  : -1;
                const isSelected = !isHandle && anchorOnlyIdx === selectedAnchorIdx;
                return (
                  <g
                    key={`va-${i}`}
                    style={{ pointerEvents: 'auto', cursor: 'move' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onVectorAnchorDragStart?.(i);
                      anchorDragRef.current = { idx: i, startClientX: e.clientX, startClientY: e.clientY };
                    }}
                  >
                    {isHandle ? (
                      <>
                        {/* Larger hit area */}
                        <circle cx={anchor.screenX} cy={anchor.screenY} r={11} fill="transparent" />
                        <rect
                          x={anchor.screenX - 5} y={anchor.screenY - 5}
                          width={10} height={10}
                          fill="#7B2FFF" stroke="white" strokeWidth={1.5}
                          transform={`rotate(45 ${anchor.screenX} ${anchor.screenY})`}
                        />
                      </>
                    ) : (
                      <>
                        {/* Selection ring */}
                        {isSelected && (
                          <circle cx={anchor.screenX} cy={anchor.screenY} r={14}
                            fill="none" stroke="#7B2FFF" strokeWidth={2} opacity={0.8} strokeDasharray="4 2" />
                        )}
                        <circle cx={anchor.screenX} cy={anchor.screenY} r={11}
                          fill={isSelected ? 'rgba(123,47,255,0.18)' : 'rgba(0,245,255,0.1)'}
                          stroke={isSelected ? '#7B2FFF' : 'rgba(0,245,255,0.4)'} strokeWidth={1.5} />
                        <circle cx={anchor.screenX} cy={anchor.screenY} r={5}
                          fill={isSelected ? '#7B2FFF' : '#00F5FF'} stroke="white" strokeWidth={1.5} />
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Pen instruction — absolute over the whole container */}
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
