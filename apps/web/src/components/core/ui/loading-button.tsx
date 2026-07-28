'use client'

import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  children: ReactNode
  loadingText?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function LoadingButton({ 
  loading = false, 
  children, 
  loadingText = 'Loading...', 
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props 
}: LoadingButtonProps) {
  const baseClasses = "inline-flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2"
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-orange-500 to-blue-600 text-white hover:from-orange-600 hover:to-blue-700 shadow-md hover:shadow-lg focus:ring-orange-500",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300 focus:ring-gray-500",
    outline: "border-2 border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-50 focus:ring-orange-500",
    ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500",
    destructive: "bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg focus:ring-red-500"
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
    xl: "px-8 py-4 text-xl"
  }

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}
