import { Settings } from 'lucide-react'
import { RazorpayKycSetup } from '@/components/institution/RazorpayKycSetup'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function InstitutionSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Institution Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your institution's profile, payouts, and preferences.
        </p>
      </div>

      <div className="grid gap-6">
        <RazorpayKycSetup />
        
        {/* Other settings cards will go here */}
      </div>
    </div>
  )
}
