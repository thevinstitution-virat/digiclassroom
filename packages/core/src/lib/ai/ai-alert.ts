import * as Sentry from '@sentry/nextjs'

/**
 * An OpenAI call failed: sent to GlitchTip as its own issue, tagged `ai_provider: openai`, so the project's alert rule
 * forwards it to Telegram (via gt-telegram-relay) at once. One issue per feature and status (fingerprint), so an outage
 * is one alert, not thousands. A request the student cancelled is not a failure and is not reported.
 */
export function reportAiFailure(feature: string, err: unknown, extra: Record<string, unknown> = {}): void {
  if (isAbort(err)) return
  const e = err as any
  const status = String(e?.status ?? /(\d{3})/.exec(String(e?.message ?? ''))?.[1] ?? 'network')
  try {
    Sentry.withScope((scope) => {
      scope.setLevel('error')
      scope.setTag('ai_provider', 'openai')
      scope.setTag('ai_feature', feature)
      scope.setTag('ai_status', status)
      scope.setFingerprint(['openai-failure', feature, status])
      scope.setExtras(extra)
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
    })
  } catch {
    // Reporting must never break the request that failed.
  }
}

export function isAbort(err: unknown): boolean {
  const e = err as any
  return e?.name === 'AbortError' || e?.code === 'ABORT_ERR' || /aborted/i.test(String(e?.message ?? ''))
}
