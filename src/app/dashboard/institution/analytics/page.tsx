import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { LineChart } from 'lucide-react'

export default function InstitutionAnalyticsPage() {
  return (
    <DashboardPlaceholder
      title="Institution Analytics"
      description="Engagement and performance across your institution's classes and students."
      icon={LineChart}
      points={['Active students & usage', 'Class-level performance', 'AI tutor & practest activity']}
    />
  )
}
