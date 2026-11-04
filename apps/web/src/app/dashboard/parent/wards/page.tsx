'use client'

// Guardian: the children linked to this account, across institutions and independent learners.
// Per-child progress and syllabus insight pages build on this list; the written assignments page is the first of them.

import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { Card, CardContent } from '@/components/ui/card'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'
import { useHwT } from '@/components/hw/strings'

export default function ParentWardsPage() {
  const { t, lang } = useHwT()
  const on = api.guardian.enabled.useQuery()
  const wards = api.guardian.wards.useQuery(undefined, { enabled: on.data?.enabled === true, retry: false })
  const fmt = (d: Date | string) => new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' })
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('gw.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('gw.subtitle')}</p>
      </div>
      {on.isLoading || wards.isLoading ? <HwLoading /> : !on.data?.enabled ? <HwMessage>{t('gi.off')}</HwMessage>
        : wards.error ? <HwError message={wards.error.message} onRetry={() => wards.refetch()} />
        : !wards.data?.length ? <HwMessage>{t('gw.none')}</HwMessage> : (
          <ul className="space-y-3">
            {wards.data.map((w) => (
              <li key={w.linkId}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <div>
                      <p className="text-base font-semibold">{w.name}</p>
                      <p className="text-muted-foreground">{w.organizationName ? t('gw.school', { org: w.organizationName }) : t('gw.independent')} · {t('gw.since', { date: fmt(w.since) })}</p>
                    </div>
                    {w.organizationId && <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/dashboard/parent/assignments">{t('gw.assignments')}</Link>}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
