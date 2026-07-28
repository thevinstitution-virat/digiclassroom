import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { organization, institutionProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Building2, Globe, Mail, Phone, MapPin, Calendar, CreditCard, Box, Users } from 'lucide-react'
import { parseEntitlements, INSTITUTION_FEATURES } from '@/lib/institution/features'
import OrgPlanEditor from './OrgPlanEditor'

export default async function OrganizationDetailsPage({ params }: { params: { orgId: string } }) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const { orgId } = params

  const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)
  if (!org) return notFound()

  const [profile] = await db.select().from(institutionProfiles).where(eq(institutionProfiles.organizationId, orgId)).limit(1)

  const ent = parseEntitlements(org.settings)
  
  let metaType: string | null = null
  try {
    metaType = org.metadata ? (JSON.parse(org.metadata) as { type?: string }).type ?? null : null
  } catch {}
  
  const orgType = profile?.type ?? metaType ?? 'school'
  const plan = ent.plan ?? org.subscriptionPlan ?? 'none'

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <div>
        <Link href="/dashboard/super-admin/organizations" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Organizations
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
              <Building2 className="h-6 w-6 text-violet-600" /> {org.name}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">/{org.slug}</span>
              <span className="capitalize">{orgType.replace('_', ' ')}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                org.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                org.subscriptionStatus === 'trial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                Status: {org.subscriptionStatus ?? 'Trial'}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                plan === 'enterprise' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                plan === 'professional' || plan === 'pro' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                Plan: {plan}
              </span>
            </div>
            
            <OrgPlanEditor 
              orgId={org.id} 
              initialPlan={plan as any} 
              initialStatus={(org.subscriptionStatus as any) ?? 'trial'} 
              initialFee={Number(org.platformFeeRate ?? 0.05)} 
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-6 py-4">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Box className="h-4 w-4 text-violet-500" /> Profile Details
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Contact Email</p>
                <p className="text-sm text-gray-500">{profile?.contactEmail || <span className="italic text-gray-400">Not provided</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Contact Phone</p>
                <p className="text-sm text-gray-500">{profile?.contactPhone || <span className="italic text-gray-400">Not provided</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Website</p>
                {profile?.website ? (
                  <a href={profile.website} target="_blank" rel="noreferrer" className="text-sm text-violet-600 hover:underline">{profile.website}</a>
                ) : (
                  <p className="text-sm italic text-gray-400">Not provided</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Address</p>
                <p className="text-sm text-gray-500">{profile?.address || <span className="italic text-gray-400">Not provided</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Established Year</p>
                <p className="text-sm text-gray-500">{profile?.establishedYear || <span className="italic text-gray-400">Not provided</span>}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup & Features Card */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-6 py-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-violet-500" /> Platform Entitlements
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Allowed Features</span>
                    <span className="text-gray-500">{ent.allowedFeatures.length} enabled</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ent.allowedFeatures.map(f => {
                      const featureName = INSTITUTION_FEATURES.find(x => x.key === f)?.name || f
                      const isTurnedOn = ent.enabledFeatures.includes(f)
                      return (
                        <span key={f} className={`px-2 py-1 text-xs font-medium rounded-md border ${
                          isTurnedOn 
                            ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800' 
                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                        }`}>
                          {featureName} {isTurnedOn ? '(On)' : '(Off)'}
                        </span>
                      )
                    })}
                    {ent.allowedFeatures.length === 0 && (
                      <span className="text-xs text-gray-400 italic">No features allowed.</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Allowed features are granted by the Super Admin plan. "On/Off" indicates if the institution admin has actively turned them on.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Onboarding Status</p>
                <p className="text-sm text-gray-500 mt-1">
                  {profile?.onboardingCompleted 
                    ? "Institution profile is fully set up." 
                    : "Institution profile is pending completion."}
                </p>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                profile?.onboardingCompleted 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}>
                {profile?.onboardingCompleted ? 'Completed' : 'Pending'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
