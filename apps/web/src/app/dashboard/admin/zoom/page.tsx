'use client'

import { ZoomConfigCard } from '@/components/admin/ZoomConfigCard'

export default function AdminZoomPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Zoom Integration</h1>
        <p className="text-muted-foreground">Configure Server-to-Server OAuth for your institution to enable Live Classes.</p>
      </div>

      <ZoomConfigCard />
    </div>
  )
}
