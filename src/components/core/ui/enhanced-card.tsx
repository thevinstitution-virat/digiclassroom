/**
 * Enhanced Card Component - VG Kosh Design System
 * Educational platform cards with glass morphism and cultural theming
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const enhancedCardVariants = cva(
  // Base card styles with VG design system - More rounded corners
  "rounded-2xl border transition-all duration-vg-normal overflow-hidden group",
  {
    variants: {
      variant: {
        // Default glass morphism card
        default: [
          "bg-white/80 backdrop-blur-vg-sm border-gray-200/50 shadow-vg-sm hover:shadow-vg-md",
          "dark:bg-gray-800/80 dark:border-gray-700/50"
        ],
        
        // Light glass effect
        glass: [
          "vg-glass-light border-white/20 shadow-vg-lg hover:shadow-vg-xl",
          "hover:vg-glass-medium backdrop-blur-vg-md"
        ],
        
        // Educational context with subtle patterns
        educational: [
          "bg-gradient-to-br from-vg-primary-50/50 to-vg-cultural-50/50 border-vg-primary-200/50",
          "shadow-vg-sm hover:shadow-vg-md vg-pattern-mandala",
          "dark:from-vg-primary-900/20 dark:to-vg-cultural-900/20 dark:border-vg-primary-700/50"
        ],
        
        // Cultural Sanskrit-inspired design
        cultural: [
          "bg-gradient-to-br from-vg-sanskrit-50/50 to-vg-cultural-50/50 border-vg-sanskrit-200/50",
          "shadow-vg-sm hover:shadow-vg-md vg-pattern-lotus",
          "dark:from-vg-sanskrit-900/20 dark:to-vg-cultural-900/20 dark:border-vg-sanskrit-700/50"
        ],
        
        // Elevated solid card
        elevated: [
          "bg-white shadow-vg-lg hover:shadow-vg-xl border-0 transform hover:-translate-y-1",
          "dark:bg-gray-800"
        ],
        
        // Success/achievement cards
        success: [
          "bg-gradient-to-br from-vg-success-50/50 to-vg-success-100/50 border-vg-success-200/50",
          "shadow-vg-sm hover:shadow-vg-success",
          "dark:from-vg-success-900/20 dark:to-vg-success-800/20 dark:border-vg-success-700/50"
        ],
        
        // Warning/attention cards
        warning: [
          "bg-gradient-to-br from-vg-warning-50/50 to-vg-warning-100/50 border-vg-warning-200/50",
          "shadow-vg-sm hover:shadow-vg-warning",
          "dark:from-vg-warning-900/20 dark:to-vg-warning-800/20 dark:border-vg-warning-700/50"
        ],
        
        // Outline only
        outline: [
          "bg-transparent border-2 border-vg-primary-200 hover:border-vg-primary-300",
          "hover:bg-vg-primary-50/30 dark:border-vg-primary-700 dark:hover:border-vg-primary-600",
          "dark:hover:bg-vg-primary-900/20"
        ]
      },
      
      size: {
        sm: "p-vg-4",
        default: "p-vg-6", 
        lg: "p-vg-8",
        xl: "p-vg-10"
      },
      
      // Interactive hover effects
      interactive: {
        true: "cursor-pointer vg-hover-lift hover:scale-102",
        false: ""
      },
      
      // Educational animations
      educational: {
        true: "vg-animate-educational-pulse",
        false: ""
      },
      
      // Cultural glow effect
      culturalGlow: {
        true: "vg-animate-cultural-glow",
        false: ""
      },
      
      // Floating animation
      floating: {
        true: "vg-animate-float",
        false: ""
      }
    },
    
    defaultVariants: {
      variant: "default",
      size: "default",
      interactive: false,
      educational: false,
      culturalGlow: false,
      floating: false
    }
  }
)

export interface EnhancedCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof enhancedCardVariants> {
  asChild?: boolean
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, variant, size, interactive, educational, culturalGlow, floating, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(enhancedCardVariants({ variant, size, interactive, educational, culturalGlow, floating, className }))}
      {...props}
    />
  )
)
EnhancedCard.displayName = "EnhancedCard"

// Card Header with consistent typography
const EnhancedCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-vg-2 pb-vg-6", className)}
    {...props}
  />
))
EnhancedCardHeader.displayName = "EnhancedCardHeader"

// Card Title with VG typography
const EnhancedCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-vg-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white",
      className
    )}
    {...props}
  >
    {children}
  </h3>
))
EnhancedCardTitle.displayName = "EnhancedCardTitle"

// Card Description with consistent styling
const EnhancedCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-vg-sm text-gray-600 dark:text-gray-400 leading-relaxed", className)}
    {...props}
  />
))
EnhancedCardDescription.displayName = "EnhancedCardDescription"

// Card Content area
const EnhancedCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
))
EnhancedCardContent.displayName = "EnhancedCardContent"

// Card Footer with consistent spacing
const EnhancedCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-vg-6", className)}
    {...props}
  />
))
EnhancedCardFooter.displayName = "EnhancedCardFooter"

// Educational Feature Card - Specialized for course features
export interface EducationalFeatureCardProps extends EnhancedCardProps {
  subject?: "mathematics" | "science" | "literature" | "history" | "sanskrit"
  difficulty?: "beginner" | "intermediate" | "advanced"
  featured?: boolean
}

const EducationalFeatureCard = React.forwardRef<HTMLDivElement, EducationalFeatureCardProps>(
  ({ subject, difficulty, featured, educational = true, interactive = true, ...props }, ref) => {
    // Subject-specific styling
    const getSubjectVariant = () => {
      switch (subject) {
        case "mathematics":
          return "educational"
        case "science":
          return "educational"
        case "literature":
        case "sanskrit":
          return "cultural"
        case "history":
          return "cultural"
        default:
          return featured ? "elevated" : "educational"
      }
    }
    
    // Difficulty color coding
    const getDifficultyAccent = () => {
      switch (difficulty) {
        case "beginner":
          return "border-l-4 border-l-vg-success-500"
        case "intermediate":
          return "border-l-4 border-l-vg-warning-500"
        case "advanced":
          return "border-l-4 border-l-vg-error-500"
        default:
          return ""
      }
    }
    
    return (
      <EnhancedCard
        ref={ref}
        variant={getSubjectVariant()}
        interactive={interactive}
        educational={educational}
        culturalGlow={subject === "sanskrit"}
        className={cn(getDifficultyAccent(), featured && "ring-2 ring-vg-primary-200")}
        {...props}
      />
    )
  }
)
EducationalFeatureCard.displayName = "EducationalFeatureCard"

// Cultural Heritage Card - For Sanskrit and Indian content
export interface CulturalCardProps extends EnhancedCardProps {
  heritage?: "vedic" | "sanskrit" | "ayurveda" | "yoga" | "classical"
  sacred?: boolean
}

const CulturalCard = React.forwardRef<HTMLDivElement, CulturalCardProps>(
  ({ heritage, sacred, culturalGlow = true, ...props }, ref) => {
    return (
      <EnhancedCard
        ref={ref}
        variant="cultural"
        culturalGlow={culturalGlow}
        educational={sacred}
        className={cn(
          heritage === "vedic" && "border-vg-cultural-300/50",
          heritage === "sanskrit" && "border-vg-sanskrit-300/50",
          sacred && "shadow-vg-cultural"
        )}
        {...props}
      />
    )
  }
)
CulturalCard.displayName = "CulturalCard"

// Progress Card - For showing learning progress
export interface ProgressCardProps extends EnhancedCardProps {
  progress?: number
  status?: "in-progress" | "completed" | "locked" | "new"
  animated?: boolean
}

const ProgressCard = React.forwardRef<HTMLDivElement, ProgressCardProps>(
  ({ progress = 0, status = "new", animated = true, ...props }, ref) => {
    const getStatusVariant = () => {
      switch (status) {
        case "completed":
          return "success"
        case "in-progress":
          return "educational"
        case "locked":
          return "outline"
        case "new":
          return "glass"
        default:
          return "default"
      }
    }
    
    return (
      <EnhancedCard
        ref={ref}
        variant={getStatusVariant()}
        educational={status === "in-progress" && animated}
        floating={status === "new" && animated}
        className={cn(
          "relative overflow-hidden",
          status === "locked" && "opacity-60"
        )}
        {...props}
      >
        {/* Progress indicator */}
        {progress > 0 && (
          <div className="absolute top-0 left-0 h-1 bg-vg-success-500 transition-all duration-1000 ease-out"
               style={{ width: `${progress}%` }} />
        )}
        
        {/* Status badge */}
        <div className="absolute top-vg-2 right-vg-2">
          {status === "completed" && (
            <div className="w-3 h-3 bg-vg-success-500 rounded-full" />
          )}
          {status === "in-progress" && (
            <div className="w-3 h-3 bg-vg-primary-500 rounded-full vg-animate-educational-pulse" />
          )}
          {status === "locked" && (
            <div className="w-3 h-3 bg-gray-400 rounded-full" />
          )}
          {status === "new" && (
            <div className="w-3 h-3 bg-vg-warning-500 rounded-full vg-animate-float" />
          )}
        </div>
        
        {props.children}
      </EnhancedCard>
    )
  }
)
ProgressCard.displayName = "ProgressCard"

export {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardFooter,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardContent,
  EducationalFeatureCard,
  CulturalCard,
  ProgressCard,
  enhancedCardVariants
} 