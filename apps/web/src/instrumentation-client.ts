import * as Sentry from '@sentry/nextjs'

// Browser error tracking. NEXT_PUBLIC_SENTRY_DSN is inlined at build (see the
// Dockerfile ARG); a no-op when absent.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    // Errors only — no tracing, no session replay.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}

// Deliberate test error for end-to-end verification: load any page with
// ?sentry-test to report one client error. Safe to remove once confirmed.
if (
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('sentry-test')
) {
  Sentry.captureException(
    new Error('GlitchTip test error — dgcl-frontend (safe to ignore)'),
  )
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
