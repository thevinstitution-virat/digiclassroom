import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { FileText } from 'lucide-react'

export default function InstitutionContentPage() {
  return (
    <DashboardPlaceholder
      title="Institution Content"
      description="Upload and manage study materials scoped to your institution's students."
      icon={FileText}
      points={['Upload org-private materials', 'Organize by class & subject', 'Control student access']}
    />
  )
}
