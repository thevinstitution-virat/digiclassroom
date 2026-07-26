import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { CalendarCheck } from 'lucide-react'

export default function ParentAttendancePage() {
  return (
    <DashboardPlaceholder
      title="Attendance & Engagement"
      description="Track your child's study consistency, session activity, and class attendance."
      icon={CalendarCheck}
      points={['Daily / weekly study streaks', 'Session activity log', 'Class attendance (institutional)']}
    />
  )
}
