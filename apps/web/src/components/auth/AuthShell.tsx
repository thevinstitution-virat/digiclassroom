'use client'

import type { ReactNode } from 'react'

/**
 * AuthShell — the single centered auth card on a warm-Indic radial page.
 *
 * The redesign deliberately drops the two-column brand aside and the large
 * lotus mandala that the shared (synced) AuthBackdrop provides, for a clean,
 * focused auth. So this is an APP-LOCAL shell rather than the vendored motif:
 * a warm cream page (bg-background, now Indic via indic-bridge.css) with the
 * mock's two radial washes — turmeric top-right, peacock bottom-left — behind
 * one raised parchment card.
 *
 * The title is forced to the body face at weight 800: the global h1 rule
 * (indic-design-system.css) puts headings in the Yatra One display face, but
 * the mock's auth heading is Plus Jakarta Sans — a class beats the element
 * selector, so the two utilities below win without touching the global rule.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(40rem 32rem at 80% -10%, rgb(var(--accent-primary-rgb) / 0.12), transparent 60%), radial-gradient(38rem 30rem at 0% 110%, rgb(var(--peacock-teal-rgb) / 0.08), transparent 60%)',
        }}
      />
      <div className="relative w-full max-w-[440px] animate-scale-in rounded-[24px] border border-border bg-card p-7 shadow-elev-3 motion-reduce:animate-none sm:p-9">
        <div className="mb-6 text-center">
          <h1 className="text-[clamp(24px,3vw,29px)] font-extrabold tracking-tight text-foreground [font-family:var(--font-body)]">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-[14.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
