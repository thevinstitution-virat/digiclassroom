'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'

interface BackNavigationButtonProps {
  /** The route to navigate back to */
  backTo: string
  /** Text to display alongside the icon */
  label?: string
  /** Additional CSS classes */
  className?: string
  /** Whether to show the button in a compact form */
  compact?: boolean
  /** Custom icon component */
  icon?: React.ComponentType<{ className?: string }>
  /** Callback function called before navigation */
  onBeforeNavigate?: () => void
}

const BackNavigationButton: React.FC<BackNavigationButtonProps> = ({
  backTo,
  label = 'Back to Menu',
  className = '',
  compact = false,
  icon: CustomIcon = ArrowLeftIcon,
  onBeforeNavigate
}) => {
  const router = useRouter()

  const handleNavigation = () => {
    // Call the callback if provided
    if (onBeforeNavigate) {
      onBeforeNavigate()
    }
    
    // Navigate to the specified route
    router.push(backTo)
  }

  if (compact) {
    return (
      <motion.button
        onClick={handleNavigation}
        className={`
          inline-flex items-center gap-2 px-3 py-2 
          text-sm font-medium text-muted-foreground
          hover:text-foreground dark:hover:text-gray-100
          hover:bg-muted dark:hover:bg-gray-800
          rounded-lg transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${className}
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label={`Navigate ${label.toLowerCase()}`}
      >
        <CustomIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Button
        onClick={handleNavigation}
        variant="ghost"
        size="sm"
        className="
          inline-flex items-center gap-2 px-4 py-2
          text-muted-foreground
          hover:text-foreground dark:hover:text-gray-100
          hover:bg-muted dark:hover:bg-gray-800
          border border-border
          rounded-lg transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          shadow-sm hover:shadow-md
        "
        aria-label={`Navigate ${label.toLowerCase()}`}
      >
        <motion.div
          whileHover={{ x: -2 }}
          transition={{ duration: 0.2 }}
        >
          <CustomIcon className="h-4 w-4" />
        </motion.div>
        <span className="font-medium">{label}</span>
      </Button>
    </motion.div>
  )
}

export default BackNavigationButton

// Preset configurations for common use cases
export const BackToMenuButton: React.FC<Omit<BackNavigationButtonProps, 'backTo' | 'label'> & { 
  label?: string 
}> = ({ label = 'Back to Menu Dashboard', ...props }) => (
  <BackNavigationButton 
    backTo="/dashboard/menu" 
    label={label}
    {...props} 
  />
)

export const BackToUserDashboard: React.FC<Omit<BackNavigationButtonProps, 'backTo' | 'label'> & { 
  label?: string 
}> = ({ label = 'Back to Dashboard', ...props }) => (
  <BackNavigationButton 
    backTo="/dashboard/user" 
    label={label}
    {...props} 
  />
)

// Compact versions for tight spaces
export const CompactBackToMenu: React.FC<Omit<BackNavigationButtonProps, 'backTo' | 'label' | 'compact'> & { 
  label?: string 
}> = ({ label = 'Back', ...props }) => (
  <BackNavigationButton 
    backTo="/dashboard/menu" 
    label={label}
    compact={true}
    {...props} 
  />
)

export const CompactBackToUserDashboard: React.FC<Omit<BackNavigationButtonProps, 'backTo' | 'label' | 'compact'> & { 
  label?: string 
}> = ({ label = 'Back', ...props }) => (
  <BackNavigationButton 
    backTo="/dashboard/user" 
    label={label}
    compact={true}
    {...props} 
  />
)
