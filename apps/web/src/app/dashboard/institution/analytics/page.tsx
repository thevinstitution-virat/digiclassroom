import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import { LineChart } from 'lucide-react'
import { IARevenueClient } from '@/components/institution/IARevenueClient'

export default function InstitutionAnalyticsPage() {
  return (
    <div className="space-y-8">
      <DashboardPlaceholder
        title="Institution Analytics"
        description="Engagement and performance across your institution's classes and students."
        icon={LineChart}
        points={['Active students & usage', 'Class-level performance', 'AI tutor & practest activity']}
      />

      {/* Revenue Analytics Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-2">Revenue Analytics</h2>
        <p className="text-sm text-muted-foreground mb-6">Your institution's captured payments (net of platform fees)</p>
        <IARevenueClient />
      </div>
    </div>
  )
}
