'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  description?: string
  className?: string
}

export function StatCard({ 
  icon: Icon, 
  title, 
  value, 
  change, 
  changeType = 'neutral',
  description,
  className
}: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
    negative: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
    neutral: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700'
  }

  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-orange-200 dark:hover:border-orange-800",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-100 to-blue-100 dark:from-orange-900/20 dark:to-blue-900/20 rounded-lg">
            <Icon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          </div>
        </div>
        {change && (
          <div className={cn("px-2 py-1 rounded-full text-xs font-medium", changeColors[changeType])}>
            {change}
          </div>
        )}
      </div>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{description}</p>
      )}
    </div>
  )
}

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
  }
  color?: 'orange' | 'blue' | 'green' | 'red' | 'purple'
}

export function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  color = 'orange'
}: MetricCardProps) {
  const colorClasses = {
    orange: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20',
    blue: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
    green: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
    red: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20',
    purple: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20'
  }

  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
            {trend && (
              <span className={cn("text-xs font-medium", trendColors[trend.direction])}>
                {trend.value}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
