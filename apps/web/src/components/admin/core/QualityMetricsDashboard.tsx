'use client'

/**
 * Quality Metrics Dashboard
 * Real-time monitoring of AI answer quality and performance
 * 
 * Features:
 * - 8 key quality metrics with color-coded status
 * - Time window selector (1h, 24h, 7d, 30d)
 * - Auto-refresh toggle (60-second interval)
 * - Active alerts panel
 * - Performance breakdown chart
 * - Trend charts for user rating, faithfulness, relevance
 * - Responsive design with dark mode support
 */

import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface QualityMetrics {
  timeWindow: string
  metrics: {
    avgUserRating: number
    avgFaithfulness: number
    avgRelevance: number
    avgResponseTime: number
    totalAnswers: number
    cacheHitRate: number
    alertCount: number
    satisfactionRate: number
  }
  alerts: Array<{
    alertId: string
    type: string
    severity: string
    message: string
    createdAt: string
    feedbackId: string
  }>
  performanceBreakdown: {
    queryAnalysis: number
    embedding: number
    retrieval: number
    reranking: number
    generation: number
    ragas: number
    caching: number
    postProcessing: number
  }
  trends: {
    userRating: Array<{ date: string; value: number }>
    faithfulness: Array<{ date: string; value: number }>
    relevance: Array<{ date: string; value: number }>
  }
}

export default function QualityMetricsDashboard() {
  const [timeWindow, setTimeWindow] = useState('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [data, setData] = useState<QualityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/super-admin/quality-metrics?window=${timeWindow}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      
      const metrics = await response.json()
      setData(metrics)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchMetrics()
  }, [timeWindow])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchMetrics()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, timeWindow])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-muted-foreground">Loading metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (!data)
  return null

  // Helper function to get status color
  const getStatusColor = (value: number, metric: string): string => {
    if (metric === 'avgUserRating') {
      if (value >= 4.5)
  return 'text-green-600 dark:text-green-400'
      if (value >= 3.5)
  return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    }
    if (metric === 'avgFaithfulness' || metric === 'avgRelevance') {
      if (value >= 0.8)
  return 'text-green-600 dark:text-green-400'
      if (value >= 0.7)
  return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    }
    if (metric === 'avgResponseTime') {
      if (value <= 3000)
  return 'text-green-600 dark:text-green-400'
      if (value <= 5000)
  return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    }
    if (metric === 'cacheHitRate' || metric === 'satisfactionRate') {
      if (value >= 0.7)
  return 'text-green-600 dark:text-green-400'
      if (value >= 0.5)
  return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    }
    return 'text-muted-foreground'
  }

  // Performance breakdown chart data
  const performanceChartData = {
    labels: ['Query', 'Embedding', 'Retrieval', 'Reranking', 'Generation', 'RAGAS', 'Caching', 'Post-Proc'],
    datasets: [
      {
        label: 'Time (ms)',
        data: [
          data.performanceBreakdown.queryAnalysis,
          data.performanceBreakdown.embedding,
          data.performanceBreakdown.retrieval,
          data.performanceBreakdown.reranking,
          data.performanceBreakdown.generation,
          data.performanceBreakdown.ragas,
          data.performanceBreakdown.caching,
          data.performanceBreakdown.postProcessing
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }
    ]
  }

  // Trend chart data
  const trendChartData = {
    labels: data.trends.userRating.map(d => d.date),
    datasets: [
      {
        label: 'User Rating',
        data: data.trends.userRating.map(d => d.value),
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4
      },
      {
        label: 'Faithfulness',
        data: data.trends.faithfulness.map(d => d.value),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      },
      {
        label: 'Relevance',
        data: data.trends.relevance.map(d => d.value),
        borderColor: 'rgba(168, 85, 247, 1)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.4
      }
    ]
  }

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">
          Quality Metrics Dashboard
        </h1>
        
        <div className="flex gap-4 items-center">
          {/* Time Window Selector */}
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg bg-card text-foreground"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          {/* Auto-refresh Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-foreground">Auto-refresh (60s)</span>
          </label>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card: Avg User Rating */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Avg User Rating</div>
          <div className={`text-3xl font-bold ${getStatusColor(data.metrics.avgUserRating, 'avgUserRating')}`}>
            {data.metrics.avgUserRating} / 5.0
          </div>
        </div>

        {/* Metric Card: Avg Faithfulness */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Avg Faithfulness</div>
          <div className={`text-3xl font-bold ${getStatusColor(data.metrics.avgFaithfulness, 'avgFaithfulness')}`}>
            {data.metrics.avgFaithfulness}
          </div>
        </div>

        {/* Metric Card: Avg Relevance */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Avg Relevance</div>
          <div className={`text-3xl font-bold ${getStatusColor(data.metrics.avgRelevance, 'avgRelevance')}`}>
            {data.metrics.avgRelevance}
          </div>
        </div>

        {/* Metric Card: Avg Response Time */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Avg Response Time</div>
          <div className={`text-3xl font-bold ${getStatusColor(data.metrics.avgResponseTime, 'avgResponseTime')}`}>
            {data.metrics.avgResponseTime}ms
          </div>
        </div>

        {/* Metric Card: Total Answers */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Total Answers</div>
          <div className="text-3xl font-bold text-foreground">
            {data.metrics.totalAnswers}
          </div>
        </div>

        {/* Metric Card: Cache Hit Rate */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Cache Hit Rate</div>
          <div className={`text-3xl font-bold ${getStatusColor(data.metrics.cacheHitRate, 'cacheHitRate')}`}>
            {(data.metrics.cacheHitRate * 100).toFixed(1)}%
          </div>
        </div>

        {/* Metric Card: Active Alerts */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Active Alerts</div>
          <div className={`text-3xl font-bold ${data.metrics.alertCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {data.metrics.alertCount}
          </div>
        </div>

        {/* Metric Card: Satisfaction Rate */}
        <div className="bg-card p-6 rounded-lg shadow">
          <div className="text-sm text-muted-foreground mb-2">Satisfaction Rate</div>
          <div className={`text-3xl font-bold ${getStatusColor(data.metrics.satisfactionRate, 'satisfactionRate')}`}>
            {(data.metrics.satisfactionRate * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Breakdown Chart */}
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Performance Breakdown
          </h2>
          <Bar data={performanceChartData} options={{ responsive: true, maintainAspectRatio: true }} />
        </div>

        {/* Trend Chart */}
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Quality Trends
          </h2>
          <Line data={trendChartData} options={{ responsive: true, maintainAspectRatio: true }} />
        </div>
      </div>

      {/* Active Alerts Panel */}
      {data.alerts.length > 0 && (
        <div className="bg-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Active Alerts ({data.alerts.length})
          </h2>
          <div className="space-y-2">
            {data.alerts.map((alert) => (
              <div
                key={alert.alertId}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'high'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-foreground">
                      {alert.type.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {alert.message}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

