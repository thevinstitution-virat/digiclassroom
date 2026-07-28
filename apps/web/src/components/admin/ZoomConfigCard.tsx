'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CheckCircle2, Video, Loader2, AlertCircle } from 'lucide-react'

export function ZoomConfigCard({ tenantId }: { tenantId?: string }) {
  const [accountId, setAccountId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')

  const utils = api.useUtils()
  
  const { data: status, isLoading } = api.zoomCredentials.getStatus.useQuery({ tenantId })
  
  const { mutate: saveCredentials, isLoading: isSaving } = api.zoomCredentials.save.useMutation({
    onSuccess: () => {
      toast.success('Zoom credentials saved and verified!')
      utils.zoomCredentials.getStatus.invalidate({ tenantId })
      setAccountId('')
      setClientId('')
      setClientSecret('')
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save Zoom credentials')
    }
  })

  const { mutate: removeCredentials, isLoading: isRemoving } = api.zoomCredentials.remove.useMutation({
    onSuccess: () => {
      toast.success('Zoom credentials removed')
      utils.zoomCredentials.getStatus.invalidate({ tenantId })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId || !clientId || !clientSecret) {
      toast.error('Please fill in all fields')
      return
    }
    saveCredentials({ accountId, clientId, clientSecret, tenantId })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-emerald-500/20 shadow-lg shadow-emerald-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Video className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-xl">Zoom S2S Integration</CardTitle>
            <CardDescription>
              Configure Server-to-Server OAuth to enable Live Classes
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {status?.hasCredentials ? (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-500">Zoom is Connected</p>
                <p className="text-sm text-emerald-500/80 mt-1">
                  Your organization can now schedule and host Live Classes.
                </p>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <p>Account ID: <span className="font-mono bg-muted px-1 py-0.5 rounded">{status.accountId.slice(0, 4)}...{status.accountId.slice(-4)}</span></p>
                  <p>Status: <span className="uppercase">{status.status}</span></p>
                </div>
              </div>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => removeCredentials()}
              disabled={isRemoving}
            >
              Disconnect Zoom
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-500">
                <p className="font-medium mb-1">Setup Required</p>
                <p>Create a Server-to-Server OAuth app in the Zoom App Marketplace, then copy the credentials here.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">Account ID</Label>
              <Input
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g. xYZA123_bCd"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. a1b2c3d4e5"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Required"
                className="font-mono"
              />
            </div>
            <Button type="submit" disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Save and Verify Credentials'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
