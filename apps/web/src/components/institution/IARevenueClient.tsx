'use client'

import { api } from '@/lib/trpc/client'
import { formatPaise } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { TrendingUp, IndianRupee, CreditCard } from 'lucide-react'

const chartConfig = {
  institutionPaise:  { label: 'Your Earnings', color: 'var(--color-teal-500)' },
}

function KpiCard({
  label, value, sub, icon: Icon,
}: { label: string; value: string; sub?: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function IARevenueClient() {
  const { data, isLoading, isError } = api.institutionAdmin.getRevenueAnalytics.useQuery()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <p className="text-center py-20 text-sm text-destructive">
        Failed to load revenue data.
      </p>
    )
  }

  const chartData = data.monthly.map(r => ({
    month:            r.month,
    institutionPaise: Number(r.institutionPaise) / 100,
  }))

  return (
    <div className="space-y-6 mt-8">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Your Earnings (All-Time)"
          value={formatPaise(data.allTime.institutionPaise)}
          sub={`${data.allTime.paymentCount} transactions`}
          icon={IndianRupee}
        />
        <KpiCard
          label="This Month"
          value={formatPaise(data.thisMonth.institutionPaise)}
          sub={`${data.thisMonth.paymentCount} transactions`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Students Paid"
          value={String(data.allTime.paymentCount)}
          sub="Total successful payments"
          icon={CreditCard}
        />
      </div>

      {/* Monthly Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Monthly Revenue — Last 12 Months
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickFormatter={m => m.slice(5)} // show 'MM' only
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                  width={52}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `₹${Number(value).toLocaleString('en-IN')}`,
                    chartConfig[name as keyof typeof chartConfig]?.label ?? name,
                  ]}
                  labelFormatter={(label) => `Month: ${label}`}
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                />
                <Bar dataKey="institutionPaise" stackId="a" fill="#14b8a6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By-Batch Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Revenue by Batch
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Batch Name</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Collected (Your Cut)</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {data.byBatch.map(batch => (
                  <tr key={batch.batchId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{batch.batchName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-teal-600 font-medium">{formatPaise(Number(batch.institutionPaise))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{batch.paymentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
