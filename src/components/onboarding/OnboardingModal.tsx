'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@clerk/nextjs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ChevronRightIcon, 
  ChevronLeftIcon, 
  CheckCircleIcon,
  UserIcon,
  AcademicCapIcon,
  BookOpenIcon,
  GlobeAltIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { 
  OnboardingFormData, 
  UserRole, 
  EducationBoard, 
  Medium, 
  Stream 
} from '@/types/user-management'

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: (data: OnboardingFormData) => void
  onSkip?: () => void
}

interface ValidationErrors {
  [key: string]: string
}

const STEPS = [
  { id: 1, title: 'Role Selection', description: 'Tell us who you are' },
  { id: 2, title: 'Education Board', description: 'Choose your curriculum' },
  { id: 3, title: 'Language Medium', description: 'Select your preferred language' },
  { id: 4, title: 'Class Level', description: 'What class are you in?' },
  { id: 5, title: 'Stream Selection', description: 'Choose your specialization' }
]

export default function OnboardingModal({ isOpen, onComplete, onSkip }: OnboardingModalProps) {
  const { user } = useUser()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<OnboardingFormData>({
    role: 'student',
    board: 'CBSE',
    medium: 'ENGLISH',
    class: 10
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if stream selection is needed (classes 11-12)
  const needsStream = formData.class >= 11
  const totalSteps = needsStream ? 5 : 4
  const progress = (currentStep / totalSteps) * 100

  // Validation schema for each step
  const validateStep = (step: number): boolean => {
    const newErrors: ValidationErrors = {}

    switch (step) {
      case 1:
        if (!formData.role) newErrors.role = 'Please select your role'
        break
      case 2:
        if (!formData.board) newErrors.board = 'Please select your education board'
        break
      case 3:
        if (!formData.medium) newErrors.medium = 'Please select your language medium'
        break
      case 4:
        if (!formData.class || formData.class < 1 || formData.class > 12) {
          newErrors.class = 'Please select a valid class (1-12)'
        }
        break
      case 5:
        if (needsStream && !formData.stream) {
          newErrors.stream = 'Please select your stream for classes 11-12'
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setIsSubmitting(true)
    try {
      await onComplete(formData)
    } catch (error) {
      console.error('Onboarding submission failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (updates: Partial<OnboardingFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    setErrors({}) // Clear errors when user makes changes
  }

  // Role Selection Step
  const RoleSelectionStep = () => {
    const roles: { value: UserRole; label: string; description: string; icon: any }[] = [
      { value: 'student', label: 'Student', description: 'I am here to learn and study', icon: AcademicCapIcon },
      { value: 'teacher', label: 'Teacher', description: 'I teach and guide students', icon: UserIcon },
      { value: 'parent', label: 'Parent', description: 'I support my child\'s education', icon: UserIcon },
      { value: 'guardian', label: 'Guardian', description: 'I guide and mentor students', icon: UserIcon }
    ]

    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Welcome to VG Kosh! 🎓
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Let's personalize your learning experience
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <Card 
              key={role.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                formData.role === role.value 
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => updateFormData({ role: role.value })}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <role.icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {role.label}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {role.description}
                    </p>
                  </div>
                  {formData.role === role.value && (
                    <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-auto" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {errors.role && (
          <p className="text-red-500 text-sm mt-2">{errors.role}</p>
        )}
      </div>
    )
  }

  // Board Selection Step
  const BoardSelectionStep = () => {
    const boards: { value: EducationBoard; label: string; description: string }[] = [
      { value: 'CBSE', label: 'CBSE', description: 'Central Board of Secondary Education' },
      { value: 'ICSE', label: 'ICSE', description: 'Indian Certificate of Secondary Education' },
      { value: 'STATE_BOARD', label: 'State Board', description: 'State Education Board' }
    ]

    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <GlobeAltIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Choose Your Education Board
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            This helps us provide curriculum-specific content
          </p>
        </div>
        
        <div className="space-y-3">
          {boards.map((board) => (
            <Card 
              key={board.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                formData.board === board.value 
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => updateFormData({ board: board.value })}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {board.label}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {board.description}
                    </p>
                  </div>
                  {formData.board === board.value && (
                    <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {errors.board && (
          <p className="text-red-500 text-sm mt-2">{errors.board}</p>
        )}
      </div>
    )
  }

  // Medium Selection Step
  const MediumSelectionStep = () => {
    const mediums: { value: Medium; label: string; description: string }[] = [
      { value: 'ENGLISH', label: 'English', description: 'Study in English medium' },
      { value: 'HINDI', label: 'Hindi', description: 'Study in Hindi medium' }
    ]

    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <BookOpenIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Select Language Medium
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Choose your preferred language for study materials
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mediums.map((medium) => (
            <Card 
              key={medium.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                formData.medium === medium.value 
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => updateFormData({ medium: medium.value })}
            >
              <CardContent className="p-6 text-center">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 text-lg">
                  {medium.label}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {medium.description}
                </p>
                {formData.medium === medium.value && (
                  <CheckCircleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mt-3" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {errors.medium && (
          <p className="text-red-500 text-sm mt-2">{errors.medium}</p>
        )}
      </div>
    )
  }

  // Class Selection Step
  const ClassSelectionStep = () => {
    const classes = Array.from({ length: 12 }, (_, i) => i + 1)

    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <AcademicCapIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Select Your Class
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            This helps us provide grade-appropriate content
          </p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {classes.map((classNum) => (
            <Card
              key={classNum}
              className={`cursor-pointer transition-all hover:shadow-md ${
                formData.class === classNum
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => updateFormData({ class: classNum, stream: undefined })}
            >
              <CardContent className="p-4 text-center">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Class {classNum}
                </div>
                {classNum >= 11 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Stream required
                  </div>
                )}
                {formData.class === classNum && (
                  <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mt-2" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {errors.class && (
          <p className="text-red-500 text-sm mt-2">{errors.class}</p>
        )}
      </div>
    )
  }

  // Stream Selection Step (for classes 11-12)
  const StreamSelectionStep = () => {
    const streams: { value: Stream; label: string; description: string; subjects: string[] }[] = [
      {
        value: 'MATHEMATICS',
        label: 'Mathematics',
        description: 'Physics, Chemistry, Mathematics',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'English']
      },
      {
        value: 'BIOLOGY',
        label: 'Biology',
        description: 'Physics, Chemistry, Biology',
        subjects: ['Physics', 'Chemistry', 'Biology', 'English']
      },
      {
        value: 'COMMERCE',
        label: 'Commerce',
        description: 'Accountancy, Business Studies, Economics',
        subjects: ['Accountancy', 'Business Studies', 'Economics', 'English']
      },
      {
        value: 'HUMANITIES',
        label: 'Humanities',
        description: 'History, Geography, Political Science',
        subjects: ['History', 'Geography', 'Political Science', 'English']
      }
    ]

    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <SparklesIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Choose Your Stream
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Select your specialization for Class {formData.class}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {streams.map((stream) => (
            <Card
              key={stream.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                formData.stream === stream.value
                  ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => updateFormData({ stream: stream.value, subjects: stream.subjects })}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {stream.label}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {stream.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {stream.subjects.map((subject) => (
                        <Badge key={subject} variant="secondary" className="text-xs">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {formData.stream === stream.value && (
                    <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-2" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {errors.stream && (
          <p className="text-red-500 text-sm mt-2">{errors.stream}</p>
        )}
      </div>
    )
  }



  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <RoleSelectionStep />
      case 2:
        return <BoardSelectionStep />
      case 3:
        return <MediumSelectionStep />
      case 4:
        return <ClassSelectionStep />
      case 5:
        return needsStream ? <StreamSelectionStep /> : null
      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Complete Your Profile</span>
            <Badge variant="outline">
              Step {currentStep} of {totalSteps}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Getting Started</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex space-x-2">
            {onSkip && currentStep === 1 && (
              <Button variant="ghost" onClick={onSkip}>
                Skip for now
              </Button>
            )}
            
            {(currentStep < totalSteps) || (currentStep === 4 && !needsStream) ? (
              <Button onClick={currentStep === 4 && !needsStream ? handleSubmit : handleNext} className="flex items-center">
                {currentStep === 4 && !needsStream ? (
                  isSubmitting ? (
                    <>
                      <SparklesIcon className="h-4 w-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <CheckCircleIcon className="h-4 w-4 ml-2" />
                    </>
                  )
                ) : (
                  <>
                    Next
                    <ChevronRightIcon className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <CheckCircleIcon className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
