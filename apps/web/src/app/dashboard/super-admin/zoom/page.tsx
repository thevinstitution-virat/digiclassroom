'use client'

import { useState } from 'react'
import { ZoomConfigCard } from '@/components/admin/ZoomConfigCard'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InstitutionRequired } from '@/components/core/super-admin/InstitutionRequired'
import { useSuperAdminContext } from '@/app/dashboard/super-admin/_context/SuperAdminContext'

export default function SuperAdminZoomPage() {
  const { tenantId, isGlobal } = useSuperAdminContext()

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Super Admin - Zoom Integration</h1>
        <p className="text-muted-foreground">Configure Server-to-Server OAuth for specific institutions.</p>
      </div>

      {isGlobal ? (
        <div className="p-6">
          <InstitutionRequired message="Zoom credentials are configured per institution. Select an institution from the sidebar to manage its Zoom integration." />
        </div>
      ) : (
        <ZoomConfigCard tenantId={tenantId} />
      )}
    </div>
  )
}
