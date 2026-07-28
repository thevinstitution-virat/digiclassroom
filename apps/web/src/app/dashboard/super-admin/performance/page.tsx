import { Metadata } from 'next'
import PerformanceDashboard from '@/components/admin/PerformanceDashboard'

export const metadata: Metadata = {
  title: 'Performance Dashboard - VG Kosh Admin',
  description: 'Monitor system performance, startup times, and optimization metrics',
}

export default function PerformancePage() {
  // Authentication and admin role checking is handled by the layout.tsx
  return (
    <div className="container mx-auto py-6">
      <PerformanceDashboard />
    </div>
  )
}

