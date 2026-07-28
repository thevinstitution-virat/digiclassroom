import { redirect } from 'next/navigation'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'
import { Flag } from 'lucide-react'
import FeatureFlagClient from './FeatureFlagClient'

// Platform-owner only.
export default async function AdminFeatureFlagsPage() {
  const ctx = await getOrgContextOrNull()
  if (ctx?.globalRole !== 'super_admin') redirect('/dashboard/super-admin')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feature Flags</h1>
        <p className="text-muted-foreground mt-2">
          Toggle platform features and rollouts per institution.
        </p>
      </div>
      
      <FeatureFlagClient />
    </div>
  )
}
