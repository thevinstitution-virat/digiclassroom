// src/components/dashboard/DashboardPlaceholder.tsx
// Shared "feature surface exists, full build coming" placeholder. Rides the Indic
// `.dcd` shell primitives (.card / .plinth) and design tokens so it matches the
// role home pages in both light and dark. Presentation only — carries no data.

import type { ComponentType } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface DashboardPlaceholderProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  /** Optional bullet list of what this feature will include. */
  points?: string[];
}

export default function DashboardPlaceholder({
  title,
  description,
  icon: Icon,
  points,
}: DashboardPlaceholderProps) {
  return (
    <div style={{ display: 'flex', minHeight: '72vh', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div
        className="card"
        style={{ position: 'relative', width: '100%', maxWidth: 520, padding: 'clamp(28px,4vw,40px)', textAlign: 'center' }}
      >
        {/* gradient halo (turmeric → saffron), off under reduced-motion via tokens only */}
        <div
          aria-hidden="true"
          style={{
            pointerEvents: 'none', position: 'absolute', insetInline: 0, top: -96, margin: '0 auto',
            height: 192, width: 192, borderRadius: '50%', filter: 'blur(56px)',
            background: 'radial-gradient(circle, rgb(var(--saffron-rgb) / 0.28), rgb(var(--turmeric-rgb) / 0.18) 60%, transparent 72%)',
          }}
        />

        <div style={{ position: 'relative' }}>
          <span
            className="plinth"
            style={{ width: 64, height: 64, margin: '0 auto 20px', background: 'linear-gradient(135deg,var(--kumkum),var(--saffron))' }}
          >
            {Icon ? <Icon className="h-8 w-8" /> : <span style={{ fontSize: 24 }}>📋</span>}
          </span>

          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
              borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700,
              border: '1px solid rgb(var(--turmeric-rgb) / 0.28)',
              background: 'rgb(var(--turmeric-rgb) / 0.10)', color: 'var(--accent-strong)',
            }}
          >
            <span className="dotpulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--turmeric)' }} />
            Coming soon
          </div>

          <h1 style={{ margin: 0, fontSize: 'clamp(22px,2.6vw,26px)', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)' }}>
            {title}
          </h1>
          <p style={{ margin: '12px auto 0', maxWidth: 420, fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>
            {description}
          </p>

          {points && points.length > 0 && (
            <ul style={{ margin: '32px auto 0', maxWidth: 380, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
              {points.map((p) => (
                <li
                  key={p}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel-2)',
                    padding: '10px 16px', fontSize: 14, color: 'var(--muted)',
                  }}
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--emerald)' }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
