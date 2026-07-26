import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { MessageSquare } from 'lucide-react'

export default function ParentMessagesPage() {
  return (
    <DashboardPlaceholder
      title="School Communication"
      description="Messages and announcements from your child's teachers and institution."
      icon={MessageSquare}
      points={['Teacher & institution announcements', 'Direct messages', 'Notification preferences']}
    />
  )
}
