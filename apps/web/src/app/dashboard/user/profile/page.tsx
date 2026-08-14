'use client'

import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import JoinInstitutionPanel from '@/components/institution/JoinInstitutionPanel'
import {
  EnhancedUserProfile,
  UserRole,
  EducationBoard,
  Medium,
  Stream
} from '@/types/user-management'

// Presentation ported to the .dcs Indic mock (DigiClassroom Student App.dc.html).
// All profile data, edit/validation/save logic and the JoinInstitution flow are
// unchanged — only the presentation layer moved onto the warm-Indic tokens.

const GP = 'linear-gradient(135deg,var(--kumkum),var(--saffron))'
const GC = 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))'
const GW = 'linear-gradient(135deg,var(--turmeric),var(--gold))'
const GT = 'linear-gradient(135deg,var(--teal-light),var(--peacock-teal))'
const GV = 'linear-gradient(135deg,var(--lotus-deep),var(--lotus-pink))'

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
  const { user } = useBetterAuthUser()
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
        firstName: user?.name?.split(' ')[0] || '',
        lastName: user?.name?.split(' ').slice(1).join(' ') || '',
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
      const response = await fetch('/api/user/profile')
      const result = await response.json()

      if (result.success && result.data) {
        setUserProfile(result.data)
      } else {
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

    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName?.trim()) {
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
      const profileUpdate = {
        firstName: formData.firstName,
        lastName: formData.lastName,
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
        firstName: user?.name?.split(' ')[0] || '',
        lastName: user?.name?.split(' ').slice(1).join(' ') || '',
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
    setErrors({})
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
    if (!userProfile)
      return 0

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

  const getSubscriptionStatusGrad = (plan: string) => {
    switch (plan) {
      case 'starter': return GC
      case 'pro': return GT
      case 'enterprise': return GV
      default: return GW
    }
  }

  if (loading) {
    return (
      <div className="dcs">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <span className="plinth spin" style={{ width: 64, height: 64, margin: '0 auto 18px', background: GP }}>
              <User className="h-8 w-8" />
            </span>
            <h3 className="grad" style={{ fontSize: 20, fontWeight: 800 }}>Loading your profile…</h3>
            <p style={{ color: 'var(--muted)', maxWidth: '40ch', margin: '8px auto 0', fontSize: 14 }}>
              Please wait while we fetch your account information and preferences.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className="dcs">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 560 }}>
            <span className="plinth" style={{ width: 64, height: 64, margin: '0 auto 18px', background: GW }}>
              <AlertTriangle className="h-8 w-8" />
            </span>
            <h3 className="grad" style={{ fontSize: 24, fontWeight: 800 }}>Profile not found</h3>
            <p style={{ color: 'var(--muted)', margin: '10px 0 20px', fontSize: 15 }}>
              {error || 'Please complete the onboarding process to access your profile.'}
            </p>
            <button className="btn btn-primary" onClick={() => window.location.href = '/dashboard/user/materials'}>
              Go to materials dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const initials = `${(formData.firstName || user?.name || 'U').charAt(0)}${(formData.lastName || '').charAt(0)}`.toUpperCase()
  const completion = getCompletionPercentage()

  return (
    <div className="dcs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Profile hero card */}
        <div className="card" style={{ padding: 26, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <span className="plinth" style={{ width: 76, height: 76, flex: 'none', background: GC, fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 28 }}>
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>
              {[formData.firstName, formData.lastName].filter(Boolean).join(' ') || user?.name || 'Your profile'}
            </h2>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 3 }}>
              <span style={{ textTransform: 'capitalize' }}>{userProfile.role}</span> · {userProfile.board} · Class {userProfile.class}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)', textTransform: 'capitalize' }}>
                <Sparkles className="h-[13px] w-[13px]" /> {userProfile.subscription.plan} plan
              </span>
              <span className="tag" style={{ background: completion === 100 ? 'rgb(14 159 110 / 0.14)' : 'var(--chip-bg)', color: completion === 100 ? 'var(--emerald)' : 'var(--accent-text)' }}>
                <CheckCircle className="h-[13px] w-[13px]" /> {completion}% complete
              </span>
            </div>
          </div>
          {!isEditing ? (
            <button className="btn btn-primary" style={{ flex: 'none' }} onClick={() => setIsEditing(true)}>
              <Edit className="h-5 w-5" /> Edit profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
              <button className="btn btn-ghost" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4" /> Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : <><CheckCircle className="h-5 w-5" /> Save changes</>}
              </button>
            </div>
          )}
        </div>

        {/* Success / error messages */}
        {successMessage && (
          <div className="card" style={{ padding: 16, borderColor: 'rgb(14 159 110 / 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="plinth" style={{ width: 40, height: 40, flex: 'none', background: GT }}><CheckCircle className="h-5 w-5" /></span>
              <div>
                <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--emerald)' }}>Success!</h4>
                <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card" style={{ padding: 16, borderColor: 'rgb(192 57 43 / 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="plinth" style={{ width: 40, height: 40, flex: 'none', background: 'linear-gradient(135deg,var(--kumkum),var(--lotus-deep))' }}><AlertTriangle className="h-5 w-5" /></span>
              <div>
                <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--kumkum)' }}>Error</h4>
                <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="two-col" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
          {/* Main */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <PersonalInfoSection
              isEditing={isEditing}
              formData={formData}
              updateFormData={updateFormData}
              errors={errors}
              user={user}
            />
            <EducationalSettingsSection userProfile={userProfile} />
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <ProfileCompletionCard userProfile={userProfile} completionPercentage={completion} />
            <SubscriptionCard userProfile={userProfile} getSubscriptionStatusGrad={getSubscriptionStatusGrad} />
            <JoinInstitutionPanel
              requestedClass={userProfile.class}
              requestedBoard={userProfile.board}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section header ──
function SectionHead({ Icon, grad, title, subtitle }: { Icon: React.ComponentType<{ className?: string }>; grad: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <span className="plinth" style={{ width: 44, height: 44, flex: 'none', background: grad }}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <div>
        <h3 className="sech" style={{ fontSize: 18 }}>{title}</h3>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{subtitle}</p>
      </div>
    </div>
  )
}

// ── Field wrapper (label + value/editor) ──
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  )
}

function LockedNote({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
      <Shield className="h-[14px] w-[14px]" /> {text}
    </div>
  )
}

// Personal Information Section
interface PersonalInfoSectionProps {
  isEditing: boolean
  formData: ProfileFormData
  updateFormData: (updates: Partial<ProfileFormData>) => void
  errors: ValidationErrors
  user: any
}

function PersonalInfoSection({ isEditing, formData, updateFormData, errors, user }: PersonalInfoSectionProps) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <SectionHead Icon={User} grad={GC} title="Personal information" subtitle="Your basic account information and contact details" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="First name">
            {isEditing ? (
              <>
                <Input value={formData.firstName} onChange={(e) => updateFormData({ firstName: e.target.value })} placeholder="Enter your first name" className="h-11 rounded-xl" />
                {errors.firstName && <p style={{ color: 'var(--kumkum)', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle className="h-[14px] w-[14px]" />{errors.firstName}</p>}
              </>
            ) : (
              <p style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16, margin: 0 }}>{user?.name?.split(' ')[0] || formData.firstName || 'Not provided'}</p>
            )}
          </Field>
          <Field label="Last name">
            {isEditing ? (
              <>
                <Input value={formData.lastName} onChange={(e) => updateFormData({ lastName: e.target.value })} placeholder="Enter your last name" className="h-11 rounded-xl" />
                {errors.lastName && <p style={{ color: 'var(--kumkum)', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle className="h-[14px] w-[14px]" />{errors.lastName}</p>}
              </>
            ) : (
              <p style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16, margin: 0 }}>{user?.name?.split(' ').slice(1).join(' ') || formData.lastName || 'Not provided'}</p>
            )}
          </Field>
        </div>

        <Field label="Email address">
          <p style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16, margin: 0 }}>{user?.email || 'Not provided'}</p>
          <LockedNote text="Email cannot be changed here. Please contact support if needed." />
        </Field>

        <Field label="Role">
          {isEditing ? (
            <>
              <Select value={formData.role} onValueChange={(value: UserRole) => updateFormData({ role: value })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select your role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p style={{ color: 'var(--kumkum)', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle className="h-[14px] w-[14px]" />{errors.role}</p>}
            </>
          ) : (
            <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)', textTransform: 'capitalize', fontSize: 14, padding: '5px 12px' }}>{formData.role}</span>
          )}
        </Field>
      </div>
    </div>
  )
}

// Educational Settings Section
function EducationalSettingsSection({ userProfile }: { userProfile: EnhancedUserProfile }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <SectionHead Icon={GraduationCap} grad={GV} title="Educational settings" subtitle="Your academic context and learning preferences" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Education board">
            <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)', fontSize: 14, padding: '5px 12px' }}>{userProfile.board}</span>
            <LockedNote text="Determined by your subscription plan" />
          </Field>
          <Field label="Language medium">
            <span className="tag" style={{ background: 'rgb(14 159 110 / 0.14)', color: 'var(--emerald)', fontSize: 14, padding: '5px 12px' }}>{userProfile.medium}</span>
            <LockedNote text="Controlled by subscription" />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Class level">
            <span className="tag" style={{ background: 'rgb(0 106 110 / 0.12)', color: '#006A6E', fontSize: 14, padding: '5px 12px' }}>Class {userProfile.class}</span>
            <LockedNote text="Managed through subscription settings" />
          </Field>
          {userProfile.stream && (
            <Field label="Stream">
              <span className="tag" style={{ background: 'rgb(233 30 140 / 0.12)', color: 'var(--lotus-deep)', fontSize: 14, padding: '5px 12px', textTransform: 'capitalize' }}>{userProfile.stream.toLowerCase()}</span>
              <LockedNote text="Subscription-controlled" />
            </Field>
          )}
        </div>

        {userProfile.subjects && userProfile.subjects.length > 0 && (
          <Field label="Subjects">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              {userProfile.subjects.map((subject) => (
                <span key={subject} className="tag" style={{ background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)' }}>{subject}</span>
              ))}
            </div>
          </Field>
        )}

        <div style={{ display: 'flex', gap: 12, padding: 16, borderRadius: 14, background: 'rgb(0 106 110 / 0.08)', border: '1px solid rgb(0 106 110 / 0.18)' }}>
          <span className="plinth" style={{ width: 40, height: 40, flex: 'none', background: GC }}><Shield className="h-5 w-5" /></span>
          <div>
            <h4 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>Educational settings protected</h4>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
              Your class level, education board, and stream are managed through your subscription plan to ensure appropriate content. Contact support to modify these settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Profile Completion Card
function ProfileCompletionCard({ userProfile, completionPercentage }: { userProfile: EnhancedUserProfile; completionPercentage: number }) {
  const completionItems = [
    { label: 'Role selected', completed: !!userProfile.role, icon: User },
    { label: 'Education board', completed: !!userProfile.board, icon: GraduationCap },
    { label: 'Language medium', completed: !!userProfile.medium, icon: Globe },
    { label: 'Class level', completed: !!userProfile.class, icon: BookOpen },
    { label: 'Stream selection', completed: userProfile.class < 11 || !!userProfile.stream, icon: Sparkles, optional: userProfile.class < 11 },
    { label: 'Onboarding complete', completed: userProfile.isOnboardingComplete, icon: CheckCircle }
  ]

  return (
    <div className="card" style={{ padding: 22 }}>
      <SectionHead Icon={CheckCircle} grad={GT} title="Profile completion" subtitle={`${completionPercentage}% of your profile is complete`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {completionItems.map((item, index) => {
          const Icon = item.icon
          const bg = item.completed ? GT : item.optional ? 'linear-gradient(135deg,var(--muted),var(--muted))' : GW
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
              <span className="plinth" style={{ width: 34, height: 34, flex: 'none', background: bg }}><Icon className="h-[17px] w-[17px]" /></span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: item.completed ? 'var(--ink)' : 'var(--muted)' }}>
                {item.label}
                {item.optional && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8, padding: '1px 7px', background: 'var(--chip-bg)', borderRadius: 8 }}>Optional</span>}
              </span>
              {item.completed && <CheckCircle className="h-[18px] w-[18px]" style={{ color: 'var(--emerald)' }} />}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Overall progress</span>
          <span className="grad" style={{ fontSize: 20, fontWeight: 800 }}>{completionPercentage}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, width: `${completionPercentage}%`, background: 'linear-gradient(90deg,var(--accent-strong),var(--gold))', transition: 'width .5s' }} />
        </div>
      </div>
    </div>
  )
}

// Subscription Card
function SubscriptionCard({ userProfile, getSubscriptionStatusGrad }: { userProfile: EnhancedUserProfile; getSubscriptionStatusGrad: (plan: string) => string }) {
  const formatDate = (date?: Date) => {
    if (!date)
      return 'No expiration'
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const isExpiringSoon = (date?: Date) => {
    if (!date)
      return false
    const daysUntilExpiry = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const isExpired = (date?: Date) => {
    if (!date)
      return false
    return new Date(date).getTime() < Date.now()
  }

  const expiresAt = userProfile.subscription.expiresAt
  const expiryColor = isExpired(expiresAt) ? 'var(--kumkum)' : isExpiringSoon(expiresAt) ? 'var(--turmeric)' : 'var(--emerald)'

  return (
    <div className="card" style={{ padding: 22 }}>
      <SectionHead Icon={CreditCard} grad={GV} title="Subscription" subtitle="Your current plan and features" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 14, borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expiresAt ? 10 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Current plan</span>
            <span className="tag" style={{ background: getSubscriptionStatusGrad(userProfile.subscription.plan), color: '#fff', fontSize: 13, padding: '5px 12px', textTransform: 'capitalize' }}>
              {userProfile.subscription.plan}
            </span>
          </div>
          {expiresAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
              <Star className="h-4 w-4" /> Expires: <span style={{ marginLeft: 2, fontWeight: 600, color: expiryColor }}>{formatDate(expiresAt)}</span>
            </div>
          )}
        </div>

        <div style={{ padding: 14, borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 10 }}>Available features</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {userProfile.subscription.features.map((feature, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle className="h-[18px] w-[18px]" style={{ color: 'var(--emerald)', flex: 'none' }} />
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, textTransform: 'capitalize' }}>{feature.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {(isExpired(expiresAt) || isExpiringSoon(expiresAt)) && (
          <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 12, background: isExpired(expiresAt) ? 'rgb(192 57 43 / 0.08)' : 'rgb(245 166 35 / 0.1)', border: `1px solid ${isExpired(expiresAt) ? 'rgb(192 57 43 / 0.3)' : 'rgb(245 166 35 / 0.3)'}` }}>
            <span className="plinth" style={{ width: 40, height: 40, flex: 'none', background: isExpired(expiresAt) ? 'linear-gradient(135deg,var(--kumkum),var(--lotus-deep))' : GW }}><AlertTriangle className="h-5 w-5" /></span>
            <div>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: 14, color: isExpired(expiresAt) ? 'var(--kumkum)' : 'var(--turmeric)' }}>
                {isExpired(expiresAt) ? 'Subscription expired' : 'Expiring soon'}
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                {isExpired(expiresAt)
                  ? 'Your subscription has expired. Renew to continue accessing premium features.'
                  : 'Your subscription expires soon. Renew to avoid interruption.'}
              </p>
            </div>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%' }}>
          <CreditCard className="h-5 w-5" /> Manage subscription
        </button>
      </div>
    </div>
  )
}
