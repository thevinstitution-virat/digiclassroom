'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  User,
  GraduationCap,
  Globe,
  BookOpen,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Edit,
  X,
  Shield,
  CreditCard,
  Star,
  Award,
  Target,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  EnhancedUserProfile,
  UserRole,
  EducationBoard,
  Medium,
  Stream
} from '@/types/user-management'

interface ProfileFormData {
  firstName: string
  lastName: string
  role: UserRole
  board: EducationBoard
  medium: Medium
  class: number
  stream?: Stream
  subjects?: string[]
}

interface ValidationErrors {
  [key: string]: string
}

export default function ProfilePage() {
  const { user } = useUser()
  const [userProfile, setUserProfile] = useState<EnhancedUserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    role: 'student',
    board: 'CBSE',
    medium: 'ENGLISH',
    class: 10
  })
  
  const [errors, setErrors] = useState<ValidationErrors>({})

  // Fetch user profile on component mount
  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
  }, [user])

  // Update form data when profile is loaded
  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        role: userProfile.role,
        board: userProfile.board,
        medium: userProfile.medium,
        class: userProfile.class,
        stream: userProfile.stream,
        subjects: userProfile.subjects
      })
    }
  }, [userProfile, user])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      console.log('Fetching user profile...')
      const response = await fetch('/api/user/profile')
      const result = await response.json()

      console.log('Profile API response:', result)

      if (result.success && result.data) {
        console.log('Profile data received:', result.data)
        setUserProfile(result.data)
      } else {
        console.log('Profile not found or invalid response:', result)
        setError('Profile not found. Please complete onboarding first.')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setError('Failed to load profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!formData.role) {
      newErrors.role = 'Role is required'
    }
    if (!formData.board) {
      newErrors.board = 'Education board is required'
    }
    if (!formData.medium) {
      newErrors.medium = 'Language medium is required'
    }
    if (!formData.class || formData.class < 1 || formData.class > 12) {
      newErrors.class = 'Please select a valid class (1-12)'
    }
    if (formData.class >= 11 && !formData.stream) {
      newErrors.stream = 'Stream is required for classes 11-12'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Update Clerk user profile (name only)
      if (user && (user.firstName !== formData.firstName || user.lastName !== formData.lastName)) {
        await user.update({
          firstName: formData.firstName,
          lastName: formData.lastName
        })
      }

      // Update application profile
      const profileUpdate = {
        role: formData.role,
        board: formData.board,
        medium: formData.medium,
        class: formData.class,
        stream: formData.stream,
        subjects: formData.subjects || getDefaultSubjects(formData.class, formData.stream)
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileUpdate)
      })

      const result = await response.json()

      if (result.success) {
        setUserProfile(result.data)
        setIsEditing(false)
        setSuccessMessage('Profile updated successfully!')
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setError('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (userProfile) {
      setFormData({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        role: userProfile.role,
        board: userProfile.board,
        medium: userProfile.medium,
        class: userProfile.class,
        stream: userProfile.stream,
        subjects: userProfile.subjects
      })
    }
    setIsEditing(false)
    setErrors({})
    setError(null)
  }

  const updateFormData = (updates: Partial<ProfileFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    setErrors({}) // Clear errors when user makes changes
  }

  const getDefaultSubjects = (classLevel: number, stream?: Stream): string[] => {
    if (classLevel <= 10) {
      return ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi']
    }

    switch (stream) {
      case 'MATHEMATICS':
        return ['Physics', 'Chemistry', 'Mathematics', 'English']
      case 'BIOLOGY':
        return ['Physics', 'Chemistry', 'Biology', 'English']
      case 'COMMERCE':
        return ['Accountancy', 'Business Studies', 'Economics', 'English']
      case 'HUMANITIES':
        return ['History', 'Geography', 'Political Science', 'English']
      default:
        return ['English']
    }
  }

  const getCompletionPercentage = (): number => {
    if (!userProfile) return 0
    
    let completed = 0
    const total = 6
    
    if (userProfile.role) completed++
    if (userProfile.board) completed++
    if (userProfile.medium) completed++
    if (userProfile.class) completed++
    if (userProfile.class < 11 || userProfile.stream) completed++
    if (userProfile.isOnboardingComplete) completed++
    
    return Math.round((completed / total) * 100)
  }

  const getSubscriptionStatusColor = (plan: string) => {
    switch (plan) {
      case 'starter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'pro':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <User className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">
                <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Loading your profile...
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Please wait while we fetch your account information and preferences
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20 text-center max-w-2xl">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <AlertTriangle className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Profile Not Found
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                {error || 'Please complete the onboarding process to access your profile.'}
              </p>
              <Button
                onClick={() => window.location.href = '/dashboard/user/materials'}
                className="px-8 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
              >
                <span>Go to Materials Dashboard</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
            <User className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Account Management Center
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Profile Settings
            </span>
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Manage your account information, educational preferences, and subscription details
          </p>
        </div>

        {/* Enhanced Header Actions */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Profile Completion</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {getCompletionPercentage()}% of your profile is complete
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge
                className={`px-4 py-2 rounded-xl font-medium ${
                  getCompletionPercentage() === 100
                    ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-200'
                    : 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 text-yellow-600 border-yellow-200'
                }`}
              >
                {getCompletionPercentage()}% Complete
              </Badge>

              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
                >
                  <Edit className="h-5 w-5 mr-2" />
                  <span>Edit Profile</span>
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 h-10 rounded-xl border-gray-200 hover:border-gray-400 hover:bg-gray-50 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    <X className="h-4 w-4 mr-2" />
                    <span>Cancel</span>
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Success/Error Messages */}
        {successMessage && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-green-200/50 dark:border-green-700/50">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-green-800 dark:text-green-200">Success!</h4>
                <p className="text-green-700 dark:text-green-300">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-red-200/50 dark:border-red-700/50">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center mr-4">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-red-800 dark:text-red-200">Error</h4>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Personal Information */}
          <div className="lg:col-span-2 space-y-8">
            <PersonalInfoSection
              isEditing={isEditing}
              formData={formData}
              updateFormData={updateFormData}
              errors={errors}
              user={user}
            />

            <EducationalSettingsSection
              isEditing={isEditing}
              formData={formData}
              updateFormData={updateFormData}
              errors={errors}
              userProfile={userProfile}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <ProfileCompletionCard
              userProfile={userProfile}
              completionPercentage={getCompletionPercentage()}
            />

            <SubscriptionCard
              userProfile={userProfile}
              getSubscriptionStatusColor={getSubscriptionStatusColor}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Personal Information Section Component
interface PersonalInfoSectionProps {
  isEditing: boolean
  formData: ProfileFormData
  updateFormData: (updates: Partial<ProfileFormData>) => void
  errors: ValidationErrors
  user: any
}

function PersonalInfoSection({
  isEditing,
  formData,
  updateFormData,
  errors,
  user
}: PersonalInfoSectionProps) {
  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Personal Information
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your basic account information and contact details
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              First Name
            </label>
            {isEditing ? (
              <div>
                <Input
                  value={formData.firstName}
                  onChange={(e) => updateFormData({ firstName: e.target.value })}
                  placeholder="Enter your first name"
                  className={`h-12 rounded-xl ${errors.firstName ? 'border-red-500' : 'border-gray-200 focus:border-orange-500'}`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm mt-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {errors.firstName}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">
                {user?.firstName || 'Not provided'}
              </p>
            )}
          </div>

          <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              Last Name
            </label>
            {isEditing ? (
              <div>
                <Input
                  value={formData.lastName}
                  onChange={(e) => updateFormData({ lastName: e.target.value })}
                  placeholder="Enter your last name"
                  className={`h-12 rounded-xl ${errors.lastName ? 'border-red-500' : 'border-gray-200 focus:border-orange-500'}`}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm mt-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {errors.lastName}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">
                {user?.lastName || 'Not provided'}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
            Email Address
          </label>
          <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg mb-2">
            {user?.emailAddresses?.[0]?.emailAddress || 'Not provided'}
          </p>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Shield className="h-4 w-4 mr-1" />
            Email cannot be changed here. Please contact support if needed.
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
            Role
          </label>
          {isEditing ? (
            <div>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => updateFormData({ role: value })}
              >
                <SelectTrigger className={`h-12 rounded-xl ${errors.role ? 'border-red-500' : 'border-gray-200 focus:border-orange-500'}`}>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-red-500 text-sm mt-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {errors.role}
                </p>
              )}
            </div>
          ) : (
            <Badge className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-200 font-medium capitalize text-lg">
              {formData.role}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// Educational Settings Section Component
interface EducationalSettingsSectionProps {
  isEditing: boolean
  formData: ProfileFormData
  updateFormData: (updates: Partial<ProfileFormData>) => void
  errors: ValidationErrors
  userProfile: EnhancedUserProfile
}

function EducationalSettingsSection({
  isEditing,
  formData,
  updateFormData,
  errors,
  userProfile
}: EducationalSettingsSectionProps) {
  const needsStream = formData.class >= 11

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Educational Settings
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your academic context and learning preferences
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              Education Board
            </label>
            <Badge className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500/10 to-blue-500/10 text-orange-600 border-orange-200 font-medium text-lg mb-2">
              {userProfile.board}
            </Badge>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Shield className="h-4 w-4 mr-1" />
              Education board is determined by your subscription plan
            </div>
          </div>

          <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              Language Medium
            </label>
            <Badge className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-200 font-medium text-lg mb-2">
              {userProfile.medium}
            </Badge>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Shield className="h-4 w-4 mr-1" />
              Language medium is controlled by subscription
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              Class Level
            </label>
            <Badge className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-200 font-medium text-lg mb-2">
              Class {userProfile.class}
            </Badge>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Shield className="h-4 w-4 mr-1" />
              Class level is managed through subscription settings
            </div>
          </div>

          {userProfile.stream && (
            <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                Stream
              </label>
              <Badge className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 text-purple-600 border-purple-200 font-medium text-lg mb-2 capitalize">
                {userProfile.stream.toLowerCase()}
              </Badge>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Shield className="h-4 w-4 mr-1" />
                Stream selection is subscription-controlled
              </div>
            </div>
          )}
        </div>

        {userProfile.subjects && userProfile.subjects.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">
              Subjects
            </label>
            <div className="flex flex-wrap gap-3">
              {userProfile.subjects.map((subject) => (
                <Badge key={subject} className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-600 border-indigo-200 font-medium">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-blue-200/30">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mt-1">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-blue-800 dark:text-blue-200 text-lg mb-2">
                Educational Settings Protected
              </h4>
              <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                Your class level, education board, and stream are managed through your subscription plan
                to ensure you receive appropriate content. Contact support to modify these settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Profile Completion Card Component
interface ProfileCompletionCardProps {
  userProfile: EnhancedUserProfile
  completionPercentage: number
}

function ProfileCompletionCard({ userProfile, completionPercentage }: ProfileCompletionCardProps) {
  const completionItems = [
    { label: 'Role Selected', completed: !!userProfile.role, icon: User },
    { label: 'Education Board', completed: !!userProfile.board, icon: GraduationCap },
    { label: 'Language Medium', completed: !!userProfile.medium, icon: Globe },
    { label: 'Class Level', completed: !!userProfile.class, icon: BookOpen },
    {
      label: 'Stream Selection',
      completed: userProfile.class < 11 || !!userProfile.stream,
      icon: Sparkles,
      optional: userProfile.class < 11
    },
    { label: 'Onboarding Complete', completed: userProfile.isOnboardingComplete, icon: CheckCircle }
  ]

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Profile Completion
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {completionPercentage}% of your profile is complete
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="space-y-4">
          {completionItems.map((item, index) => {
            const Icon = item.icon
            return (
              <div key={index} className="flex items-center space-x-4 p-3 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  item.completed
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : item.optional
                    ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className={`font-medium ${
                    item.completed
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {item.label}
                    {item.optional && (
                      <span className="text-xs text-gray-500 ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">(Optional)</span>
                    )}
                  </span>
                </div>
                {item.completed && (
                  <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-gray-700 dark:text-gray-300">Overall Progress</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-orange-500 to-blue-600 h-3 rounded-full transition-all duration-500 shadow-md"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Subscription Card Component
interface SubscriptionCardProps {
  userProfile: EnhancedUserProfile
  getSubscriptionStatusColor: (plan: string) => string
}

function SubscriptionCard({ userProfile, getSubscriptionStatusColor }: SubscriptionCardProps) {
  const formatDate = (date?: Date) => {
    if (!date) return 'No expiration'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const isExpiringSoon = (date?: Date) => {
    if (!date) return false
    const daysUntilExpiry = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const isExpired = (date?: Date) => {
    if (!date) return false
    return new Date(date).getTime() < Date.now()
  }

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Subscription
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your current plan and features
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
              Current Plan
            </span>
            <Badge className={`px-4 py-2 rounded-xl font-medium text-lg ${getSubscriptionStatusColor(userProfile.subscription.plan)}`}>
              {userProfile.subscription.plan.charAt(0).toUpperCase() + userProfile.subscription.plan.slice(1)}
            </Badge>
          </div>

          {userProfile.subscription.expiresAt && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Star className="h-4 w-4 mr-2" />
              <span>Expires: </span>
              <span className={`ml-1 font-medium ${
                isExpired(userProfile.subscription.expiresAt)
                  ? 'text-red-600 dark:text-red-400'
                  : isExpiringSoon(userProfile.subscription.expiresAt)
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {formatDate(userProfile.subscription.expiresAt)}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 block">
            Available Features
          </span>
          <div className="space-y-3">
            {userProfile.subscription.features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium capitalize">
                  {feature.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {(isExpired(userProfile.subscription.expiresAt) || isExpiringSoon(userProfile.subscription.expiresAt)) && (
          <div className={`p-6 rounded-2xl border ${
            isExpired(userProfile.subscription.expiresAt)
              ? 'bg-gradient-to-r from-red-50/50 to-orange-50/50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200/50'
              : 'bg-gradient-to-r from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200/50'
          }`}>
            <div className="flex items-start space-x-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isExpired(userProfile.subscription.expiresAt)
                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500'
              }`}>
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className={`font-bold text-lg mb-2 ${
                  isExpired(userProfile.subscription.expiresAt)
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                  {isExpired(userProfile.subscription.expiresAt) ? 'Subscription Expired' : 'Expiring Soon'}
                </h4>
                <p className={`leading-relaxed ${
                  isExpired(userProfile.subscription.expiresAt)
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  {isExpired(userProfile.subscription.expiresAt)
                    ? 'Your subscription has expired. Renew to continue accessing premium features.'
                    : 'Your subscription expires soon. Renew to avoid interruption.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center">
          <CreditCard className="h-5 w-5 mr-2" />
          <span>Manage Subscription</span>
        </Button>
      </div>
    </div>
  )
}
