'use client'

import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2 } from 'lucide-react'

/**
 * IndicConfirmDialog — the reusable confirmation / destructive dialog from the
 * redesign's "Dialogs" pattern (DigiClassroom Auth.dc.html). One Indic card
 * treatment for the whole app: a plinth icon on a gradient, centred title +
 * body, then Cancel + a gradient CTA. `variant` swaps the gradient/CTA tone:
 *   - confirm     → kumkum → saffron   (default, e.g. "Sign out?")
 *   - destructive → kumkum → lotus     (e.g. "Delete this item?")
 *
 * Built directly on the radix Dialog primitive (not the app's DialogContent,
 * which hardcodes a white surface and a forced close-X) so the card matches the
 * mock exactly, while still getting overlay, focus-trap, Esc and scroll-lock.
 * Surfaces are warm via indic-bridge.css, so bg-card already reads as parchment.
 */
export function IndicConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'confirm',
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  icon: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'confirm' | 'destructive'
  loading?: boolean
  onConfirm: () => void
}) {
  const gradient =
    variant === 'destructive'
      ? 'linear-gradient(135deg,var(--kumkum),var(--lotus-deep))'
      : 'linear-gradient(135deg,var(--kumkum),var(--saffron))'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[rgb(10_15_30_/_0.55)] backdrop-blur-[4px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[81] w-[calc(100vw-44px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_40px_90px_-40px_rgba(0,0,0,0.6)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="px-7 pb-5 pt-7 text-center">
            <span
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] text-white shadow-[0_10px_22px_-10px_rgba(255,107,53,0.6)]"
              style={{ background: gradient }}
            >
              {icon}
            </span>
            <DialogPrimitive.Title className="text-xl font-extrabold text-foreground [font-family:var(--font-body)]">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          </div>
          <div className="flex gap-3 px-7 pb-7">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-[14px] border border-border bg-card py-3 font-bold text-foreground transition-all hover:border-primary/40 hover:bg-secondary"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3 font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
              style={{ background: gradient }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
