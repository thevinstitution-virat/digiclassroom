'use client'

import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  children: ReactNode
  loadingText?: string
  variant?: 'primary' | 'gradient' | 'secondary' | 'outline' | 'ghost' | 'destructive'
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
  const baseClasses =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0'

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground shadow-elev-1 hover:bg-primary/90 hover:shadow-elev-2',
    gradient:
      'bg-dc-grad-br bg-[length:200%_200%] text-white shadow-glow-brand hover:[background-position:100%_50%] hover:shadow-elev-3',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline:
      'border border-border bg-background/60 backdrop-blur-sm text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/40',
    ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground shadow-elev-1 hover:bg-destructive/90',
  }

  const sizeClasses = {
    sm: 'h-9 px-3 text-[13px]',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-[15px]',
    xl: 'h-12 px-8 text-base',
  }

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}
