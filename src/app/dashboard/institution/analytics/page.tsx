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
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/50">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Revenue Analytics</h2>
        <p className="text-sm text-gray-500 mb-6">Your institution's captured payments (net of platform fees)</p>
        <IARevenueClient />
      </div>
    </div>
  )
}
