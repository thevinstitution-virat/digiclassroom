/**
 * Enhanced Button Component - VG Kosh Design System
 * Educational platform-specific button with cultural theming and glass morphism
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const enhancedButtonVariants = cva(
  // Base styles with VG design system - More rounded corners
  "vg-focus-ring inline-flex items-center justify-center whitespace-nowrap rounded-xl text-vg-sm font-medium transition-all duration-vg-normal focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        // Primary Apple-inspired button
        primary: [
          "vg-apple-button-primary text-white",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700"
        ],
        
        // Cultural Sanskrit-inspired design with Apple styling
        cultural: [
          "vg-cultural-gradient text-white",
          "border-radius: var(--vg-radius-lg)",
          "box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)",
          "transition: all 0.3s ease",
          "transform: translateY(0)",
          "hover:shadow-[0_4px_12px_rgba(255,126,95,0.3)] hover:transform hover:translate-y-[-2px]",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700"
        ],
        
        // Success states for achievements
        success: [
          "vg-success-gradient text-white shadow-vg-md hover:shadow-vg-lg",
          "transform hover:-translate-y-0.5 active:scale-98",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700"
        ],
        
        // Apple-inspired secondary
        secondary: [
          "vg-apple-button-secondary text-gray-700 dark:text-gray-200"
        ],
        
        // Educational glass with context
        educational: [
          "vg-glass-educational border border-vg-primary-200/30 text-vg-primary-700 dark:text-vg-primary-300",
          "hover:vg-glass-educational hover:border-vg-primary-300/50 hover:shadow-vg-glow-primary",
          "backdrop-blur-vg-md"
        ],
        
        // Minimal ghost style
        ghost: [
          "text-vg-primary-700 hover:bg-vg-primary-50 hover:text-vg-primary-900",
          "dark:text-vg-primary-300 dark:hover:bg-vg-primary-900/20 dark:hover:text-vg-primary-100",
          "transition-colors duration-vg-normal"
        ],
        
        // Outline style with cultural flair
        outline: [
          "border-2 border-vg-primary-300 bg-transparent text-vg-primary-700",
          "hover:bg-vg-primary-50 hover:border-vg-primary-500 hover:text-vg-primary-900",
          "dark:border-vg-primary-700 dark:text-vg-primary-300",
          "dark:hover:bg-vg-primary-900/20 dark:hover:border-vg-primary-500"
        ],
        
        // Destructive actions
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
      },
      
      // Educational context enhancement
      educational: {
        true: "vg-animate-educational-pulse",
        false: ""
      },
      
      // Cultural enhancement for Sanskrit context
      culturalContext: {
        true: "font-vg-cultural tracking-wide",
        false: ""
      },
      
      // Loading state
      loading: {
        true: "cursor-not-allowed",
        false: ""
      }
    },
    
    defaultVariants: {
      variant: "primary",
      size: "default",
      educational: false,
      culturalContext: false,
      loading: false
    }
  }
)

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof enhancedButtonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  iconPosition?: "left" | "right"
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    educational, 
    culturalContext, 
    loading, 
    loadingText,
    icon,
    iconPosition = "left",
    asChild = false, 
    children,
    disabled,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Loading state override
    const isDisabled = disabled || loading
    
    return (
      <Comp
        className={cn(
          enhancedButtonVariants({ 
            variant, 
            size, 
            educational, 
            culturalContext, 
            loading,
            className 
          })
        )}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center vg-glass-light rounded-vg-lg">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            {loadingText || "Loading..."}
          </div>
        )}
        
        <div className={cn(
          "flex items-center gap-vg-2",
          loading && "opacity-0"
        )}>
          {icon && iconPosition === "left" && (
            <span className="flex-shrink-0">{icon}</span>
          )}
          
          <span className="flex-1">{children}</span>
          
          {icon && iconPosition === "right" && (
            <span className="flex-shrink-0">{icon}</span>
          )}
        </div>
      </Comp>
    )
  }
)

EnhancedButton.displayName = "EnhancedButton"

// Educational Context Button - Specialized for learning interactions
export interface EducationalButtonProps extends EnhancedButtonProps {
  subject?: "mathematics" | "science" | "literature" | "history" | "sanskrit"
  achievement?: boolean
}

const EducationalButton = React.forwardRef<HTMLButtonElement, EducationalButtonProps>(
  ({ subject, achievement, educational = true, ...props }, ref) => {
    // Subject-specific styling
    const getSubjectVariant = () => {
      if (achievement)
  return "success"
      
      switch (subject) {
        case "mathematics":
          return "primary"
        case "science": 
          return "educational"
        case "literature":
          return "cultural"
        case "sanskrit":
          return "cultural"
        default:
          return "primary"
      }
    }
    
    return (
      <EnhancedButton
        ref={ref}
        variant={getSubjectVariant()}
        educational={educational}
        culturalContext={subject === "sanskrit" || subject === "literature"}
        {...props}
      />
    )
  }
)

EducationalButton.displayName = "EducationalButton"

// Cultural Button - For Sanskrit and Indian heritage content
export interface CulturalButtonProps extends EnhancedButtonProps {
  sanskrit?: boolean
  mantra?: boolean
}

const CulturalButton = React.forwardRef<HTMLButtonElement, CulturalButtonProps>(
  ({ sanskrit = false, mantra = false, culturalContext = true, ...props }, ref) => {
    return (
      <EnhancedButton
        ref={ref}
        variant={sanskrit || mantra ? "cultural" : "primary"}
        culturalContext={culturalContext}
        educational={mantra}
        {...props}
      />
    )
  }
)

CulturalButton.displayName = "CulturalButton"

export { 
  EnhancedButton, 
  EducationalButton, 
  CulturalButton,
  enhancedButtonVariants 
} 