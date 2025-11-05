/**
 * DigiClassroom Design System - Component Library
 * Reusable React components with TypeScript definitions
 */

import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

// Utility function for class name merging
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ')
}

// ===== ENHANCED BUTTON COMPONENT =====

const enhancedButtonVariants = cva(
  "vg-focus-ring inline-flex items-center justify-center whitespace-nowrap rounded-xl text-vg-sm font-medium transition-all duration-vg-normal focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        primary: [
          "vg-apple-button-primary text-white",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700"
        ],
        secondary: [
          "bg-gradient-to-r from-vg-secondary-500 to-vg-secondary-600 text-white shadow-vg-md hover:shadow-vg-lg",
          "transform hover:-translate-y-0.5 active:scale-98"
        ],
        educational: [
          "bg-gradient-to-r from-vg-primary-500 to-vg-secondary-500 text-white shadow-vg-md hover:shadow-vg-lg",
          "transform hover:-translate-y-0.5 active:scale-98"
        ],
        outline: [
          "border-2 border-vg-primary-300 bg-transparent text-vg-primary-700",
          "hover:bg-vg-primary-50 hover:border-vg-primary-500 hover:text-vg-primary-900"
        ],
        ghost: [
          "bg-transparent text-vg-gray-700 hover:bg-vg-gray-100 hover:text-vg-gray-900"
        ],
        destructive: [
          "bg-vg-error-500 text-white shadow-vg-md hover:bg-vg-error-600 hover:shadow-vg-lg",
          "transform hover:-translate-y-0.5 active:scale-98"
        ]
      },
      size: {
        sm: "h-9 px-vg-3 text-vg-xs rounded-lg",
        default: "h-10 px-vg-4 py-vg-2 text-vg-sm",
        lg: "h-11 px-vg-8 text-vg-base rounded-xl",
        xl: "h-12 px-vg-10 text-vg-lg rounded-xl",
        icon: "h-10 w-10 rounded-xl"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default"
    }
  }
)

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof enhancedButtonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(enhancedButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
EnhancedButton.displayName = "EnhancedButton"

// ===== GLASSMORPHIC CARD COMPONENT =====

const cardVariants = cva(
  "rounded-2xl border backdrop-blur-md transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-white/80 border-white/30 shadow-vg-card hover:shadow-vg-card-hover",
        glass: "bg-white/10 border-white/20 shadow-vg-card backdrop-blur-lg",
        solid: "bg-white border-gray-200 shadow-vg-card",
        educational: "bg-gradient-to-br from-white/90 to-blue-50/50 border-blue-200/30 shadow-vg-card"
      },
      hover: {
        none: "",
        lift: "hover:-translate-y-1 hover:shadow-vg-lg",
        scale: "hover:scale-[1.02]",
        glow: "hover:shadow-vg-xl hover:shadow-blue-500/10"
      }
    },
    defaultVariants: {
      variant: "default",
      hover: "lift"
    }
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, hover, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("vg-heading-3", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

// ===== ENHANCED INPUT COMPONENT =====

const inputVariants = cva(
  "flex w-full rounded-lg border bg-white/80 backdrop-blur-sm px-3 py-2 text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-gray-200 focus-visible:ring-vg-primary-500",
        educational: "border-vg-primary-200 focus-visible:ring-vg-primary-500 focus-visible:border-vg-primary-400",
        error: "border-vg-error-300 focus-visible:ring-vg-error-500 text-vg-error-700",
        success: "border-vg-success-300 focus-visible:ring-vg-success-500 text-vg-success-700"
      },
      size: {
        sm: "h-8 px-2 text-xs",
        default: "h-10 px-3",
        lg: "h-12 px-4 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface EnhancedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string
  error?: string
  helper?: string
}

export const EnhancedInput = React.forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({ className, variant, size, label, error, helper, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          className={cn(inputVariants({ variant: error ? "error" : variant, size, className }))}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-vg-error-600">{error}</p>
        )}
        {helper && !error && (
          <p className="text-sm text-gray-500">{helper}</p>
        )}
      </div>
    )
  }
)
EnhancedInput.displayName = "EnhancedInput"

// ===== BADGE COMPONENT =====

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-vg-primary-100 text-vg-primary-800 hover:bg-vg-primary-200",
        secondary: "bg-vg-secondary-100 text-vg-secondary-800 hover:bg-vg-secondary-200",
        success: "bg-vg-success-100 text-vg-success-800 hover:bg-vg-success-200",
        warning: "bg-vg-warning-100 text-vg-warning-800 hover:bg-vg-warning-200",
        error: "bg-vg-error-100 text-vg-error-800 hover:bg-vg-error-200",
        outline: "border border-vg-primary-200 text-vg-primary-700 hover:bg-vg-primary-50",
        gradient: "bg-gradient-to-r from-vg-primary-500 to-vg-secondary-500 text-white"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

// ===== LOADING SKELETON =====

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  )
}

// ===== EDUCATIONAL CONTENT WRAPPER =====

export interface EducationalContentProps {
  children: React.ReactNode
  subject?: 'mathematics' | 'science' | 'economics' | 'general'
  className?: string
}

export const EducationalContent: React.FC<EducationalContentProps> = ({ 
  children, 
  subject = 'general', 
  className 
}) => {
  const subjectColors = {
    mathematics: 'border-blue-200 bg-blue-50/50',
    science: 'border-green-200 bg-green-50/50',
    economics: 'border-purple-200 bg-purple-50/50',
    general: 'border-gray-200 bg-gray-50/50'
  }

  return (
    <div className={cn(
      "rounded-xl border-2 p-6 backdrop-blur-sm",
      subjectColors[subject],
      className
    )}>
      {children}
    </div>
  )
}
