import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { User } from 'lucide-react'

export default function ParentProfilePage() {
  return (
    <DashboardPlaceholder
      title="Profile & Settings"
      description="Your account details, linked children, and notification settings."
      icon={User}
      points={['Account details', 'Linked children / guardianship', 'Notifications & preferences']}
    />
  )
}
