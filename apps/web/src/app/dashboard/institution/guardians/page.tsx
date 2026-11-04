'use client'

// Institution admin (B2B): invite the parent or guardian of a student of this institution.

import { GuardianInvites } from '@/components/guardian/GuardianInvites'
import { useHwT } from '@/components/hw/strings'

export default function InstitutionGuardiansPage() {
  const { t } = useHwT()
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('gi.title')}</h1>
      <GuardianInvites mode="institution" />
    </div>
  )
}
