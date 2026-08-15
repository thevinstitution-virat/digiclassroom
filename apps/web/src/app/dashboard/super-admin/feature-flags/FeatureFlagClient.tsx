'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

export default function FeatureFlagClient() {
  const { data: tenants, isLoading, refetch } = api.tenantFeatures.getAllTenantsWithFeatures.useQuery()
  const utils = api.useUtils()
  const updateFeatures = api.tenantFeatures.updateFeatures.useMutation({
    onSuccess: () => {
      utils.tenantFeatures.getAllTenantsWithFeatures.invalidate()
    }
  })

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleToggle = (tenantId: string, feature: string, currentValue: boolean) => {
    updateFeatures.mutate({
      tenantId,
      features: {
        [feature]: !currentValue
      }
    })
  }

  return (
    <div className="space-y-6">
      {tenants?.map((tenant) => (
        <Card key={tenant.tenant_id}>
          <CardHeader>
            <CardTitle>{tenant.tenant_name}</CardTitle>
            <CardDescription>Tenant ID: {tenant.tenant_id}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center justify-between space-x-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Live Classes
                </label>
                <Switch 
                  checked={tenant.enable_live_classes} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'enable_live_classes', tenant.enable_live_classes)}
                  disabled={updateFeatures.isPending}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Video Library
                </label>
                <Switch 
                  checked={tenant.enable_video_library} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'enable_video_library', tenant.enable_video_library)}
                  disabled={updateFeatures.isPending}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Homework
                </label>
                <Switch 
                  checked={tenant.enable_homework} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'enable_homework', tenant.enable_homework)}
                  disabled={updateFeatures.isPending}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Notices
                </label>
                <Switch 
                  checked={tenant.enable_notices} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'enable_notices', tenant.enable_notices)}
                  disabled={updateFeatures.isPending}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Doubts / Forums
                </label>
                <Switch 
                  checked={tenant.enable_doubts} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'enable_doubts', tenant.enable_doubts)}
                  disabled={updateFeatures.isPending}
                />
              </div>
              <div className="flex items-center justify-between space-x-2 bg-primary/10 p-2 rounded-md border border-primary/20">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-primary">
                  Teachers Can Upload Videos
                </label>
                <Switch 
                  checked={tenant.teacher_can_upload_videos} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'teacher_can_upload_videos', tenant.teacher_can_upload_videos)}
                  disabled={updateFeatures.isPending}
                />
              </div>
              <div className="flex items-center justify-between space-x-2 bg-primary/10 p-2 rounded-md border border-primary/20">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-primary">
                  Teachers Can Schedule Live
                </label>
                <Switch 
                  checked={tenant.teacher_can_schedule_live} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'teacher_can_schedule_live', tenant.teacher_can_schedule_live)}
                  disabled={updateFeatures.isPending}
                />
              </div>
              <div className="flex items-center justify-between space-x-2 bg-emerald-50/50 p-2 rounded-md border border-emerald-100">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-emerald-900">
                  Admins Can Manage Zoom
                </label>
                <Switch 
                  checked={tenant.admin_can_manage_zoom} 
                  onCheckedChange={() => handleToggle(tenant.tenant_id, 'admin_can_manage_zoom', tenant.admin_can_manage_zoom)}
                  disabled={updateFeatures.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {tenants?.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No institutions found.
        </div>
      )}
    </div>
  )
}
