'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Image as ImageIcon, Palette, Mail, MapPin, Globe, Phone,
  Check, ChevronRight, ChevronLeft, Loader2, AlertCircle, Rocket
} from 'lucide-react'
import { api } from '@/lib/trpc/react'
import { completeOnboardingSchema } from '@/lib/trpc/routers/institutionProfiles'
import { toast } from 'sonner'

type ProfileData = typeof completeOnboardingSchema._type

const PRESET_COLORS = [
  '#6366f1', // Indigo (default)
  '#3b82f6', // Blue
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#1e293b', // Slate
]

const STEPS = ['Branding', 'Contact', 'Review']

export default function InstitutionOnboardingWizard({ initialData }: { initialData: Partial<ProfileData> }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  
  const [formData, setFormData] = useState<ProfileData>({
    logoUrl: initialData?.logoUrl || '',
    bannerUrl: initialData?.bannerUrl || '',
    primaryColor: initialData?.primaryColor || '#6366f1',
    contactEmail: initialData?.contactEmail || '',
    contactPhone: initialData?.contactPhone || '',
    address: initialData?.address || '',
    website: initialData?.website || '',
  })

  const mutation = api.institutionProfiles.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success('Institution profile completed!')
      router.refresh()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to complete setup')
    }
  })

  const updateField = (field: keyof ProfileData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Step validation
  const canNext = () => {
    if (step === 0) {
      return formData.logoUrl.trim().length > 0 && /^#[0-9A-Fa-f]{6}$/.test(formData.primaryColor)
    }
    if (step === 1) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail) && formData.address.trim().length >= 5
    }
    return true
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg">
            <Rocket className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Welcome to your Institution</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Let's finish setting up your branding and contact details.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center px-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  i < step ? 'bg-green-500 text-white'
                  : i === step ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`hidden sm:block text-sm font-medium ${i === step ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-4 h-0.5 w-12 sm:w-24 transition-colors ${i < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          
          {/* STEP 0: Branding */}
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <ImageIcon className="h-4 w-4 text-gray-400" /> Logo URL <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <input
                      type="url"
                      value={formData.logoUrl}
                      onChange={(e) => updateField('logoUrl', e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-950"
                    />
                    {formData.logoUrl && (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden dark:border-gray-700 dark:bg-gray-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={formData.logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <ImageIcon className="h-4 w-4 text-gray-400" /> Banner URL <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={formData.bannerUrl}
                    onChange={(e) => updateField('bannerUrl', e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Recommended size: 1200x300px.</p>
                  {formData.bannerUrl && (
                    <div className="mt-3 h-24 w-full rounded-xl border border-gray-200 bg-gray-50 overflow-hidden dark:border-gray-700 dark:bg-gray-800 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={formData.bannerUrl} alt="Banner preview" className="absolute inset-0 h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Palette className="h-4 w-4 text-gray-400" /> Primary Color <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-11 w-11 overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700 focus-within:ring-2 focus-within:ring-violet-500">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                        className="h-16 w-16 -translate-x-2 -translate-y-2 cursor-pointer"
                      />
                    </div>
                    <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2" />
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateField('primaryColor', color)}
                        className={`h-8 w-8 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${formData.primaryColor === color ? 'border-gray-900 scale-110 dark:border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Contact */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Mail className="h-4 w-4 text-gray-400" /> Contact Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                    placeholder="office@institution.edu"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Phone className="h-4 w-4 text-gray-400" /> Phone <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Globe className="h-4 w-4 text-gray-400" /> Website <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://institution.edu"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-950"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <MapPin className="h-4 w-4 text-gray-400" /> Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Education Lane&#10;City, State 12345"
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-700 dark:bg-gray-950"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Review */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="rounded-xl border border-gray-200 overflow-hidden dark:border-gray-800">
                {/* Mock Header */}
                <div 
                  className="flex items-center gap-3 px-4 py-3 text-white shadow-sm"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  {formData.logoUrl ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10 p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={formData.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  ) : (
                    <Building2 className="h-6 w-6" />
                  )}
                  <div className="font-semibold text-white">Your Dashboard</div>
                </div>
                
                <div className="bg-gray-50 p-4 dark:bg-gray-900 space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">This is a preview of how your brand color and logo will appear in the navigation bar.</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                      <dd className="font-medium text-gray-900 dark:text-white mt-0.5">{formData.contactEmail}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Address</dt>
                      <dd className="font-medium text-gray-900 dark:text-white mt-0.5 whitespace-pre-wrap">{formData.address}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {mutation.isError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{mutation.error.message}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0 || mutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate(formData)}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 transition-all hover:shadow-lg"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {mutation.isPending ? 'Saving...' : 'Complete Setup'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
