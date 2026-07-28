'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  User,
  GraduationCap,
  BookOpen,
  Globe2,
  Sparkles,
  Users,
  Backpack,
  Building2,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

interface Institution { id: string; name: string; type?: string | null }

type StepKey = 'identity' | 'role' | 'institution' | 'board' | 'medium' | 'class' | 'stream'

const fadeVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -15, scale: 0.98, transition: { duration: 0.3 } }
}
const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } } }

const roles: { value: UserRole; label: string; description: string; icon: any }[] = [
  { value: 'student', label: 'Student', description: 'I am here to learn and study', icon: Backpack },
  { value: 'teacher', label: 'Teacher', description: 'I teach and guide students', icon: GraduationCap },
  { value: 'parent', label: 'Parent', description: "I support my child's education", icon: Users },
  { value: 'guardian', label: 'Guardian', description: 'I guide and mentor students', icon: User }
]
const boards: { value: EducationBoard; label: string; description: string }[] = [
  { value: 'CBSE', label: 'CBSE', description: 'Central Board of Secondary Education' },
  { value: 'ICSE', label: 'ICSE', description: 'Indian Certificate of Secondary Education' },
  { value: 'STATE_BOARD', label: 'State Board', description: 'State Education Board' }
]
const mediums: { value: Medium; label: string; description: string }[] = [
  { value: 'ENGLISH', label: 'English', description: 'Study in English medium' },
  { value: 'HINDI', label: 'Hindi', description: 'Study in Hindi medium' }
]
const streams: { value: Stream; label: string; description: string; subjects: string[] }[] = [
  { value: 'MATHEMATICS', label: 'Mathematics', description: 'Physics, Chemistry, Mathematics', subjects: ['Physics', 'Chemistry', 'Mathematics', 'English'] },
  { value: 'BIOLOGY', label: 'Biology', description: 'Physics, Chemistry, Biology', subjects: ['Physics', 'Chemistry', 'Biology', 'English'] },
  { value: 'COMMERCE', label: 'Commerce', description: 'Accounts, Business, Economics', subjects: ['Accountancy', 'Business Studies', 'Economics', 'English'] },
  { value: 'HUMANITIES', label: 'Humanities', description: 'History, Geography, Political Sci.', subjects: ['History', 'Geography', 'Political Science', 'English'] }
]
const classNumbers = Array.from({ length: 12 }, (_, i) => i + 1)

export default function OnboardingModal({ isOpen, onComplete, onSkip }: OnboardingModalProps) {
  const { user } = useBetterAuthUser()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<OnboardingFormData>({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    role: 'student',
    board: 'CBSE',
    medium: 'ENGLISH',
    class: 10,
    institutionId: undefined,
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── B2B2C: institutions + existing membership ──
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [memberOrg, setMemberOrg] = useState<{ organizationId: string; name: string } | null>(null)
  const [instSearch, setInstSearch] = useState('')

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/institutions/membership').then((r) => r.json()).then((d) => {
      if (d?.success && d.member) setMemberOrg(d.member)
    }).catch(() => {})
    fetch('/api/institutions').then((r) => r.json()).then((d) => {
      if (d?.success) setInstitutions(d.institutions || [])
    }).catch(() => {})
  }, [isOpen])

  // Invited / already-enrolled students skip the institution choice (it's pre-set).
  const membershipLocked = !!memberOrg
  const needsStream = formData.class >= 11

  const steps = useMemo<StepKey[]>(() => {
    const s: StepKey[] = ['identity', 'role']
    if (!membershipLocked) s.push('institution')
    s.push('board', 'medium', 'class')
    if (needsStream) s.push('stream')
    return s
  }, [membershipLocked, needsStream])

  const totalSteps = steps.length
  const currentKey = steps[Math.min(currentStep, totalSteps) - 1]
  const isLastStep = currentStep >= totalSteps
  const progress = (currentStep / totalSteps) * 100

  const validateStep = (key: StepKey): boolean => {
    const e: ValidationErrors = {}
    switch (key) {
      case 'identity':
        if (!formData.firstName?.trim()) e.firstName = 'First name is required'
        if (!formData.lastName?.trim()) e.lastName = 'Last name is required'
        break
      case 'role': if (!formData.role) e.role = 'Please select your role'; break
      case 'institution': if (formData.institutionId === undefined) e.institution = 'Choose an institution or continue as an independent student'; break
      case 'board': if (!formData.board) e.board = 'Please select your education board'; break
      case 'medium': if (!formData.medium) e.medium = 'Please select your language medium'; break
      case 'class': if (!formData.class || formData.class < 1 || formData.class > 12) e.class = 'Please select a valid class (1-12)'; break
      case 'stream': if (needsStream && !formData.stream) e.stream = 'Please select your stream for classes 11-12'; break
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentKey) && currentStep < totalSteps) setCurrentStep(currentStep + 1)
  }
  const handlePrevious = () => { if (currentStep > 1) setCurrentStep(currentStep - 1) }

  const handleSubmit = async () => {
    if (!validateStep(currentKey)) return
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
    setErrors({})
  }

  const filteredInstitutions = institutions.filter((i) => i.name.toLowerCase().includes(instSearch.trim().toLowerCase()))

  const renderStepContent = () => {
    switch (currentKey) {
      // ===== Identity =====
      case 'identity':
        return (
          <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <div className="text-center mb-8">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-blue-600 text-white rounded-2xl shadow-lg">
                <Sparkles className="h-8 w-8" />
              </motion.div>
              <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-blue-600">Welcome to Digi Classroom!</h3>
              <p className="text-muted-foreground mt-2 text-lg">Let&apos;s start by getting to know you.</p>
            </div>
            <div className="space-y-5 max-w-sm mx-auto">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-semibold text-foreground tracking-tight">First Name</label>
                <input type="text" id="firstName" value={formData.firstName} onChange={(e) => updateFormData({ firstName: e.target.value })}
                  className={cn('flex h-12 w-full rounded-xl border bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all',
                    errors.firstName ? 'border-destructive focus-visible:ring-destructive/20' : 'border-input hover:border-orange-400/50 focus-visible:ring-orange-500/30 focus-visible:border-orange-500')}
                  placeholder="e.g., John" />
                {errors.firstName && <p className="text-xs font-medium text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-semibold text-foreground tracking-tight">Last Name</label>
                <input type="text" id="lastName" value={formData.lastName} onChange={(e) => updateFormData({ lastName: e.target.value })}
                  className={cn('flex h-12 w-full rounded-xl border bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all',
                    errors.lastName ? 'border-destructive focus-visible:ring-destructive/20' : 'border-input hover:border-blue-400/50 focus-visible:ring-blue-500/30 focus-visible:border-blue-500')}
                  placeholder="e.g., Doe" />
                {errors.lastName && <p className="text-xs font-medium text-destructive">{errors.lastName}</p>}
              </div>
            </div>
          </motion.div>
        )

      // ===== Role =====
      case 'role':
        return (
          <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><User className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">Choose Your Role</h3>
              <p className="text-muted-foreground mt-2">Let&apos;s personalize your learning experience</p>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((role) => (
                <motion.div key={role.value} variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <div className={cn('relative cursor-pointer transition-all duration-300 rounded-2xl border-2 p-5 h-full',
                    formData.role === role.value ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 shadow-lg shadow-purple-500/10' : 'border-border/50 hover:border-purple-300/50 hover:bg-muted/50 dark:hover:bg-muted/20')}
                    onClick={() => updateFormData({ role: role.value })}>
                    <div className="flex items-start gap-4">
                      <div className={cn('p-3 rounded-xl shadow-sm', formData.role === role.value ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' : 'bg-muted text-muted-foreground')}><role.icon className="h-6 w-6" /></div>
                      <div>
                        <h4 className={cn('font-semibold text-lg', formData.role === role.value ? 'text-purple-600 dark:text-purple-400' : 'text-foreground')}>{role.label}</h4>
                        <p className="text-sm text-muted-foreground mt-1 leading-snug">{role.description}</p>
                      </div>
                      {formData.role === role.value && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute top-4 right-4 text-purple-500"><CheckCircle2 className="h-6 w-6 fill-purple-500/20" /></motion.div>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
            {errors.role && <p className="text-destructive text-sm font-medium text-center mt-4">{errors.role}</p>}
          </motion.div>
        )

      // ===== Institution (B2B2C) =====
      case 'institution':
        return (
          <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><Building2 className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Your Institution</h3>
              <p className="text-muted-foreground mt-2">Join your school/college, or continue on your own</p>
            </div>

            {/* Independent option */}
            <div
              className={cn('cursor-pointer rounded-2xl border-2 p-4 transition-all', formData.institutionId === null ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg shadow-orange-500/10' : 'border-border/50 hover:border-orange-300/50 hover:bg-muted/40')}
              onClick={() => updateFormData({ institutionId: null })}
            >
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', formData.institutionId === null ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' : 'bg-muted text-muted-foreground')}><User className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Independent learner</p>
                  <p className="text-sm text-muted-foreground">Use Digi Classroom directly (B2C). You can join an institution later.</p>
                </div>
                {formData.institutionId === null && <CheckCircle2 className="h-5 w-5 text-orange-500 fill-orange-500/20" />}
              </div>
            </div>

            {/* Institution picker */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={instSearch} onChange={(e) => setInstSearch(e.target.value)} placeholder="Search for your institution…" className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
                {institutions.length === 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">No institutions available yet.</p>
                ) : filteredInstitutions.length === 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">No matches for “{instSearch}”.</p>
                ) : filteredInstitutions.map((inst) => (
                  <button key={inst.id} type="button" onClick={() => updateFormData({ institutionId: inst.id })}
                    className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors', formData.institutionId === inst.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-border/50 hover:bg-muted/50')}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white"><Building2 className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{inst.name}</p>
                      {inst.type && <p className="text-xs capitalize text-muted-foreground">{String(inst.type).replace('_', ' ')}</p>}
                    </div>
                    {formData.institutionId === inst.id && <CheckCircle2 className="h-5 w-5 text-blue-500 fill-blue-500/20" />}
                  </button>
                ))}
              </div>
              {formData.institutionId && formData.institutionId !== null && (
                <p className="text-xs text-muted-foreground">Your request will be sent to the institution admin for approval. You can keep learning meanwhile.</p>
              )}
            </div>
            {errors.institution && <p className="text-destructive text-sm font-medium text-center">{errors.institution}</p>}
          </motion.div>
        )

      // ===== Board =====
      case 'board':
        return (
          <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg"><Globe2 className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-600">Choose Your Education Board</h3>
              <p className="text-muted-foreground mt-2">This helps us provide curriculum-specific content</p>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3 max-w-md mx-auto">
              {boards.map((board) => (
                <motion.div key={board.value} variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <div className={cn('relative cursor-pointer transition-all duration-300 rounded-xl border-2 p-5',
                    formData.board === board.value ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-lg shadow-green-500/10' : 'border-border/50 hover:border-green-300/50 hover:bg-muted/50 dark:hover:bg-muted/20')}
                    onClick={() => updateFormData({ board: board.value })}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={cn('font-semibold text-lg', formData.board === board.value ? 'text-green-600 dark:text-green-400' : 'text-foreground')}>{board.label}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{board.description}</p>
                      </div>
                      {formData.board === board.value && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-500"><CheckCircle2 className="h-6 w-6 fill-green-500/20" /></motion.div>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
            {errors.board && <p className="text-destructive text-sm font-medium text-center mt-4">{errors.board}</p>}
          </motion.div>
        )

      // ===== Medium =====
      case 'medium':
        return (
          <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg"><BookOpen className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">Select Language Medium</h3>
              <p className="text-muted-foreground mt-2">Choose your preferred language for study materials</p>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
              {mediums.map((medium) => (
                <motion.div key={medium.value} variants={itemVariants} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <div className={cn('relative cursor-pointer transition-all duration-300 rounded-2xl border-2 p-6 text-center h-full flex flex-col items-center justify-center',
                    formData.medium === medium.value ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 shadow-lg shadow-blue-500/10' : 'border-border/50 hover:border-blue-300/50 hover:bg-muted/50 dark:hover:bg-muted/20')}
                    onClick={() => updateFormData({ medium: medium.value })}>
                    <div className="mb-2 w-full flex justify-end absolute top-3 right-3 h-6">{formData.medium === medium.value && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-blue-500"><CheckCircle2 className="h-5 w-5 fill-blue-500/20" /></motion.div>}</div>
                    <h4 className={cn('font-semibold text-xl', formData.medium === medium.value ? 'text-blue-600 dark:text-blue-400' : 'text-foreground')}>{medium.label}</h4>
                    <p className="text-sm text-muted-foreground mt-2">{medium.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
            {errors.medium && <p className="text-destructive text-sm font-medium text-center mt-4">{errors.medium}</p>}
          </motion.div>
        )

      // ===== Class =====
      case 'class':
        return (
          <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg"><GraduationCap className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600">Select Your Class</h3>
              <p className="text-muted-foreground mt-2">This helps us provide grade-appropriate content</p>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {classNumbers.map((classNum) => (
                <motion.div key={classNum} variants={itemVariants} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <div className={cn('relative cursor-pointer transition-all duration-200 rounded-xl border-2 py-4 px-2 text-center h-full flex flex-col justify-center',
                    formData.class === classNum ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 shadow-lg shadow-orange-500/10' : 'border-border/50 hover:border-orange-300/50 hover:bg-muted')}
                    onClick={() => updateFormData({ class: classNum, stream: undefined })}>
                    <div className={cn('text-xl font-bold tracking-tight', formData.class === classNum ? 'text-orange-600 dark:text-orange-400' : 'text-foreground')}>{classNum}</div>
                    {classNum >= 11 && <div className="text-[10px] uppercase font-bold text-orange-500/70 mt-1 tracking-wider">Stream</div>}
                    {formData.class === classNum && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 bg-background rounded-full"><CheckCircle2 className="h-5 w-5 text-orange-500 fill-orange-500/20" /></motion.div>}
                  </div>
                </motion.div>
              ))}
            </motion.div>
            {errors.class && <p className="text-destructive text-sm font-medium text-center mt-4">{errors.class}</p>}
          </motion.div>
        )

      // ===== Stream =====
      case 'stream':
        return (
          <motion.div variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg"><Sparkles className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-rose-600">Choose Your Stream</h3>
              <p className="text-muted-foreground mt-2">Select your specialization for Class {formData.class}</p>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {streams.map((stream) => (
                <motion.div key={stream.value} variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <div className={cn('relative cursor-pointer transition-all duration-300 rounded-2xl border-2 p-5 h-full',
                    formData.stream === stream.value ? 'border-pink-500 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 shadow-lg shadow-pink-500/10' : 'border-border/50 hover:border-pink-300/50 hover:bg-muted/50 dark:hover:bg-muted/20')}
                    onClick={() => updateFormData({ stream: stream.value, subjects: stream.subjects })}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={cn('font-semibold text-lg', formData.stream === stream.value ? 'text-pink-600 dark:text-pink-400' : 'text-foreground')}>{stream.label}</h4>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">{stream.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-auto">
                          {stream.subjects.map((subject) => <span key={subject} className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{subject}</span>)}
                        </div>
                      </div>
                      {formData.stream === stream.value && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-pink-500 ml-2"><CheckCircle2 className="h-6 w-6 fill-pink-500/20" /></motion.div>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
            {errors.stream && <p className="text-destructive text-sm font-medium text-center mt-4">{errors.stream}</p>}
          </motion.div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onSkip) onSkip() }}>
      <DialogContent
        className={cn('sm:max-w-2xl p-0 overflow-hidden border border-border/50 shadow-2xl bg-background', !onSkip && '[&>button]:hidden')}
        style={{ borderRadius: '1.5rem' }}
        onInteractOutside={(e) => { if (!onSkip) e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (!onSkip) e.preventDefault() }}
      >
        <DialogTitle className="sr-only">Complete your profile</DialogTitle>
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-br from-orange-500/15 via-blue-500/10 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-orange-500/20 to-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-blue-500/15 to-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <div className="px-8 pt-8 pb-4">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold tracking-wider uppercase text-muted-foreground/80 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-blue-600 text-white text-xs font-bold">{currentStep}</span>
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-blue-600 px-3 py-1 rounded-full shadow-sm">{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-1.5 w-full bg-gradient-to-r from-orange-100 to-blue-100 dark:from-orange-900/30 dark:to-blue-900/30"
              indicatorClassName="bg-gradient-to-r from-orange-500 to-blue-600 shadow-[0_0_12px_rgba(249,115,22,0.4)]" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <AnimatePresence mode="wait">
              <motion.div key={currentKey} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-gradient-to-r from-orange-50/50 to-blue-50/50 dark:from-gray-800/50 dark:to-gray-900/50 border-t border-border/50 mt-auto backdrop-blur-md">
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={handlePrevious} className={cn('flex items-center gap-2 font-medium transition-opacity', currentStep === 1 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-muted')}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex items-center space-x-3">
                {onSkip && currentStep === 1 && <Button variant="ghost" onClick={onSkip} className="text-muted-foreground hover:text-foreground">Skip for now</Button>}
                <Button onClick={isLastStep ? handleSubmit : handleNext} disabled={isSubmitting}
                  className="flex items-center gap-2 font-semibold shadow-lg rounded-xl px-6 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white border-0" size="lg">
                  {isLastStep ? (
                    isSubmitting ? <><Sparkles className="h-4 w-4 animate-spin" /> Finalizing...</> : <>Complete Setup <CheckCircle2 className="h-4 w-4" /></>
                  ) : (
                    <>Continue <ChevronRight className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
