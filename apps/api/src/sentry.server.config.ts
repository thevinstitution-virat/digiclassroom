import * as Sentry from '@sentry/nextjs'

// Server-side error tracking for the headless API. DSN is injected at runtime
// via SENTRY_DSN (Coolify); absent locally, so init() is skipped.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    // Errors are tracked in GlitchTip; performance tracing is left off.
    tracesSampleRate: 0,
  })
}
