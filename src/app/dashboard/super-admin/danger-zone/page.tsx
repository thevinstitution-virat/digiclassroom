import { redirect } from 'next/navigation'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { AlertTriangle } from 'lucide-react'

// Platform-owner only — destructive operations.
export default async function AdminDangerZonePage() {
  const ctx = await getOrgContextOrNull()
  if (ctx?.globalRole !== 'super_admin') redirect('/dashboard/super-admin')

  return (
    <DashboardPlaceholder
      title="Danger Zone"
      description="Destructive, irreversible platform operations — super_admin only, with confirmation gates."
      icon={AlertTriangle}
      points={['Clear / rebuild Qdrant collection', 'Purge caches', 'Bulk data operations']}
    />
  )
}
