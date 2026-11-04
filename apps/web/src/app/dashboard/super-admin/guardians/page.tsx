'use client'

// Platform owner (B2C): invite the parent or guardian of a student who joined as an independent learner (no institution).

import { GuardianInvites } from '@/components/guardian/GuardianInvites'
import { useHwT } from '@/components/hw/strings'

export default function SuperAdminGuardiansPage() {
  const { t } = useHwT()
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('gi.title')}</h1>
      <GuardianInvites mode="independent" />
    </div>
  )
}
