'use client';

/**
 * PenToolbar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modern vertical icon rail + context panel system for Sanchika's ink mode.
 *
 * Architecture:
 *  • InkRail — 52px vertical icon bar, position: absolute right: 0
 *  • Context Panels A/B/C/D — 240px slide-in panels left of rail
 *  • All icon-only, no text labels, no tooltips
 *  • Panel enter: spring bounce animation (200ms)
 *  • Panel exit: fade+slide out (150ms)
 *
 * position: absolute (NOT fixed) so it stays inside .sanchika-canvas
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PenTool, InkStroke } from './InkLayer';

// ─── Favorite pen type ────────────────────────────────────────────────────────

export interface FavoritePen {
  id: string;
  tool: PenTool;
  color: string;
  size: number;
  opacity: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PenToolbarProps {
  tool: PenTool;
  color: string;
  opacity: number;
  size: number;
  eraserMode: 'stroke' | 'area';
  eraseHighlighterOnly: boolean;
  selectionMode: 'lasso' | 'rectangle';
  includePartial: boolean;
  hasSelection: boolean;
  onTool: (t: PenTool) => void;
  onColor: (c: string) => void;
  onOpacity: (o: number) => void;
  onSize: (s: number) => void;
  onEraserMode: (m: 'stroke' | 'area') => void;
  onEraseHighlighterOnly: (v: boolean) => void;
  onSelectionMode: (m: 'lasso' | 'rectangle') => void;
  onIncludePartial: (v: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
  onChangeStyle: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
  onShowFloatingBar: () => void;
  showGuide: boolean;
  onToggleGuide: () => void;
  favoritePens: FavoritePen[];
  onSaveFavorite: () => void;
  onApplyFavorite: (f: FavoritePen) => void;
  onDeleteFavorite: (id: string) => void;
  onApplyStyleToSelection: (updates: Partial<Pick<InkStroke, 'color' | 'size' | 'opacity'>>) => void;
  selectedStyle?: { size: number; opacity: number; color: string } | null;
}

// ─── Color palette (4×8 grid) ─────────────────────────────────────────────────

const COLOR_GRID = [
  // Row 1 — vivid
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
  // Row 2 — pastel
  '#fca5a5', '#fed7aa', '#fef08a', '#bbf7d0', '#a7f3d0', '#99f6e4', '#bfdbfe', '#ddd6fe',
  // Row 3 — deep
  '#991b1b', '#9a3412', '#854d0e', '#166534', '#065f46', '#155e75', '#1e3a8a', '#581c87',
  // Row 4 — neutrals
  '#ffffff', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#1f2937', '#111827', '#000000',
];

// ─── SVG Icons (inline, no emoji, no icon library) ────────────────────────────

const ICONS = {
  gel: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
    </svg>
  ),
  pencil: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  marker: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l-6 6v3h9l3-3" /><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </svg>
  ),
  eraser: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 21h10" /><path d="M5.5 11.5L16 2l6 6-10.5 10.5a2 2 0 0 1-1.4.6H6.4a2 2 0 0 1-1.4-.6L2 15.5l3.5-4z" />
    </svg>
  ),
  select: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h4" /><path d="M11 3h4" /><path d="M19 3h2v4" /><path d="M21 11v4" /><path d="M21 19v2h-4" /><path d="M13 21h-4" /><path d="M5 21H3v-4" /><path d="M3 13v-4" />
    </svg>
  ),
  undo: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  ),
  guide: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h16" /><path d="M4 15h16" /><path d="M4 21h16" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
    </svg>
  ),
  minus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  ),
  check: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  eyedropper: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22l1-1h3l9-9" /><path d="M16 8l-4 4" /><path d="M15 2l7 7-1.5 1.5-7-7z" />
    </svg>
  ),
};

// ─── Hold-to-repeat hook ──────────────────────────────────────────────────────

function useHoldRepeat(action: () => void, delay = 400, interval = 80) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const start = useCallback(() => {
    action();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(action, interval);
    }, delay);
  }, [action, delay, interval]);

  // Cleanup on unmount
  useEffect(() => clear, [clear]);

  return { onPointerDown: start, onPointerUp: clear, onPointerLeave: clear };
}

// ─── Size Slider ──────────────────────────────────────────────────────────────

function SizeSlider({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const decrement = useCallback(() => onChange(Math.max(1, value - 1)), [value, onChange]);
  const increment = useCallback(() => onChange(Math.min(100, value + 1)), [value, onChange]);
  const holdDec = useHoldRepeat(decrement);
  const holdInc = useHoldRepeat(increment);

  return (
    <div className="ink-slider-row">
      <button className="ink-step-btn" {...holdDec}>{ICONS.minus}</button>
      <div className="ink-slider-track-wrap">
        <input
          type="range"
          min={1}
          max={100}
          value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="ink-slider"
          style={{ '--slider-color': color } as React.CSSProperties}
        />
      </div>
      <button className="ink-step-btn" {...holdInc}>{ICONS.plus}</button>
      <span className="ink-slider-value">{value}</span>
    </div>
  );
}

// ─── Opacity Slider ───────────────────────────────────────────────────────────

function OpacitySlider({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const decrement = useCallback(() => onChange(Math.max(0.05, Math.round((value - 0.05) * 100) / 100)), [value, onChange]);
  const increment = useCallback(() => onChange(Math.min(1, Math.round((value + 0.05) * 100) / 100)), [value, onChange]);
  const holdDec = useHoldRepeat(decrement);
  const holdInc = useHoldRepeat(increment);

  return (
    <div className="ink-slider-row" style={{ marginTop: 10 }}>
      <button className="ink-step-btn" {...holdDec}>{ICONS.minus}</button>
      <div className="ink-slider-track-wrap ink-opacity-track">
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round(value * 100)}
          onChange={e => onChange(parseInt(e.target.value) / 100)}
          className="ink-slider"
          style={{ '--slider-color': color } as React.CSSProperties}
        />
        <div className="ink-opacity-overlay" style={{ background: color, opacity: value }} />
      </div>
      <button className="ink-step-btn" {...holdInc}>{ICONS.plus}</button>
      <span className="ink-slider-value">{Math.round(value * 100)}%</span>
    </div>
  );
}

// ─── Color Grid ───────────────────────────────────────────────────────────────

function ColorGrid({ color, onColor, lastCustom, setLastCustom }: {
  color: string; onColor: (c: string) => void;
  lastCustom: string; setLastCustom: (c: string) => void;
}) {
  const customRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="ink-color-grid">
        {COLOR_GRID.map(c => (
          <button
            key={c}
            className={`ink-swatch ${color === c ? 'active' : ''}`}
            style={{ background: c, border: c === '#ffffff' ? '1px solid #e5e7eb' : 'none' }}
            onClick={() => onColor(c)}
          >
            {color === c && <span className="ink-swatch-check">{ICONS.check}</span>}
          </button>
        ))}
      </div>
      <div className="ink-custom-row">
        <button className="ink-custom-slot ink-custom-eyedropper" disabled>
          {ICONS.eyedropper}
        </button>
        <button
          className="ink-custom-slot ink-custom-rainbow"
          onClick={() => customRef.current?.click()}
        >
          <input
            ref={customRef}
            type="color"
            value={color}
            onChange={e => { onColor(e.target.value); setLastCustom(e.target.value); }}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
        </button>
        {lastCustom && (
          <button
            className="ink-custom-slot"
            style={{ background: lastCustom }}
            onClick={() => onColor(lastCustom)}
          />
        )}
      </div>
    </>
  );
}

// ─── Favorite Pens ────────────────────────────────────────────────────────────

function FavoritePensStrip({ favorites, onApply, onDelete, onSave }: {
  favorites: FavoritePen[]; onApply: (f: FavoritePen) => void;
  onDelete: (id: string) => void; onSave: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slots = [...favorites.slice(0, 5)];
  while (slots.length < 5) slots.push(null as any);

  const startLongPress = (id: string) => {
    longPressRef.current = setTimeout(() => setDeletingId(id), 500);
  };
  const cancelLongPress = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  };

  return (
    <div className="ink-fav-strip">
      {slots.map((fav, i) =>
        fav ? (
          <button
            key={fav.id}
            className="ink-fav-slot"
            onClick={() => deletingId === fav.id ? onDelete(fav.id) : onApply(fav)}
            onPointerDown={() => startLongPress(fav.id)}
            onPointerUp={cancelLongPress}
            onPointerLeave={() => { cancelLongPress(); setDeletingId(null); }}
          >
            <span className="ink-fav-dot" style={{ background: fav.color }} />
            {deletingId === fav.id && <span className="ink-fav-delete">×</span>}
          </button>
        ) : (
          <button key={`empty-${i}`} className="ink-fav-slot ink-fav-empty" onClick={onSave}>
            <span style={{ color: '#d1d5db', fontSize: 16, lineHeight: 1 }}>+</span>
          </button>
        )
      )}
    </div>
  );
}

// ─── iOS-style Toggle ─────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`ink-toggle ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
      type="button"
    >
      <span className="ink-toggle-thumb" />
    </button>
  );
}

// ─── Radio option ─────────────────────────────────────────────────────────────

function Radio({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <button className="ink-radio" onClick={onClick} type="button">
      <span className="ink-radio-outer">
        {selected && <span className="ink-radio-inner" />}
      </span>
    </button>
  );
}

// ─── Panel A — Gel Pen / Pencil ───────────────────────────────────────────────

function PanelA({ size, color, onSize, onColor, favorites, onSaveFavorite, onApplyFavorite, onDeleteFavorite }: {
  size: number; color: string;
  onSize: (s: number) => void; onColor: (c: string) => void;
  favorites: FavoritePen[];
  onSaveFavorite: () => void;
  onApplyFavorite: (f: FavoritePen) => void;
  onDeleteFavorite: (id: string) => void;
}) {
  const [lastCustom, setLastCustom] = useState('');
  return (
    <div className="ink-panel-content">
      <SizeSlider value={size} onChange={onSize} color={color} />
      <div style={{ height: 14 }} />
      <ColorGrid color={color} onColor={onColor} lastCustom={lastCustom} setLastCustom={setLastCustom} />
      <div style={{ height: 10 }} />
      <FavoritePensStrip favorites={favorites} onApply={onApplyFavorite} onDelete={onDeleteFavorite} onSave={onSaveFavorite} />
    </div>
  );
}

// ─── Panel B — Marker / Highlighter ───────────────────────────────────────────

function PanelB({ size, opacity, color, onSize, onOpacity, onColor, favorites, onSaveFavorite, onApplyFavorite, onDeleteFavorite }: {
  size: number; opacity: number; color: string;
  onSize: (s: number) => void; onOpacity: (o: number) => void; onColor: (c: string) => void;
  favorites: FavoritePen[];
  onSaveFavorite: () => void;
  onApplyFavorite: (f: FavoritePen) => void;
  onDeleteFavorite: (id: string) => void;
}) {
  const [lastCustom, setLastCustom] = useState('');
  return (
    <div className="ink-panel-content">
      <SizeSlider value={size} onChange={onSize} color={color} />
      <OpacitySlider value={opacity} onChange={onOpacity} color={color} />
      <div style={{ height: 14 }} />
      <ColorGrid color={color} onColor={onColor} lastCustom={lastCustom} setLastCustom={setLastCustom} />
      <div style={{ height: 10 }} />
      <FavoritePensStrip favorites={favorites} onApply={onApplyFavorite} onDelete={onDeleteFavorite} onSave={onSaveFavorite} />
    </div>
  );
}

// ─── Panel C — Eraser ─────────────────────────────────────────────────────────

function PanelC({ eraserMode, onEraserMode, eraseHighlighterOnly, onEraseHighlighterOnly, onClear, size, onSize }: {
  eraserMode: 'stroke' | 'area'; onEraserMode: (m: 'stroke' | 'area') => void;
  eraseHighlighterOnly: boolean; onEraseHighlighterOnly: (v: boolean) => void;
  onClear: () => void; size: number; onSize: (s: number) => void;
}) {
  const [pressing, setPressing] = useState(false);

  const handleClear = () => {
    setPressing(true);
    setTimeout(() => { setPressing(false); onClear(); }, 120);
  };

  return (
    <div className="ink-panel-content">
      <SizeSlider value={size} onChange={onSize} color="#9ca3af" />
      <div style={{ height: 14 }} />

      <div className="ink-radio-row" onClick={() => onEraserMode('stroke')}>
        <Radio selected={eraserMode === 'stroke'} onClick={() => onEraserMode('stroke')} />
        <span className="ink-radio-label">Stroke eraser</span>
      </div>
      <div className="ink-radio-row" onClick={() => onEraserMode('area')}>
        <Radio selected={eraserMode === 'area'} onClick={() => onEraserMode('area')} />
        <span className="ink-radio-label">Area eraser</span>
      </div>

      <div className="ink-panel-divider" />

      <div className="ink-toggle-row">
        <span className="ink-radio-label">Erase highlighter only</span>
        <Toggle on={eraseHighlighterOnly} onChange={onEraseHighlighterOnly} />
      </div>

      <div className="ink-panel-divider" />

      <button
        className={`ink-erase-all ${pressing ? 'pressing' : ''}`}
        onClick={handleClear}
      >
        Erase all handwriting
      </button>
    </div>
  );
}

// ─── Panel D — Selection ───────────────────────────────────────────────

function PanelD({ selectionMode, onSelectionMode, includePartial, onIncludePartial, hasSelection, onChangeStyle, onDeleteSelected }: {
  selectionMode: 'lasso' | 'rectangle'; onSelectionMode: (m: 'lasso' | 'rectangle') => void;
  includePartial: boolean; onIncludePartial: (v: boolean) => void;
  hasSelection: boolean; onChangeStyle: () => void; onDeleteSelected: () => void;
}) {
  return (
    <div className="ink-panel-content">
      <div className="ink-radio-row" onClick={() => onSelectionMode('lasso')}>
        <Radio selected={selectionMode === 'lasso'} onClick={() => onSelectionMode('lasso')} />
        <span className="ink-radio-label">Lasso</span>
      </div>
      <div className="ink-radio-row" onClick={() => onSelectionMode('rectangle')}>
        <Radio selected={selectionMode === 'rectangle'} onClick={() => onSelectionMode('rectangle')} />
        <span className="ink-radio-label">Rectangle</span>
      </div>

      <div className="ink-panel-divider" />

      <div className="ink-toggle-row">
        <span className="ink-radio-label" style={{ fontSize: 13 }}>Include partially selected</span>
        <Toggle on={includePartial} onChange={onIncludePartial} />
      </div>

      {hasSelection && (
        <>
          <div className="ink-panel-divider" />
          <button className="ink-erase-all" style={{ marginBottom: 8, color: 'inherit', borderColor: '#d1d5db' }} onClick={onChangeStyle}>
            Change Style
          </button>
          <button className="ink-erase-all" onClick={onDeleteSelected}>
            Delete Selected
          </button>
        </>
      )}
    </div>
  );
}

// ─── Panel E — Change Style ───────────────────────────────────────────────────

function PanelE({ initialSize, initialOpacity, initialColor, onApplyStyleToSelection, onBack }: {
  initialSize: number; initialOpacity: number; initialColor: string;
  onApplyStyleToSelection: (updates: Partial<Pick<InkStroke, 'color' | 'size' | 'opacity'>>) => void;
  onBack: () => void;
}) {
  const [size, setSize] = useState(initialSize);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [color, setColor] = useState(initialColor);
  const [lastCustom, setLastCustom] = useState('');

  const handleSize = (s: number) => { setSize(s); onApplyStyleToSelection({ size: s }); };
  const handleOpacity = (o: number) => { setOpacity(o); onApplyStyleToSelection({ opacity: o }); };
  const handleColor = (c: string) => { setColor(c); onApplyStyleToSelection({ color: c }); };

  return (
    <div className="ink-panel-content">
      <button className="ink-erase-all" style={{ marginBottom: 12, padding: '4px 8px', fontSize: 12, border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }} onClick={onBack}>
        <span style={{ fontSize: 16 }}>←</span> Back to Selection
      </button>
      <SizeSlider value={size} onChange={handleSize} color={color} />
      <OpacitySlider value={opacity} onChange={handleOpacity} color={color} />
      <div style={{ height: 14 }} />
      <ColorGrid color={color} onColor={handleColor} lastCustom={lastCustom} setLastCustom={setLastCustom} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type ToolPanel = 'gel' | 'pencil' | 'marker' | 'eraser' | 'select';

export default function PenToolbar(props: PenToolbarProps) {
  const {
    tool, color, opacity, size,
    eraserMode, eraseHighlighterOnly,
    selectionMode, includePartial, hasSelection,
    onTool, onColor, onOpacity, onSize,
    onEraserMode, onEraseHighlighterOnly,
    onSelectionMode, onIncludePartial,
    onUndo, onClear, onChangeStyle, onDeleteSelected,
    onClose, onShowFloatingBar,
    showGuide, onToggleGuide,
    favoritePens, onSaveFavorite, onApplyFavorite, onDeleteFavorite,
    onApplyStyleToSelection, selectedStyle,
  } = props;

  const [activePanel, setActivePanel] = useState<ToolPanel | null>(tool === 'select' ? null : tool as ToolPanel);
  const [panelClosing, setPanelClosing] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);

  // Gap 7: Auto-close Panel E when tool switches
  useEffect(() => {
    setShowStylePanel(false);
  }, [tool]);

  // Toggle panel: tap active tool → close; tap different tool → switch
  const handleToolClick = (t: ToolPanel) => {
    onTool(t);
    if (activePanel === t) {
      // Close with exit animation
      setPanelClosing(true);
      setTimeout(() => { setPanelClosing(false); setActivePanel(null); }, 150);
    } else {
      if (activePanel) {
        setPanelClosing(true);
        setTimeout(() => {
          setPanelClosing(false);
          setActivePanel(t);
        }, 150);
      } else {
        setActivePanel(t);
      }
    }
  };

  const toolButtons: { id: ToolPanel; icon: React.ReactNode }[] = [
    { id: 'gel', icon: ICONS.gel },
    { id: 'pencil', icon: ICONS.pencil },
    { id: 'marker', icon: ICONS.marker },
    { id: 'eraser', icon: ICONS.eraser },
    { id: 'select', icon: ICONS.select },
  ];

  const renderPanel = () => {
    const panelTool = panelClosing ? activePanel : activePanel;
    if (!panelTool) return null;

    let content: React.ReactNode = null;
    switch (panelTool) {
      case 'gel':
      case 'pencil':
        content = (
          <PanelA
            size={size} color={color} onSize={onSize} onColor={onColor}
            favorites={favoritePens} onSaveFavorite={onSaveFavorite}
            onApplyFavorite={onApplyFavorite} onDeleteFavorite={onDeleteFavorite}
          />
        );
        break;
      case 'marker':
        content = (
          <PanelB
            size={size} opacity={opacity} color={color}
            onSize={onSize} onOpacity={onOpacity} onColor={onColor}
            favorites={favoritePens} onSaveFavorite={onSaveFavorite}
            onApplyFavorite={onApplyFavorite} onDeleteFavorite={onDeleteFavorite}
          />
        );
        break;
      case 'eraser':
        content = (
          <PanelC
            eraserMode={eraserMode} onEraserMode={onEraserMode}
            eraseHighlighterOnly={eraseHighlighterOnly} onEraseHighlighterOnly={onEraseHighlighterOnly}
            onClear={onClear} size={size} onSize={onSize}
          />
        );
        break;
      case 'select':
        if (showStylePanel) {
          content = (
            <PanelE
              initialSize={selectedStyle?.size ?? size}
              initialOpacity={selectedStyle?.opacity ?? opacity}
              initialColor={selectedStyle?.color ?? color}
              onApplyStyleToSelection={onApplyStyleToSelection}
              onBack={() => setShowStylePanel(false)}
            />
          );
        } else {
          content = (
            <PanelD
              selectionMode={selectionMode} onSelectionMode={onSelectionMode}
              includePartial={includePartial} onIncludePartial={onIncludePartial}
              hasSelection={hasSelection}
              onChangeStyle={() => setShowStylePanel(true)} // Gap 6
              onDeleteSelected={onDeleteSelected}
            />
          );
        }
        break;
    }

    return (
      <div className={`ink-context-panel ${panelClosing ? 'panel-closing' : ''}`}>
        {content}
      </div>
    );
  };

  return (
    <>
      {/* Context panel (left of rail) */}
      {activePanel && renderPanel()}

      {/* Vertical icon rail */}
      <div className="ink-rail">
        {toolButtons.map(({ id, icon }) => (
          <button
            key={id}
            className={`ink-rail-btn ${tool === id ? 'active' : ''}`}
            onClick={() => handleToolClick(id)}
          >
            {icon}
          </button>
        ))}

        <div className="ink-rail-divider" />

        <button className="ink-rail-btn" onClick={onUndo}>
          {ICONS.undo}
        </button>

        <div className="ink-rail-divider" />

        <button className={`ink-rail-btn ${showGuide ? 'active' : ''}`} onClick={onToggleGuide}>
          {ICONS.guide}
        </button>

        <button className="ink-rail-btn ink-rail-done" onClick={onClose}>
          {ICONS.close}
        </button>
      </div>

      <style jsx global>{`
        /* ─── CSS Variables ──────────────────────────────── */
        :root {
          --ink-rail-bg: rgba(255, 255, 255, 0.95);
          --ink-rail-border: rgba(0, 0, 0, 0.07);
          --ink-active-bg: rgba(59, 130, 246, 0.10);
          --ink-active-border: #3b82f6;
          --ink-panel-bg: rgba(255, 255, 255, 0.97);
          --ink-panel-shadow: 0 8px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.05);
          --ink-track-inactive: #e5e7eb;
          --ink-danger: #dc2626;
          --ink-danger-bg: #fff5f5;
          --ink-danger-border: #fecaca;
        }

        /* ─── Icon Rail ──────────────────────────────────── */
        .ink-rail {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 100;
          width: 52px;
          background: var(--ink-rail-bg);
          backdrop-filter: blur(16px);
          border: 1px solid var(--ink-rail-border);
          border-radius: 20px;
          padding: 8px 4px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          user-select: none;
        }

        .ink-rail-btn {
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 12px;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 120ms ease;
          border-left: 3px solid transparent;
          padding: 0;
        }
        .ink-rail-btn:hover {
          transform: scale(1.05);
          background: rgba(0,0,0,0.04);
        }
        .ink-rail-btn.active {
          background: var(--ink-active-bg);
          border-left-color: var(--ink-active-border);
          color: #1d4ed8;
        }
        .ink-rail-done {
          color: #ef4444;
        }
        .ink-rail-done:hover {
          background: rgba(239,68,68,0.08);
        }
        .ink-rail-divider {
          width: 28px;
          height: 1px;
          background: rgba(0,0,0,0.08);
          margin: 2px 0;
        }

        /* ─── Context Panel ──────────────────────────────── */
        .ink-context-panel {
          position: absolute;
          right: 68px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 99;
          width: 240px;
          background: var(--ink-panel-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--ink-rail-border);
          border-radius: 16px;
          box-shadow: var(--ink-panel-shadow);
          padding: 16px;
          animation: panelSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .ink-context-panel.panel-closing {
          animation: panelSlideOut 0.15s ease-in forwards;
        }
        .ink-panel-content {
          display: flex;
          flex-direction: column;
        }

        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateY(-50%) translateX(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0)    scale(1);    }
        }
        @keyframes panelSlideOut {
          from { opacity: 1; transform: translateY(-50%) translateX(0)   scale(1);    }
          to   { opacity: 0; transform: translateY(-50%) translateX(8px) scale(0.96); }
        }

        /* ─── Size / Opacity Slider ──────────────────────── */
        .ink-slider-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ink-step-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #f3f4f6;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          flex-shrink: 0;
          transition: background 120ms;
          touch-action: manipulation;
        }
        .ink-step-btn:hover { background: #e5e7eb; }
        .ink-step-btn:active { background: #d1d5db; }

        .ink-slider-track-wrap {
          flex: 1;
          position: relative;
          height: 28px;
          display: flex;
          align-items: center;
        }
        .ink-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          -webkit-appearance: none;
          appearance: none;
          background: linear-gradient(to right, var(--ink-track-inactive), var(--slider-color, #3b82f6));
          outline: none;
          cursor: pointer;
        }
        .ink-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
          border: none;
        }
        .ink-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
          border: none;
        }

        .ink-slider-value {
          width: 32px;
          text-align: right;
          font-size: 13px;
          font-variant-numeric: tabular-nums;
          color: #374151;
          flex-shrink: 0;
        }

        /* Opacity track checkered pattern */
        .ink-opacity-track {
          position: relative;
        }
        .ink-opacity-track::before {
          content: '';
          position: absolute;
          inset: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 6px;
          border-radius: 3px;
          background-image:
            linear-gradient(45deg, #d1d5db 25%, transparent 25%),
            linear-gradient(-45deg, #d1d5db 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #d1d5db 75%),
            linear-gradient(-45deg, transparent 75%, #d1d5db 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          z-index: 0;
        }
        .ink-opacity-overlay {
          position: absolute;
          inset: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 6px;
          border-radius: 3px;
          pointer-events: none;
          z-index: 1;
        }
        .ink-opacity-track .ink-slider {
          position: relative;
          z-index: 2;
          background: transparent;
        }

        /* ─── Color Grid ─────────────────────────────────── */
        .ink-color-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
        }
        .ink-swatch {
          position: relative;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 120ms;
          padding: 0;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ink-swatch:hover { transform: scale(1.15); }
        .ink-swatch.active {
          box-shadow: inset 0 0 0 2px white, 0 0 0 2px #3b82f6;
          transform: scale(1.1);
        }
        .ink-swatch-check {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Custom color row */
        .ink-custom-row {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }
        .ink-custom-slot {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          position: relative;
        }
        .ink-custom-eyedropper {
          background: #f9fafb;
          cursor: not-allowed;
          opacity: 0.5;
        }
        .ink-custom-rainbow {
          background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
          border: none;
          position: relative;
        }

        /* ─── Favorite Pens ──────────────────────────────── */
        .ink-fav-strip {
          display: flex;
          gap: 6px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .ink-fav-slot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid #e5e7eb;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          position: relative;
          transition: transform 120ms;
        }
        .ink-fav-slot:hover { transform: scale(1.1); }
        .ink-fav-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
        }
        .ink-fav-empty {
          border-style: dashed;
        }
        .ink-fav-delete {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          font-size: 10px;
          line-height: 16px;
          text-align: center;
          pointer-events: none;
        }

        /* ─── Radio / Toggle ─────────────────────────────── */
        .ink-radio-row {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          padding: 5px 0;
        }
        .ink-radio {
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .ink-radio-outer {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 120ms;
        }
        .ink-radio-row:hover .ink-radio-outer { border-color: #9ca3af; }
        .ink-radio-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #3b82f6;
        }
        .ink-radio-outer:has(.ink-radio-inner) { border-color: #3b82f6; }
        .ink-radio-label {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
        }

        .ink-toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
        }
        .ink-toggle {
          width: 40px;
          height: 24px;
          border-radius: 12px;
          background: #d1d5db;
          border: none;
          cursor: pointer;
          position: relative;
          padding: 0;
          transition: background 180ms;
          flex-shrink: 0;
        }
        .ink-toggle.on { background: #3b82f6; }
        .ink-toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          transition: transform 180ms;
        }
        .ink-toggle.on .ink-toggle-thumb { transform: translateX(16px); }

        /* ─── Eraser panel ───────────────────────────────── */
        .ink-panel-divider {
          height: 1px;
          background: rgba(0,0,0,0.08);
          border: none;
          margin: 12px 0;
          border-style: dashed;
        }
        .ink-erase-all {
          width: 100%;
          border: 1.5px solid var(--ink-danger-border);
          background: var(--ink-danger-bg);
          color: var(--ink-danger);
          border-radius: 10px;
          height: 38px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 120ms;
        }
        .ink-erase-all:hover { background: #fef2f2; }
        .ink-erase-all.pressing { transform: scale(0.96); }
      `}</style>
    </>
  );
}
