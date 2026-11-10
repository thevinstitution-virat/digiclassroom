'use client'

// The printable answer sheet for an exam set, outside the dashboard so only the sheet prints. A learner with access to the package opens it from
// the package page; the super admin previews any set with ?preview=admin. The sheet shows question numbers and boxes only, never the questions.

import { useParams, useSearchParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { AnswerSheet } from '@/components/hw-exams/AnswerSheet'

export default function ExamSheetPage() {
  const { setId } = useParams<{ setId: string }>()
  const admin = useSearchParams().get('preview') === 'admin'
  const learner = api.hw.exams.sheet.useQuery({ setId }, { enabled: !admin, retry: false })
  const preview = api.hw.exams.admin.sheet.useQuery({ setId }, { enabled: admin, retry: false })
  const q = admin ? preview : learner
  const msg = q.error?.message ?? ''

  return (
    <div style={{ background: '#e9e9e9', minHeight: '100vh', padding: '16px 0' }}>
      <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 12px', padding: '0 12px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', color: '#111' }}>
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
          <strong>Answer sheet / उत्तर पुस्तिका</strong>
          <div>Print on plain A4, one side only, at 100% (no “fit to page”). / सादे A4 पर, एक तरफ़, 100% आकार पर छापें।</div>
        </div>
        {q.data && <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / छापें</Button>}
      </div>
      {q.isLoading && <p style={{ textAlign: 'center' }}>Loading… / लोड हो रहा है…</p>}
      {q.error && <p role="alert" style={{ textAlign: 'center', color: '#b00' }}>{msg}</p>}
      {q.data && <AnswerSheet data={q.data} />}
    </div>
  )
}
