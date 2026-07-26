'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { PenTool } from './InkLayer';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FloatingInkBarProps {
  tool: PenTool;
  onTool: (t: PenTool) => void;
  onUndo: () => void;
  /** Called on close — receives last drag position so parent can persist it */
  onClose: (lastPos: { top: number; left: number }) => void;
  initialPosition?: { top: number; left: number };
  /** Ref to .sanchika-canvas — used for bounds-clamping during drag */
  containerRef: React.RefObject<HTMLDivElement>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG Icons  (no icon lib, all 16×16)
// ─────────────────────────────────────────────────────────────────────────────

function IconGel({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 13l2.5-2.5 6.5-6.5 2 2-6.5 6.5L3 13z"
        stroke={c} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M3 13l1-.5M11.5 3.5l1 1"
        stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="13.5" cy="2.5" r="1" fill={c}/>
    </svg>
  );
}

function IconPencil({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M11 2.5l2.5 2.5-8 8.5-3 .5.5-3 8-8.5z"
        stroke={c} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M9 4.5l2.5 2.5"
        stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function IconMarker({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="2" width="6" height="8" rx="2"
        stroke={c} strokeWidth="1.4"/>
      <path d="M7 10h2v3.5l-1 .5-1-.5V10z"
        stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

function IconEraser({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="6" width="12" height="7" rx="1.5"
        stroke={c} strokeWidth="1.4"/>
      <path d="M7.5 6v7" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M2 9.5l5.5-3.5" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function IconSelect({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7.5" cy="7.5" r="5" stroke={c} strokeWidth="1.4"
        strokeDasharray="2.5 1.8"/>
      <path d="M11 11l3.5 3.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconUndo({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 5.5H10a3.5 3.5 0 0 1 0 7H7"
        stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M4 5.5L6.5 3M4 5.5L6.5 8"
        stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconClose({ c }: { c: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 2l8 8M10 2L2 10"
        stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS: { id: PenTool; render: (c: string) => React.ReactNode }[] = [
  { id: 'gel',    render: (c) => <IconGel c={c} />    },
  { id: 'pencil', render: (c) => <IconPencil c={c} /> },
  { id: 'marker', render: (c) => <IconMarker c={c} /> },
  { id: 'eraser', render: (c) => <IconEraser c={c} /> },
  { id: 'select', render: (c) => <IconSelect c={c} /> },
];

// Shared button base style — avoids object recreation per render
const BTN_BASE: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 120ms',
  flexShrink: 0,
  padding: 0,
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'rgba(255,255,255,0.12)',
  margin: '0 2px',
  flexShrink: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function FloatingInkBar({
  tool,
  onTool,
  onUndo,
  onClose,
  initialPosition = { top: 40, left: 40 },
  containerRef,
}: FloatingInkBarProps) {
  const barRef   = useRef<HTMLDivElement>(null);
  // posRef drives DOM style directly — avoids React re-renders during drag
  const posRef   = useRef({ ...initialPosition });
  const dragging = useRef(false);
  const dragOff  = useRef({ x: 0, y: 0 });
  const capId    = useRef<number | null>(null);

  // Sync initial position to DOM, release pointer capture on unmount if mid-drag
  useEffect(() => {
    if (barRef.current) {
      barRef.current.style.left = `${posRef.current.left}px`;
      barRef.current.style.top  = `${posRef.current.top}px`;
    }
    return () => {
      if (dragging.current && capId.current !== null && barRef.current) {
        try { barRef.current.releasePointerCapture(capId.current); } catch { /* ignore */ }
      }
    };
  }, []);

  // Drag — skip if the pointerdown landed on a button (let clicks fire normally)
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    capId.current = e.pointerId;
    const r = barRef.current!.getBoundingClientRect();
    dragOff.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  // 60fps — manipulate DOM style directly, never call setState
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !barRef.current || !containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    const bW = barRef.current.offsetWidth;
    const bH = barRef.current.offsetHeight;
    // Clamp to container bounds so bar never escapes the canvas
    const newL = Math.max(0, Math.min(e.clientX - dragOff.current.x - cr.left, cr.width  - bW));
    const newT = Math.max(0, Math.min(e.clientY - dragOff.current.y - cr.top,  cr.height - bH));
    posRef.current = { left: newL, top: newT };
    barRef.current.style.left = `${newL}px`;
    barRef.current.style.top  = `${newT}px`;
  }, [containerRef]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    capId.current    = null;
  }, []);

  return (
    <div
      ref={barRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'absolute',
        top: posRef.current.top,
        left: posRef.current.left,
        background: 'rgba(31,41,55,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 32,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        zIndex: 20,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* ── Tool buttons ─────────────────────────────────────────────────── */}
      {TOOLS.map(({ id, render }) => {
        const active = tool === id;
        const iconColor = active ? '#ffffff' : 'rgba(255,255,255,0.5)';
        return (
          <button
            key={id}
            onClick={() => onTool(id)}
            title={id}
            style={{
              ...BTN_BASE,
              background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            {render(iconColor)}
          </button>
        );
      })}

      <div style={DIVIDER} />

      {/* ── Undo ─────────────────────────────────────────────────────────── */}
      <button
        onClick={onUndo}
        title="Undo"
        style={{ ...BTN_BASE, background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <IconUndo c="rgba(255,255,255,0.65)" />
      </button>

      <div style={DIVIDER} />

      {/* ── Close — passes last position so parent can restore it ─────── */}
      <button
        onClick={() => onClose({ ...posRef.current })}
        title="Close"
        style={{ ...BTN_BASE, background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <IconClose c="rgba(255,255,255,0.5)" />
      </button>
    </div>
  );
}
