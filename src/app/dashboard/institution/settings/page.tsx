import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { Settings } from 'lucide-react'

export default function InstitutionSettingsPage() {
  return (
    <DashboardPlaceholder
      title="Institution Settings"
      description="Your institution's profile, branding, academic year, and preferences."
      icon={Settings}
      points={['Institution profile & logo', 'Academic year & terms', 'Admin preferences']}
    />
  )
}
