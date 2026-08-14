'use client';

import { SlidersHorizontal, LayoutGrid } from 'lucide-react';

/**
 * Practest mode toggle — the mock's segmented control (a pill-group inside a
 * panel-2 track). Renders within the practest page's `.dcs` scope.
 */
export function BatchModeSelector({ mode, setMode }: { mode: 'general' | 'batch', setMode: (m: 'general' | 'batch') => void }) {
  const modes: Array<{ id: 'general' | 'batch'; label: string; Icon: typeof SlidersHorizontal }> = [
    { id: 'general', label: 'General', Icon: SlidersHorizontal },
    { id: 'batch', label: 'Batch quizzes', Icon: LayoutGrid },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 3, padding: 4, borderRadius: 14, background: 'var(--panel-2)', border: '1px solid var(--line-soft)', width: 'fit-content', margin: '0 auto' }}>
      {modes.map(({ id, label, Icon }) => {
        const on = mode === id;
        return (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              padding: '9px 22px', borderRadius: 11, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13.5,
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: on ? 'linear-gradient(135deg,var(--kumkum),var(--saffron))' : 'transparent',
              color: on ? '#fff' : 'var(--muted)',
            }}
          >
            <Icon className="h-[17px] w-[17px]" />{label}
          </button>
        );
      })}
    </div>
  );
}
