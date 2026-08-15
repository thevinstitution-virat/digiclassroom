'use client'

import { useState } from 'react'
import { LiveClassesWidget } from '@/components/classroom/LiveClassesWidget'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLiveClassesPage() {
  const [classId, setClassId] = useState('test-class-123')

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Live Classes Management</h1>
        <p className="text-muted-foreground">Schedule and manage live classes for your institution.</p>
      </div>

      <div className="bg-card p-6 rounded-xl border shadow-sm space-y-4 max-w-xl">
        <h2 className="text-lg font-semibold">Select Class</h2>
        <div className="space-y-2">
          <Label>Class ID</Label>
          <Input value={classId} onChange={(e) => setClassId(e.target.value)} />
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border shadow-sm">
        <LiveClassesWidget classId={classId} isTeacher={true} />
      </div>
    </div>
  )
}
