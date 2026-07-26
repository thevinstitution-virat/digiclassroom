'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HandwritingGuide
//
// Pure presentational component — no scroll logic lives here.
// Positioning (position: fixed + left/width) is injected via the `style` prop
// from RichTextEditor, which computes it via ResizeObserver on .sanchika-canvas.
// ─────────────────────────────────────────────────────────────────────────────

export interface HandwritingGuideProps {
  active: boolean;
  lineIndex: number;
  /** Pass editor.state.doc.childCount so arrows can disable at bounds */
  totalLines: number;
  onPrev: () => void;
  onNext: () => void;
  /** Injected by RichTextEditor for position:fixed placement */
  style?: React.CSSProperties;
}

function ChevronLeft({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5"
        stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRight({ c }: { c: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5"
        stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function HandwritingGuide({
  active,
  lineIndex,
  totalLines,
  onPrev,
  onNext,
  style,
}: HandwritingGuideProps) {
  if (!active) return null;

  const canPrev = lineIndex > 0;
  const canNext = totalLines > 0 && lineIndex < totalLines - 1;

  const arrowStyle = (enabled: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: enabled ? 'rgba(59,130,246,0.10)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: enabled ? 'pointer' : 'default',
    flexShrink: 0,
    padding: 0,
    transition: 'background 120ms',
  });

  return (
    <div
      style={{
        // Base layout — position coordinates injected via props.style
        height: 80,
        background: 'rgba(248,250,252,0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(59,130,246,0.20)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        pointerEvents: 'auto',
        zIndex: 30,
        // Parent injects: { position: 'fixed', bottom: 0, left: X, width: W }
        ...style,
      }}
    >
      {/* Prev line button */}
      <button
        onClick={canPrev ? onPrev : undefined}
        disabled={!canPrev}
        style={arrowStyle(canPrev)}
        onMouseEnter={e => {
          if (canPrev) e.currentTarget.style.background = 'rgba(59,130,246,0.18)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = canPrev ? 'rgba(59,130,246,0.10)' : 'transparent';
        }}
      >
        <ChevronLeft c={canPrev ? '#3b82f6' : '#d1d5db'} />
      </button>

      {/* Centre: ruled line + hint text */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {/* The ruler line */}
        <div
          style={{
            width: '80%',
            height: 1,
            background: '#93c5fd',
            borderRadius: 1,
          }}
        />
        {/* Hint */}
        <span
          style={{
            fontSize: 11,
            color: '#9ca3af',
            textAlign: 'center',
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Write here to align handwriting above
          {totalLines > 0 && (
            <> — line {lineIndex + 1} of {totalLines}</>
          )}
        </span>
      </div>

      {/* Next line button */}
      <button
        onClick={canNext ? onNext : undefined}
        disabled={!canNext}
        style={arrowStyle(canNext)}
        onMouseEnter={e => {
          if (canNext) e.currentTarget.style.background = 'rgba(59,130,246,0.18)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = canNext ? 'rgba(59,130,246,0.10)' : 'transparent';
        }}
      >
        <ChevronRight c={canNext ? '#3b82f6' : '#d1d5db'} />
      </button>
    </div>
  );
}
