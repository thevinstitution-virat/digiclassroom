'use client'

// Super-admin institution onboarding wizard (B2B2C).
// Steps: Details → Plan & Features → Authority → Review → POST /api/super-admin/onboarding.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2, School, GraduationCap, Store, Check, ChevronLeft, ChevronRight,
  Rocket, Mail, ShieldCheck, ArrowRight, Loader2, PartyPopper, AlertCircle,
} from 'lucide-react'
import {
  PLAN_FEATURES, INSTITUTION_FEATURES, type InstitutionPlan,
} from '@/lib/institution/features'

type OrgType = 'school' | 'college' | 'tuition_center'

const TYPES: { key: OrgType; name: string; icon: typeof School }[] = [
  { key: 'school', name: 'School', icon: School },
  { key: 'college', name: 'College', icon: GraduationCap },
  { key: 'tuition_center', name: 'Tuition Center', icon: Store },
]

const PLANS: { key: InstitutionPlan; name: string; tagline: string; grad: string }[] = [
  { key: 'starter', name: 'Starter', tagline: 'Core AI tutoring essentials', grad: 'from-[var(--peacock-teal)] to-[var(--indigo-deep)]' },
  { key: 'professional', name: 'Professional', tagline: 'Full learning suite for growing institutions', grad: 'from-primary to-primary/80' },
  { key: 'enterprise', name: 'Enterprise', tagline: 'Everything, unlimited', grad: 'from-primary to-primary/80' },
]

const STEPS = ['Details', 'Plan & Features', 'Authority', 'Review']

const featureName = (key: string) =>
  INSTITUTION_FEATURES.find((f) => f.key === key)?.name ?? key

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ slug: string; adminInvited: boolean; emailTestMode: boolean } | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [type, setType] = useState<OrgType>('school')
  const [contactEmail, setContactEmail] = useState('')
  const [plan, setPlan] = useState<InstitutionPlan>('professional')
  const [adminEmail, setAdminEmail] = useState('')

  const effectiveSlug = slugEdited ? slug : slugify(name)
  const planFeatures = useMemo(() => PLAN_FEATURES[plan], [plan])

  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  const canNext = (() => {
    if (step === 0) return name.trim().length >= 2 && effectiveSlug.length >= 2
    if (step === 1) return !!plan
    if (step === 2) return emailOk(adminEmail)
    return true
  })()

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: effectiveSlug,
          type,
          contactEmail: contactEmail.trim(),
          adminEmail: adminEmail.trim(),
          plan,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Failed to onboard institution')
        return
      }
      setDone({ slug: data.slug, adminInvited: !!data.adminInvited, emailTestMode: !!data.emailTestMode })
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
          <PartyPopper className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{name} is onboarded!</h1>
        <p className="mt-2 text-muted-foreground">
          The institution was created on the <span className="font-semibold capitalize">{plan}</span> plan.
          {done.adminInvited
            ? <> An invitation for <span className="font-semibold">{adminEmail}</span> was created.</>
            : <> But the admin invite could not be created — re-invite from the institution page.</>}
        </p>

        {done.emailTestMode && (
          <div className="mx-auto mt-5 max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-semibold">⚠️ Email is in Resend test mode — the invite was NOT delivered.</p>
            <p className="mt-1">
              Your sender is <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">onboarding@resend.dev</code>,
              which can only deliver to your own Resend account email. To email real institution admins, verify a
              domain at <span className="font-medium">resend.com/domains</span> and set <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">EMAIL_FROM</code> to use it.
            </p>
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard/super-admin/organizations" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-5 py-2.5 font-semibold text-white shadow hover:shadow-lg">
            View organizations <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => {
              setDone(null); setStep(0); setName(''); setSlug(''); setSlugEdited(false)
              setType('school'); setContactEmail(''); setPlan('professional'); setAdminEmail('')
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 font-semibold text-foreground hover:bg-muted/50 dark:hover:bg-muted"
          >
            <Rocket className="h-4 w-4" /> Onboard another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Header */}
      <div>
        <Link href="/dashboard/super-admin" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Rocket className="h-6 w-6 text-primary" /> Onboard Institution
        </h1>
        <p className="mt-1 text-muted-foreground">Create a new institution and invite its administrator.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                i < step ? 'bg-green-500 text-white'
                : i === step ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground'}`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`hidden text-sm font-medium sm:block ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 ${i < step ? 'bg-green-500' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {/* Step 0 — Details */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Institution name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunrise Public School"
                className="w-full rounded-xl border border-input px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Slug (URL identifier)</label>
              <input
                value={effectiveSlug}
                onChange={(e) => { setSlugEdited(true); setSlug(slugify(e.target.value)) }}
                placeholder="sunrise-public-school"
                className="w-full rounded-xl border border-input px-4 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers and hyphens. Auto-filled from the name.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Type</label>
              <div className="grid grid-cols-3 gap-3">
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                      type === t.key ? 'border-primary bg-primary/10' : 'border-border hover:border-input'}`}
                  >
                    <t.icon className={`h-6 w-6 ${type === t.key ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${type === t.key ? 'text-primary' : 'text-muted-foreground'}`}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Contact email <span className="text-muted-foreground">(optional)</span></label>
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="office@institution.edu"
                className="w-full rounded-xl border border-input px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        )}

        {/* Step 1 — Plan & Features */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPlan(p.key)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    plan === p.key ? 'border-primary bg-primary/10' : 'border-border hover:border-input'}`}
                >
                  <div className={`mb-2 inline-flex rounded-lg bg-gradient-to-br ${p.grad} px-2 py-1 text-xs font-bold text-white`}>{p.name}</div>
                  <p className="text-xs text-muted-foreground">{p.tagline}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{PLAN_FEATURES[p.key].length} features</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Included in the {plan} plan</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {planFeatures.map((k) => (
                  <div key={k} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-green-500" /> {featureName(k)}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">The institution admin can toggle any of these on/off for their students.</p>
            </div>
          </div>
        )}

        {/* Step 2 — Authority */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl bg-primary/10 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-primary">
                The administrator becomes the institution&apos;s owner-level admin. They&apos;ll receive an email
                invitation and must verify their email on first sign-in.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Institution admin email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@institution.edu"
                  className="w-full rounded-xl border border-input py-2.5 pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {adminEmail && !emailOk(adminEmail) && (
                <p className="mt-1 text-xs text-red-500">Enter a valid email address.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Review &amp; confirm</h3>
            <dl className="divide-y divide-border rounded-xl border border-border">
              {[
                ['Institution', name],
                ['Slug', effectiveSlug],
                ['Type', TYPES.find((t) => t.key === type)?.name ?? type],
                ['Contact', contactEmail || '—'],
                ['Plan', plan.charAt(0).toUpperCase() + plan.slice(1)],
                ['Features', `${planFeatures.length} enabled`],
                ['Admin invite', adminEmail],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2.5 font-medium text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-5 py-2.5 font-semibold text-white shadow disabled:opacity-40 hover:shadow-lg"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 font-semibold text-white shadow disabled:opacity-60 hover:shadow-lg"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Onboarding…</> : <><Building2 className="h-4 w-4" /> Onboard institution</>}
          </button>
        )}
      </div>
    </div>
  )
}
