'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Upload, Plus, Trash2, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Enrollment {
  id: string
  userId: string
  classId: string
  sectionId: string | null
  rollNumber: string | null
  academicYear: string
}

interface BulkResult {
  total: number
  enrolled: number
  skipped: number
  errorCount: number
}

export default function StudentEnrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [bulkErrors, setBulkErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadEnrollments = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/institution/enrollments')
      if (res.ok) {
        const data = await res.json()
        setEnrollments(data.enrollments || [])
      }
    } catch (err) {
      console.error('Failed to load enrollments:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEnrollments() }, [loadEnrollments])

  const handleCsvUpload = async () => {
    if (!csvFile) return
    setUploading(true)
    setBulkResult(null)
    setBulkErrors([])

    try {
      const text = await csvFile.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

      // Parse CSV into student objects
      const students = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim())
        const obj: any = {}
        headers.forEach((h, i) => { obj[h] = cols[i] || '' })
        return {
          name: obj.name || obj.student_name || '',
          email: obj.email || obj.student_email || '',
          classId: obj.class_id || obj.classid || '',
          sectionId: obj.section_id || obj.sectionid || undefined,
          rollNumber: obj.roll_number || obj.rollnumber || obj.roll || undefined
        }
      }).filter(s => s.name && s.email && s.classId)

      if (students.length === 0) {
        setBulkErrors(['No valid student rows found in CSV. Required columns: name, email, class_id'])
        setUploading(false)
        return
      }

      const res = await fetch('/api/institution/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students, academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}` })
      })

      const data = await res.json()
      if (data.summary) {
        setBulkResult(data.summary)
        setBulkErrors(data.errors || [])
        loadEnrollments()
      }
    } catch (err) {
      console.error('CSV upload failed:', err)
      setBulkErrors(['Failed to process CSV file'])
    } finally {
      setUploading(false)
      setCsvFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this enrollment?')) return
    try {
      await fetch(`/api/institution/enrollments?id=${id}`, { method: 'DELETE' })
      loadEnrollments()
    } catch (err) {
      console.error('Failed to delete enrollment:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" />
            Student Enrollments
          </h1>
          <p className="text-muted-foreground mt-1">Manage student enrollment and bulk import via CSV</p>
        </div>
      </div>

      {/* CSV Import Card */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-8 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
          Bulk Import (CSV)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file with columns: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">name, email, class_id, section_id, roll_number</code>
        </p>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          <button
            onClick={handleCsvUpload}
            disabled={!csvFile || uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-md"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Importing...' : 'Import'}
          </button>
        </div>

        {/* Bulk Result */}
        {bulkResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
              <CheckCircle2 className="w-4 h-4" /> Import Complete
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Total:</span> <strong>{bulkResult.total}</strong></div>
              <div><span className="text-muted-foreground">Enrolled:</span> <strong className="text-green-600">{bulkResult.enrolled}</strong></div>
              <div><span className="text-muted-foreground">Skipped:</span> <strong className="text-amber-600">{bulkResult.skipped}</strong></div>
              <div><span className="text-muted-foreground">Errors:</span> <strong className="text-red-600">{bulkResult.errorCount}</strong></div>
            </div>
          </div>
        )}

        {/* Bulk Errors */}
        {bulkErrors.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl max-h-40 overflow-y-auto">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium mb-1">
              <AlertCircle className="w-4 h-4" /> Issues
            </div>
            {bulkErrors.map((err, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400 py-0.5">{err}</p>
            ))}
          </div>
        )}
      </div>

      {/* Enrollments Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-muted/40 border-b border-border">
          <h3 className="font-semibold text-foreground">
            Current Enrollments ({enrollments.length})
          </h3>
        </div>

        {enrollments.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No students enrolled yet. Use CSV import above to add students in bulk.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">User ID</th>
                  <th className="text-left px-6 py-3 font-medium">Class</th>
                  <th className="text-left px-6 py-3 font-medium">Section</th>
                  <th className="text-left px-6 py-3 font-medium">Roll #</th>
                  <th className="text-left px-6 py-3 font-medium">Year</th>
                  <th className="text-right px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-foreground">{e.userId.slice(0, 12)}...</td>
                    <td className="px-6 py-3 text-foreground">{e.classId.slice(0, 8)}...</td>
                    <td className="px-6 py-3 text-foreground">{e.sectionId?.slice(0, 8) || '—'}</td>
                    <td className="px-6 py-3 text-foreground">{e.rollNumber || '—'}</td>
                    <td className="px-6 py-3 text-foreground">{e.academicYear}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
