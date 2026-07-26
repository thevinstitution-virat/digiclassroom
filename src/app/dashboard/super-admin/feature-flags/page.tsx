import { redirect } from 'next/navigation'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { Flag } from 'lucide-react'

// Platform-owner only.
export default async function AdminFeatureFlagsPage() {
  const ctx = await getOrgContextOrNull()
  if (ctx?.globalRole !== 'super_admin') redirect('/dashboard/super-admin')

  return (
    <DashboardPlaceholder
      title="Feature Flags"
      description="Toggle platform features and rollouts. Mirrors src/lib/config/feature-flags.ts."
      icon={Flag}
      points={['useLangGraph, useEnhancedValidation, enableHybridSearch', 'MT_RBAC_ENFORCEMENT', 'Langfuse tracing']}
    />
  )
}
