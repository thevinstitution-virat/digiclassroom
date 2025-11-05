'use client'

import * as React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface SegmentedThemeToggleProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ThemeToggle({ className, size = 'md' }: SegmentedThemeToggleProps) {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn(
        'inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm',
        size === 'sm' && 'h-8',
        size === 'md' && 'h-10',
        size === 'lg' && 'h-12',
        className
      )}>
        <div className="flex animate-pulse">
          <div className="w-16 h-full bg-gray-200 dark:bg-gray-700 rounded-l-lg" />
          <div className="w-16 h-full bg-gray-200 dark:bg-gray-700" />
          <div className="w-16 h-full bg-gray-200 dark:bg-gray-700 rounded-r-lg" />
        </div>
      </div>
    )
  }

  const segments = [
    {
      id: 'light',
      label: 'Light',
      icon: Sun,
      ariaLabel: 'Switch to light mode'
    },
    {
      id: 'system',
      label: 'System',
      icon: Monitor,
      ariaLabel: 'Use system theme'
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: Moon,
      ariaLabel: 'Switch to dark mode'
    }
  ]

  const getSegmentClasses = (segmentId: string, index: number) => {
    const isActive = theme === segmentId
    const isFirst = index === 0
    const isLast = index === segments.length - 1

    return cn(
      // Base styles
      'relative flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-300 cursor-pointer',
      'border-r border-gray-200 dark:border-gray-700 last:border-r-0',
      'hover:bg-gray-50 dark:hover:bg-gray-700/50',
      'focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:z-10',

      // Size variants
      size === 'sm' && 'px-2 py-1 text-xs gap-1',
      size === 'md' && 'px-3 py-2 text-sm gap-2',
      size === 'lg' && 'px-4 py-3 text-base gap-2',

      // Border radius
      isFirst && 'rounded-l-lg',
      isLast && 'rounded-r-lg',

      // Active state
      isActive && [
        'bg-gradient-to-r from-orange-500 to-blue-500',
        'text-white shadow-lg',
        'hover:from-orange-600 hover:to-blue-600',
        'transform scale-[1.02] z-10'
      ],

      // Inactive state
      !isActive && [
        'text-gray-700 dark:text-gray-300',
        'hover:text-gray-900 dark:hover:text-white'
      ]
    )
  }

  const getIconClasses = (segmentId: string) => {
    const isActive = theme === segmentId

    return cn(
      'transition-all duration-300',
      size === 'sm' && 'h-3 w-3',
      size === 'md' && 'h-4 w-4',
      size === 'lg' && 'h-5 w-5',

      // Icon colors
      !isActive && segmentId === 'light' && 'text-orange-500',
      !isActive && segmentId === 'dark' && 'text-blue-500',
      !isActive && segmentId === 'system' && 'text-gray-500 dark:text-gray-400',

      // Active state - white icons
      isActive && 'text-white'
    )
  }

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border-2 border-gray-200 dark:border-gray-700',
        'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm',
        'shadow-sm hover:shadow-md transition-shadow duration-300',
        className
      )}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {segments.map((segment, index) => {
        const Icon = segment.icon
        return (
          <button
            key={segment.id}
            onClick={() => setTheme(segment.id)}
            className={getSegmentClasses(segment.id, index)}
            role="radio"
            aria-checked={theme === segment.id}
            aria-label={segment.ariaLabel}
            tabIndex={theme === segment.id ? 0 : -1}
          >
            <Icon className={getIconClasses(segment.id)} />
            <span className={cn(
              'transition-all duration-300',
              size === 'sm' && 'hidden', // Hide text on small size
              size === 'md' && 'hidden sm:inline', // Show text on small screens and up for medium
              size === 'lg' && 'inline' // Always show text for large
            )}>
              {segment.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Compact version for mobile or tight spaces
export function CompactThemeToggle({ className }: { className?: string }) {
  return <ThemeToggle size="sm" className={className} />
}

// Simple two-way toggle (Light/Dark only, no System option)
export function SimpleThemeToggle({ className }: { className?: string }) {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn(
        'inline-flex rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm h-10',
        className
      )}>
        <div className="flex animate-pulse">
          <div className="w-16 h-full bg-gray-200 dark:bg-gray-700 rounded-l-lg" />
          <div className="w-16 h-full bg-gray-200 dark:bg-gray-700 rounded-r-lg" />
        </div>
      </div>
    )
  }

  const segments = [
    {
      id: 'light',
      label: 'Light',
      icon: Sun,
      ariaLabel: 'Switch to light mode'
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: Moon,
      ariaLabel: 'Switch to dark mode'
    }
  ]

  const currentTheme = theme === 'system' ? resolvedTheme : theme

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border-2 border-gray-200 dark:border-gray-700',
        'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm',
        'shadow-sm hover:shadow-md transition-shadow duration-300',
        className
      )}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {segments.map((segment, index) => {
        const Icon = segment.icon
        const isActive = currentTheme === segment.id
        const isFirst = index === 0
        const isLast = index === segments.length - 1

        return (
          <button
            key={segment.id}
            onClick={() => setTheme(segment.id)}
            className={cn(
              'relative flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 cursor-pointer',
              'border-r border-gray-200 dark:border-gray-700 last:border-r-0',
              'hover:bg-gray-50 dark:hover:bg-gray-700/50',
              'focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:z-10',

              isFirst && 'rounded-l-lg',
              isLast && 'rounded-r-lg',

              isActive && [
                'bg-gradient-to-r from-orange-500 to-blue-500',
                'text-white shadow-lg',
                'hover:from-orange-600 hover:to-blue-600',
                'transform scale-[1.02] z-10'
              ],

              !isActive && [
                'text-gray-700 dark:text-gray-300',
                'hover:text-gray-900 dark:hover:text-white'
              ]
            )}
            role="radio"
            aria-checked={currentTheme === segment.id}
            aria-label={segment.ariaLabel}
          >
            <Icon className={cn(
              'h-4 w-4 transition-all duration-300',
              !isActive && segment.id === 'light' && 'text-orange-500',
              !isActive && segment.id === 'dark' && 'text-blue-500',
              isActive && 'text-white'
            )} />
            <span className="hidden sm:inline">
              {segment.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Floating theme toggle for landing pages (now uses segmented design)
export function FloatingThemeToggle({ className }: { className?: string }) {
  return (
    <div className="fixed top-6 right-6 z-50">
      <ThemeToggle size="md" className={cn('shadow-lg', className)} />
    </div>
  )
}
