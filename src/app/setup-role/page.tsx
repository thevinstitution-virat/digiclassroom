'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserRole, UserPersona } from '@/lib/validations'
import { useSession } from '@/auth/client'
import {
  AcademicCapIcon,
  UserGroupIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

function SetupRoleClient() {
  const { data: session, isPending } = useSession()
  const user = session?.user
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const [selectedPersona, setSelectedPersona] = useState<UserPersona | ''>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')

  useEffect(() => {
    if (!isPending && !user) {
      router.replace('/sign-in')
    }
  }, [isPending, user, router])

  // Users can only self-assign as 'user' - admin roles are assigned automatically or by existing admins
  const userRole: UserRole = 'user'

  const personaOptions = [
    {
      value: 'student' as UserPersona,
      title: 'Student',
      description: 'I am a student learning from the curriculum',
      icon: '🎓'
    },
    {
      value: 'teacher' as UserPersona,
      title: 'Teacher',
      description: 'I am an educator teaching students',
      icon: '👩‍🏫'
    },
    {
      value: 'guardian' as UserPersona,
      title: 'Parent/Guardian',
      description: 'I am supporting my child\'s education',
      icon: '👨‍👩‍👧‍👦'
    }
  ]

  const handleRoleAssignment = async () => {
    if (!selectedPersona || !user || isAssigning) return

    setIsAssigning(true)
    setAssignmentError('')

    try {
      // Update user metadata using the assign-role API
      const response = await fetch('/api/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: userRole, // Always 'user' for self-signup
          persona: selectedPersona,
          manualAssignment: true
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to assign role')
      }

      // No need to call user.reload() with BetterAuth, session updates automatically
      // Redirect to user dashboard
      setTimeout(() => {
        router.replace('/dashboard/user')
      }, 500)

    } catch (error) {
      console.error('Manual role assignment failed:', error)
      setAssignmentError('Failed to assign role. Please try again.')
    } finally {
      setIsAssigning(false)
    }
  }

  const getErrorMessage = () => {
    switch (error) {
      case 'assignment-failed':
        return 'Automatic role assignment failed. Please select your role manually.'
      case 'assignment-error':
        return 'There was an error during role assignment. Please try again.'
      default:
        return 'Please select your role to continue.'
    }
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Setup Your Role
          </h1>

          {/* Error message */}
          {error && (
            <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span className="text-sm">{getErrorMessage()}</span>
            </div>
          )}

          <p className="text-gray-600 dark:text-gray-400">
            Help us personalize your Virat Gyankosh experience
          </p>
        </div>

        {/* Role Display */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              1. Your Role
            </h2>
            <div className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500 text-white">
                  <AcademicCapIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Learning User
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Access learning content, AI tutoring, and personalized study materials
                  </p>
                </div>
                <CheckCircleIcon className="h-5 w-5 text-blue-500 ml-auto" />
              </div>
            </div>
          </div>

          {/* Persona Selection */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              2. Tell Us About Yourself
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {personaOptions.map((persona) => (
                <button
                  key={persona.value}
                  onClick={() => setSelectedPersona(persona.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${selectedPersona === persona.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{persona.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {persona.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {persona.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {assignmentError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span className="text-sm">{assignmentError}</span>
            </div>
          )}

          {/* Submit Button */}
          {selectedPersona && (
            <div className="pt-4">
              <button
                onClick={handleRoleAssignment}
                disabled={isAssigning}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isAssigning ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Setting up your account...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-5 w-5" />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your role can be changed later by contacting support
          </p>
        </div>
      </div>
    </div>
  )

}

export default function SetupRolePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div></div>}>
      <SetupRoleClient />
    </Suspense>
  )
}
