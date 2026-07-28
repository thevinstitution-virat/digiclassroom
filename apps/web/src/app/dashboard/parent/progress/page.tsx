import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { LineChart } from 'lucide-react'

export default function ParentProgressPage() {
  return (
    <DashboardPlaceholder
      title="Child Progress"
      description="A clear view of your child's learning progress, subject mastery, and test scores."
      icon={LineChart}
      points={['Per-subject mastery & trends', 'Practest scores over time', 'Strengths and focus areas']}
    />
  )
}
