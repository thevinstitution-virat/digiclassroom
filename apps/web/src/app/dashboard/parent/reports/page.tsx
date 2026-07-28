import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { FileText } from 'lucide-react'

export default function ParentReportsPage() {
  return (
    <DashboardPlaceholder
      title="ParentPulse Reports"
      description="Periodic AI-generated summaries of your child's activity, effort, and wellbeing."
      icon={FileText}
      points={['Weekly / monthly summaries', 'Effort & engagement signals', 'Actionable recommendations']}
    />
  )
}
