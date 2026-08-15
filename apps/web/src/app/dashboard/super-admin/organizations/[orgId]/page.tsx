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
        <Link href="/dashboard/super-admin/organizations" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Organizations
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Building2 className="h-6 w-6 text-primary" /> {org.name}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">/{org.slug}</span>
              <span className="capitalize">{orgType.replace('_', ' ')}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                org.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                org.subscriptionStatus === 'trial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                'bg-muted text-foreground dark:text-muted-foreground/60'
              }`}>
                Status: {org.subscriptionStatus ?? 'Trial'}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                plan === 'enterprise' ? 'bg-primary/15 text-primary' :
                plan === 'professional' || plan === 'pro' ? 'bg-primary/15 text-primary' :
                'bg-muted text-foreground'
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
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-6 py-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" /> Profile Details
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Contact Email</p>
                <p className="text-sm text-muted-foreground">{profile?.contactEmail || <span className="italic text-muted-foreground">Not provided</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Contact Phone</p>
                <p className="text-sm text-muted-foreground">{profile?.contactPhone || <span className="italic text-muted-foreground">Not provided</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Website</p>
                {profile?.website ? (
                  <a href={profile.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{profile.website}</a>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Not provided</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Address</p>
                <p className="text-sm text-muted-foreground">{profile?.address || <span className="italic text-muted-foreground">Not provided</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Established Year</p>
                <p className="text-sm text-muted-foreground">{profile?.establishedYear || <span className="italic text-muted-foreground">Not provided</span>}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup & Features Card */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-6 py-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Platform Entitlements
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-foreground">Allowed Features</span>
                    <span className="text-muted-foreground">{ent.allowedFeatures.length} enabled</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ent.allowedFeatures.map(f => {
                      const featureName = INSTITUTION_FEATURES.find(x => x.key === f)?.name || f
                      const isTurnedOn = ent.enabledFeatures.includes(f)
                      return (
                        <span key={f} className={`px-2 py-1 text-xs font-medium rounded-md border ${
                          isTurnedOn 
                            ? 'bg-primary/10 text-primary border-primary/30' 
                            : 'bg-muted/40 text-muted-foreground border-border dark:text-muted-foreground'
                        }`}>
                          {featureName} {isTurnedOn ? '(On)' : '(Off)'}
                        </span>
                      )
                    })}
                    {ent.allowedFeatures.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No features allowed.</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Allowed features are granted by the Super Admin plan. "On/Off" indicates if the institution admin has actively turned them on.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Onboarding Status</p>
                <p className="text-sm text-muted-foreground mt-1">
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
