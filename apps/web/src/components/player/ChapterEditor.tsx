'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatSeconds, parseChapterText } from '@/lib/utils/youtube'
import { Plus, Trash2, Loader2, Import, Save, ListOrdered } from 'lucide-react'
import { toast } from 'sonner'

interface ChapterEditorProps {
  videoId: string
  durationSeconds: number | null
}

interface ChapterDraft {
  key: string // client-only ID for React keys
  title: string
  timestamp: string // "MM:SS" or "HH:MM:SS" format
  startSeconds: number
}

/**
 * ChapterEditor — admin tool for adding/editing chapters to any video.
 * Supports manual entry and bulk "Import from text" (YouTube-style).
 */
export function ChapterEditor({ videoId, durationSeconds }: ChapterEditorProps) {
  const [chapters, setChapters] = useState<ChapterDraft[]>([])
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  // Load existing chapters
  const { data: existingChapters, isLoading } = api.videoChapters.getByVideo.useQuery(
    { videoAssetId: videoId },
    { enabled: !!videoId }
  )

  const saveMutation = api.videoChapters.saveChapters.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} chapters saved`)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save chapters')
    },
  })

  // Populate from server data on mount
  useEffect(() => {
    if (existingChapters && existingChapters.length > 0) {
      setChapters(
        existingChapters.map((ch) => ({
          key: ch.id,
          title: ch.title,
          timestamp: formatSeconds(ch.startSeconds),
          startSeconds: ch.startSeconds,
        }))
      )
    }
  }, [existingChapters])

  const addChapter = () => {
    setChapters([
      ...chapters,
      {
        key: crypto.randomUUID(),
        title: '',
        timestamp: '0:00',
        startSeconds: 0,
      },
    ])
  }

  const removeChapter = (key: string) => {
    setChapters(chapters.filter((ch) => ch.key !== key))
  }

  const updateChapter = (key: string, field: 'title' | 'timestamp', value: string) => {
    setChapters(
      chapters.map((ch) => {
        if (ch.key !== key) return ch
        if (field === 'timestamp') {
          // Parse timestamp to seconds
          const parts = value.split(':').map(Number)
          let seconds = 0
          if (parts.length === 3) {
            seconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
          } else if (parts.length === 2) {
            seconds = (parts[0] || 0) * 60 + (parts[1] || 0)
          }
          return { ...ch, timestamp: value, startSeconds: seconds }
        }
        return { ...ch, [field]: value }
      })
    )
  }

  const handleImport = () => {
    const parsed = parseChapterText(importText)
    if (parsed.length === 0) {
      toast.error('No valid chapters found. Format: "MM:SS Title" per line')
      return
    }
    setChapters(
      parsed.map((ch) => ({
        key: crypto.randomUUID(),
        title: ch.title,
        timestamp: formatSeconds(ch.startSeconds),
        startSeconds: ch.startSeconds,
      }))
    )
    setShowImport(false)
    setImportText('')
    toast.success(`Imported ${parsed.length} chapters`)
  }

  const handleSave = () => {
    const valid = chapters.filter((ch) => ch.title.trim().length > 0)
    saveMutation.mutate({
      videoAssetId: videoId,
      chapters: valid.map((ch) => ({
        title: ch.title.trim(),
        startSeconds: ch.startSeconds,
        sortOrder: 0,
      })),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <ListOrdered className="w-4 h-4 text-indigo-500" />
          Chapters
          {durationSeconds && (
            <span className="text-xs text-slate-400 font-normal">
              (Duration: {formatSeconds(durationSeconds)})
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setShowImport(!showImport)}
          >
            <Import className="w-3 h-3 mr-1" />
            Import
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={addChapter}>
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Import from text */}
      {showImport && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <Label className="text-xs text-slate-500">
            Paste chapter timestamps (YouTube format):
          </Label>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`00:00 Introduction\n05:30 Core Concepts\n12:00 Live Demo`}
            rows={5}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImport}>
              Import Chapters
            </Button>
          </div>
        </div>
      )}

      {/* Chapter list */}
      {chapters.length > 0 ? (
        <div className="space-y-2">
          {chapters.map((ch, idx) => (
            <div
              key={ch.key}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-2"
            >
              <span className="text-xs text-slate-400 w-6 text-center font-bold shrink-0">
                {idx + 1}
              </span>
              <Input
                value={ch.timestamp}
                onChange={(e) => updateChapter(ch.key, 'timestamp', e.target.value)}
                placeholder="MM:SS"
                className="w-20 font-mono text-xs h-8 shrink-0"
              />
              <Input
                value={ch.title}
                onChange={(e) => updateChapter(ch.key, 'title', e.target.value)}
                placeholder="Chapter title..."
                className="flex-1 text-sm h-8"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
                onClick={() => removeChapter(ch.key)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-slate-400">
          No chapters yet. Add manually or import from text.
        </div>
      )}

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saveMutation.isPending || chapters.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        <Save className="w-4 h-4 mr-2" />
        Save Chapters ({chapters.filter((c) => c.title.trim()).length})
      </Button>
    </div>
  )
}
