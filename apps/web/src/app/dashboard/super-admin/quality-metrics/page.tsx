/**
 * Admin Quality Metrics Page
 * Route: /dashboard/super-admin/quality-metrics
 * 
 * Displays the Quality Metrics Dashboard for monitoring AI answer quality
 */

import QualityMetricsDashboard from '@/components/admin/QualityMetricsDashboard'

export const metadata = {
  title: 'Quality Metrics | Admin Dashboard',
  description: 'Monitor AI answer quality and performance metrics'
}

export default function QualityMetricsPage() {
  return <QualityMetricsDashboard />
}

