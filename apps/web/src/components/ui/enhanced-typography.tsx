/**
 * Enhanced Typography Components - VG Kosh Design System
 * Educational platform typography with cultural theming and semantic hierarchy
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Enhanced Heading Component
const enhancedHeadingVariants = cva(
  "font-semibold tracking-tight scroll-m-20",
  {
    variants: {
      level: {
        h1: "text-vg-4xl lg:text-vg-5xl leading-tight",
        h2: "text-vg-3xl lg:text-vg-4xl leading-tight", 
        h3: "text-vg-2xl lg:text-vg-3xl leading-tight",
        h4: "text-vg-xl lg:text-vg-2xl leading-tight",
        h5: "text-vg-lg lg:text-vg-xl leading-tight",
        h6: "text-vg-base lg:text-vg-lg leading-tight"
      },
      
      variant: {
        default: "text-gray-900 dark:text-white",
        muted: "text-gray-600 dark:text-gray-400",
        primary: "text-vg-primary-600 dark:text-vg-primary-400",
        cultural: "text-vg-sanskrit-600 dark:text-vg-sanskrit-400",
        success: "text-vg-success-600 dark:text-vg-success-400",
        warning: "text-vg-warning-600 dark:text-vg-warning-400",
        error: "text-vg-error-600 dark:text-vg-error-400"
      },
      
      gradient: {
        educational: "vg-text-gradient-educational",
        cultural: "vg-text-gradient-cultural",
        none: ""
      },
      
      weight: {
        normal: "font-normal",
        medium: "font-medium", 
        semibold: "font-semibold",
        bold: "font-bold"
      },
      
      // Cultural font family
      culturalFont: {
        true: "font-vg-cultural",
        false: "font-vg-primary"
      },
      
      // Centered alignment for educational content
      centered: {
        true: "text-center",
        false: ""
      }
    },
    
    defaultVariants: {
      level: "h2",
      variant: "default",
      gradient: "none",
      weight: "semibold",
      culturalFont: false,
      centered: false
    }
  }
)

export interface EnhancedHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof enhancedHeadingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

const EnhancedHeading = React.forwardRef<HTMLHeadingElement, EnhancedHeadingProps>(
  ({ 
    className, 
    level = "h2",
    variant,
    gradient,
    weight,
    culturalFont,
    centered,
    as,
    children,
    ...props 
  }, ref) => {
    const headingProps = {
      ref,
      className: cn(
        enhancedHeadingVariants({ 
          level, 
          variant, 
          gradient, 
          weight, 
          culturalFont, 
          centered,
          className 
        })
      ),
      ...props
    }

    // Use 'as' prop if provided, otherwise use 'level'
    switch (as || level) {
      case "h1":
        return <h1 {...headingProps}>{children}</h1>
      case "h2":
        return <h2 {...headingProps}>{children}</h2>
      case "h3":
        return <h3 {...headingProps}>{children}</h3>
      case "h4":
        return <h4 {...headingProps}>{children}</h4>
      case "h5":
        return <h5 {...headingProps}>{children}</h5>
      case "h6":
        return <h6 {...headingProps}>{children}</h6>
      default:
        return <h2 {...headingProps}>{children}</h2>
    }
  }
)
EnhancedHeading.displayName = "EnhancedHeading"

// Enhanced Text Component
const enhancedTextVariants = cva(
  "leading-relaxed",
  {
    variants: {
      size: {
        xs: "text-vg-xs",
        sm: "text-vg-sm",
        base: "text-vg-base",
        lg: "text-vg-lg", 
        xl: "text-vg-xl",
        "2xl": "text-vg-2xl"
      },
      
      variant: {
        default: "text-gray-900 dark:text-white",
        muted: "text-gray-600 dark:text-gray-400", 
        subtle: "text-gray-500 dark:text-gray-500",
        primary: "text-vg-primary-600 dark:text-vg-primary-400",
        cultural: "text-vg-sanskrit-600 dark:text-vg-sanskrit-400",
        success: "text-vg-success-600 dark:text-vg-success-400",
        warning: "text-vg-warning-600 dark:text-vg-warning-400",
        error: "text-vg-error-600 dark:text-vg-error-400"
      },
      
      weight: {
        normal: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
        bold: "font-bold"
      },
      
      // Cultural styling
      culturalFont: {
        true: "font-vg-cultural tracking-wide",
        false: "font-vg-primary"
      },
      
      // Text alignment
      align: {
        left: "text-left",
        center: "text-center", 
        right: "text-right",
        justify: "text-justify"
      },
      
      // Special educational highlighting
      highlight: {
        definition: "highlight-definition rounded-vg-sm px-1",
        keyPoint: "highlight-key-point rounded-vg-sm px-1",
        alert: "highlight-alert rounded-vg-sm px-1",
        none: ""
      }
    },
    
    defaultVariants: {
      size: "base",
      variant: "default", 
      weight: "normal",
      culturalFont: false,
      align: "left",
      highlight: "none"
    }
  }
)

export interface EnhancedTextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof enhancedTextVariants> {
  as?: "p" | "span" | "div" | "label" | "small"
}

const EnhancedText = React.forwardRef<HTMLElement, EnhancedTextProps>(
  ({ 
    className,
    size,
    variant,
    weight,
    culturalFont,
    align,
    highlight,
    as = "p",
    children,
    ...props 
  }, ref) => {
    const Component = as
    
    return (
      <Component
        ref={ref}
        className={cn(
          enhancedTextVariants({ 
            size, 
            variant, 
            weight, 
            culturalFont, 
            align, 
            highlight,
            className 
          })
        )}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
EnhancedText.displayName = "EnhancedText"

// Educational Quote Component
export interface EducationalQuoteProps extends React.HTMLAttributes<HTMLQuoteElement> {
  author?: string
  source?: string
  sanskrit?: boolean
  translation?: string
}

const EducationalQuote = React.forwardRef<HTMLBlockquoteElement, EducationalQuoteProps>(
  ({ className, author, source, sanskrit = false, translation, children, ...props }, ref) => (
    <blockquote
      ref={ref}
      className={cn(
        "border-l-4 border-vg-primary-300 bg-vg-primary-50/50 px-vg-6 py-vg-4 italic my-vg-6 rounded-r-vg-lg",
        "dark:border-vg-primary-700 dark:bg-vg-primary-900/20",
        sanskrit && "border-l-vg-sanskrit-300 bg-vg-sanskrit-50/50 dark:border-vg-sanskrit-700 dark:bg-vg-sanskrit-900/20",
        className
      )}
      {...props}
    >
      <EnhancedText 
        size="lg" 
        weight="medium" 
        culturalFont={sanskrit}
        className="mb-vg-2"
      >
        {children}
      </EnhancedText>
      
      {translation && sanskrit && (
        <EnhancedText size="sm" variant="muted" className="mb-vg-2 not-italic">
          {translation}
        </EnhancedText>
      )}
      
      {(author || source) && (
        <footer className="text-vg-sm text-gray-600 dark:text-gray-400 not-italic">
          {author && <cite className="font-medium">{author}</cite>}
          {author && source && <span className="mx-1">—</span>}
          {source && <span>{source}</span>}
        </footer>
      )}
    </blockquote>
  )
)
EducationalQuote.displayName = "EducationalQuote"

// Sanskrit Shloka Component
export interface SanskritShlokaProps extends React.HTMLAttributes<HTMLDivElement> {
  shloka: string
  translation: string
  transliteration?: string
  meaning?: string
}

const SanskritShloka = React.forwardRef<HTMLDivElement, SanskritShlokaProps>(
  ({ className, shloka, translation, transliteration, meaning, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "vg-glass-cultural rounded-vg-xl p-vg-6 my-vg-8 border border-vg-sanskrit-200/50",
        "dark:border-vg-sanskrit-700/50 text-center",
        className
      )}
      {...props}
    >
      {/* Sanskrit Text */}
      <EnhancedText
        size="lg"
        weight="medium"
        culturalFont
        align="center"
        className="text-vg-sanskrit-700 dark:text-vg-sanskrit-300 mb-vg-4 leading-relaxed"
      >
        {shloka}
      </EnhancedText>
      
      {/* Transliteration */}
      {transliteration && (
        <EnhancedText
          size="sm"
          variant="muted"
          align="center"
          className="italic mb-vg-3"
        >
          {transliteration}
        </EnhancedText>
      )}
      
      {/* Translation */}
      <EnhancedText
        size="base"
        weight="medium"
        align="center"
        className="text-vg-primary-700 dark:text-vg-primary-300 mb-vg-3"
      >
        &ldquo;{translation}&rdquo;
      </EnhancedText>
      
      {/* Meaning/Context */}
      {meaning && (
        <EnhancedText
          size="sm"
          variant="subtle"
          align="center"
          className="border-t border-vg-sanskrit-200/30 pt-vg-3 dark:border-vg-sanskrit-700/30"
        >
          {meaning}
        </EnhancedText>
      )}
    </div>
  )
)
SanskritShloka.displayName = "SanskritShloka"

// Educational Definition Component
export interface EducationalDefinitionProps extends React.HTMLAttributes<HTMLDivElement> {
  term: string
  definition: string
  example?: string
  etymology?: string
}

const EducationalDefinition = React.forwardRef<HTMLDivElement, EducationalDefinitionProps>(
  ({ className, term, definition, example, etymology, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "definition-highlight rounded-vg-lg p-vg-4 my-vg-4",
        className
      )}
      {...props}
    >
      <EnhancedText
        size="lg"
        weight="semibold"
        variant="primary"
        className="mb-vg-2"
        highlight="definition"
      >
        {term}
      </EnhancedText>
      
      <EnhancedText size="base" className="mb-vg-3">
        {definition}
      </EnhancedText>
      
      {example && (
        <div className="example-box rounded-vg-md p-vg-3 mt-vg-3">
          <EnhancedText size="sm" weight="medium" variant="success" className="mb-vg-1">
            Example:
          </EnhancedText>
          <EnhancedText size="sm" className="italic">
            {example}
          </EnhancedText>
        </div>
      )}
      
      {etymology && (
        <EnhancedText size="xs" variant="muted" className="mt-vg-2 italic">
          Etymology: {etymology}
        </EnhancedText>
      )}
    </div>
  )
)
EducationalDefinition.displayName = "EducationalDefinition"

// Grade Level Badge
export interface GradeLevelBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  grade: number
  board?: "CBSE" | "ICSE" | "State"
}

const GradeLevelBadge = React.forwardRef<HTMLSpanElement, GradeLevelBadgeProps>(
  ({ className, grade, board = "CBSE", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center px-vg-2 py-vg-1 rounded-vg-md text-vg-xs font-medium",
        "bg-vg-primary-100 text-vg-primary-800 border border-vg-primary-200",
        "dark:bg-vg-primary-900/30 dark:text-vg-primary-300 dark:border-vg-primary-700",
        className
      )}
      {...props}
    >
      Class {grade} {board}
    </span>
  )
)
GradeLevelBadge.displayName = "GradeLevelBadge"

// Subject Badge
export interface SubjectBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  subject: "mathematics" | "science" | "literature" | "history" | "sanskrit" | "english"
  variant?: "default" | "outline"
}

const SubjectBadge = React.forwardRef<HTMLSpanElement, SubjectBadgeProps>(
  ({ className, subject, variant = "default", ...props }, ref) => {
    const getSubjectColors = () => {
      const colors = {
        mathematics: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
        science: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
        literature: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
        history: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
        sanskrit: "bg-vg-sanskrit-100 text-vg-sanskrit-800 border-vg-sanskrit-200 dark:bg-vg-sanskrit-900/30 dark:text-vg-sanskrit-300 dark:border-vg-sanskrit-700",
        english: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700"
      }
      return colors[subject]
    }
    
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-vg-2 py-vg-1 rounded-vg-md text-vg-xs font-medium",
          variant === "default" ? getSubjectColors() : `border-2 bg-transparent ${getSubjectColors()}`,
          className
        )}
        {...props}
      >
        {subject.charAt(0).toUpperCase() + subject.slice(1)}
      </span>
    )
  }
)
SubjectBadge.displayName = "SubjectBadge"

export {
  EnhancedHeading,
  EnhancedText,
  EducationalQuote,
  SanskritShloka,
  EducationalDefinition,
  GradeLevelBadge,
  SubjectBadge,
  enhancedHeadingVariants,
  enhancedTextVariants
} 