'use client'

// Bulk question importer — download template → upload/paste CSV → validate (preview) → commit as DRAFT.

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'
import { templateCsv, TEMPLATE_COLUMNS } from '@/lib/practest/import'

interface RowResult {
  rowNumber: number
  status: 'new' | 'duplicate' | 'error'
  errors: string[]
  question: { question_text: string; subject?: string; class_level?: number } | null
}
interface Summary { total: number; valid: number; errors: number; duplicates: number }

export default function QuestionImporter({ onImported }: { onImported?: () => void }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<RowResult[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [committed, setCommitted] = useState<{ inserted: number; skipped: number; note?: string } | null>(null)

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'practest-question-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setCsv(await file.text())
    setRows(null); setSummary(null); setCommitted(null); setError(null)
  }

  const call = async (mode: 'validate' | 'commit') => {
    if (!csv.trim()) { setError('Upload or paste CSV first.'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/super-admin/practest/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, csv }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Request failed'); return }
      if (mode === 'validate') {
        setRows(data.rows); setSummary(data.summary); setCommitted(null)
      } else {
        setCommitted({ inserted: data.inserted, skipped: data.skipped, note: data.note })
        setSummary(data.summary)
        onImported?.()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const statusBadge = (s: RowResult['status']) =>
    s === 'new' ? <Badge variant="success">New</Badge>
    : s === 'duplicate' ? <Badge variant="warning">Duplicate</Badge>
    : <Badge variant="destructive">Error</Badge>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpTrayIcon className="h-5 w-5 text-primary" /> Bulk import questions
          </CardTitle>
          <CardDescription>
            Build your question bank in Excel, save as <strong>CSV</strong>, then upload here. Questions import as
            <strong> DRAFT</strong> and must be approved before students see them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadTemplate}>
              <ArrowDownTrayIcon className="h-4 w-4" /> Download CSV template
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
              <DocumentDuplicateIcon className="h-4 w-4" />
              {fileName || 'Choose CSV file'}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">…or paste CSV</label>
            <textarea
              value={csv}
              onChange={(e) => { setCsv(e.target.value); setRows(null); setSummary(null); setCommitted(null) }}
              rows={5}
              placeholder={TEMPLATE_COLUMNS.join(',')}
              className="w-full rounded-xl border border-input bg-background p-3 font-mono text-xs text-foreground shadow-elev-1 outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/35"
            />
          </div>

          {error && (
            <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30">
              <XCircleIcon className="h-4 w-4 text-rose-600" />
              <AlertDescription className="text-rose-800 dark:text-rose-300">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => call('validate')} disabled={loading || !csv.trim()}>
              <ClipboardDocumentCheckIcon className="h-4 w-4" /> {loading ? 'Validating…' : 'Validate & preview'}
            </Button>
            <Button
              variant="gradient"
              onClick={() => call('commit')}
              disabled={loading || !summary || summary.valid === 0}
            >
              <CheckCircleIcon className="h-4 w-4" /> Import {summary ? `${summary.valid} valid` : ''} as DRAFT
            </Button>
          </div>
        </CardContent>
      </Card>

      {committed && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-300">
            Imported <strong>{committed.inserted}</strong> question{committed.inserted !== 1 ? 's' : ''} as DRAFT
            {committed.skipped ? `, skipped ${committed.skipped}` : ''}. {committed.note}
          </AlertDescription>
        </Alert>
      )}

      {summary && rows && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
            <CardDescription className="flex flex-wrap gap-3 pt-1">
              <Badge variant="secondary">Total {summary.total}</Badge>
              <Badge variant="success">New {summary.valid}</Badge>
              <Badge variant="warning">Duplicates {summary.duplicates}</Badge>
              <Badge variant="destructive">Errors {summary.errors}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[26rem] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="p-2.5 font-semibold">Row</th>
                    <th className="p-2.5 font-semibold">Status</th>
                    <th className="p-2.5 font-semibold">Question</th>
                    <th className="p-2.5 font-semibold">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-border align-top">
                      <td className="p-2.5 tabular-nums text-muted-foreground">{r.rowNumber}</td>
                      <td className="p-2.5">{statusBadge(r.status)}</td>
                      <td className="p-2.5 text-foreground">
                        <span className="line-clamp-2">{r.question?.question_text ?? '—'}</span>
                        {r.question?.subject && (
                          <span className="text-xs text-muted-foreground">
                            {r.question.subject}{r.question.class_level ? ` · Class ${r.question.class_level}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-xs text-rose-600 dark:text-rose-400">{r.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
