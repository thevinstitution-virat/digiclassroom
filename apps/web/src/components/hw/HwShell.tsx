'use client'

// Page frame for every Handwritten Assignments screen: title, language switch, and the
// feature gate (switched off / not in an institution) so no page renders half-working.

import type { ReactNode } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useHwT, type HwKey } from './strings'

export function useHwStatus() {
  return api.hw.status.useQuery(undefined, { staleTime: 60_000, retry: false })
}

export function HwLanguageToggle() {
  const { t, lang, setLang } = useHwT()
  return (
    <Button variant="outline" size="sm" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Language">
      {t('lang.toggle')}
    </Button>
  )
}

export function HwMessage({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <Card className={tone === 'error' ? 'border-red-300 dark:border-red-800' : undefined}>
      <CardContent className="flex items-start gap-3 py-6 text-sm">
        {tone === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />}
        <div>{children}</div>
      </CardContent>
    </Card>
  )
}

export function HwLoading() {
  const { t } = useHwT()
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('common.loading')}
    </div>
  )
}

export function HwError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useHwT()
  return (
    <HwMessage tone="error">
      <p>{t('common.error', { msg: message })}</p>
      {onRetry && <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>{t('common.retry')}</Button>}
    </HwMessage>
  )
}

interface HwShellProps {
  titleKey?: HwKey
  title?: string
  subtitle?: string
  actions?: ReactNode
  /** Roles that may use this page; others see a message instead of the page. */
  roles: ('admin' | 'teacher' | 'student')[]
  children: ReactNode
}

export function HwShell({ titleKey = 'app.title', title, subtitle, actions, roles, children }: HwShellProps) {
  const { t } = useHwT()
  const status = useHwStatus()

  let body: ReactNode = children
  if (status.isLoading) body = <HwLoading />
  else if (status.error) body = <HwError message={status.error.message} onRetry={() => status.refetch()} />
  else if (!status.data?.orgId) body = <HwMessage>{t('app.noOrg')}</HwMessage>
  else if (!status.data.enabled) body = <HwMessage>{t('app.off')}</HwMessage>
  else if (!roles.includes(status.data.role as never)) body = <HwMessage>{t('app.noAccess')}</HwMessage>

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title ?? t(titleKey)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle ?? t('app.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <HwLanguageToggle />
        </div>
      </div>
      {body}
    </div>
  )
}
