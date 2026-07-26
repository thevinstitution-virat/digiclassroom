'use client'

import { useState } from 'react'
import { LiveClassesWidget } from '@/components/classroom/LiveClassesWidget'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InstitutionRequired } from '@/components/core/super-admin/InstitutionRequired'
import { useSuperAdminContext } from '@/app/dashboard/super-admin/_context/SuperAdminContext'

export default function SuperAdminLiveClassesPage() {
  const { tenantId, isGlobal } = useSuperAdminContext()
  const [classId, setClassId] = useState('test-class-123')

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Super Admin - Live Classes</h1>
        <p className="text-slate-600">Schedule and manage live classes across all institutions.</p>
      </div>

      {isGlobal ? (
        <div className="p-6">
          <InstitutionRequired message="Live classes are institution-specific. Select an institution from the sidebar to manage its live classes." />
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Target Configuration</h2>
            <div className="grid grid-cols-1 gap-4 max-w-sm">
              <div className="space-y-2">
                <Label>Class ID</Label>
                <Input value={classId} onChange={(e) => setClassId(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <LiveClassesWidget classId={classId} tenantId={tenantId} isTeacher={true} />
          </div>
        </>
      )}
    </div>
  )
}
