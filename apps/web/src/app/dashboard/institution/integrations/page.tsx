import { Metadata } from 'next'
import { ZoomConfigCard } from '@/components/admin/ZoomConfigCard'
import { RazorpayKycSetup } from '@/components/institution/RazorpayKycSetup'

export const metadata: Metadata = {
  title: 'Integrations | VG Kosh Admin',
  description: 'Manage third-party integrations for your organization',
}

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Configure external services and APIs used by your organization.
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <ZoomConfigCard />
        <RazorpayKycSetup />
      </div>
    </div>
  )
}
