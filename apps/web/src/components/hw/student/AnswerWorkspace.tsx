// The student's answer screen while the work is still a draft: one question at a time,
// Write (ink) or Type, visible-time tracking, autosave to the device every few seconds and
// on blur, upload when online, and hand-in that waits for the network if it has to.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CloudOff, Loader2, Send } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { InkDocument } from '@/lib/hw/ink/stroke-format'
import { InkPad, type InkStats } from '../ink/InkPad'
import { draftKey, draftsFor, loadDraft, queueSubmit, queuedSubmit, saveDraft, unqueueSubmit, type LocalDraft } from '../ink/local-store'
import { marksLabel, useHwT } from '../strings'
import { HwMessage } from '../HwShell'
import { isOnline, uploadInk } from './sync'
import type { HwOut } from '../types'

type Started = HwOut['student']['start']

const AUTOSAVE_MS = 4000
const UPLOAD_AFTER_IDLE_MS = 8000

interface QState {
  mode: 'typed' | 'ink'
  ink: InkDocument | null
  typedText: string
  timeSpentMs: number
  rev: number
  uploadedRev: number
  /** Visible time last sent to the server. */
  uploadedTimeMs: number
  stats: Record<string, unknown>
}

export function AnswerWorkspace({ data, onSubmitted }: { data: Started; onSubmitted: () => void }) {
  const { t } = useHwT()
  const submissionId = data.submission.id
  const modes = data.assignment.allowedModes.filter((m) => m === 'typed' || m === 'ink') as ('typed' | 'ink')[]
  const [index, setIndex] = useState(0)
  const [states, setStates] = useState<Record<string, QState>>({})
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const statesRef = useRef(states)
  statesRef.current = states

  const saveAnswer = api.hw.student.saveAnswer.useMutation()
  const submit = api.hw.student.submit.useMutation()

  const question = data.questions[index]

  // Initial state: the server's copy, overridden by a newer local draft from this device.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const local = await draftsFor(submissionId)
      const next: Record<string, QState> = {}
      for (const q of data.questions) {
        const server = data.answers.find((a) => a.questionId === q.id)
        const d = local.find((x) => x.questionId === q.id)
        const preferInk = modes.includes('ink') && (!modes.includes('typed') || server?.mode !== 'typed')
        next[q.id] = d
          ? { mode: d.mode, ink: d.ink ?? null, typedText: d.typedText ?? '', timeSpentMs: Math.max(d.timeSpentMs, server?.timeSpentMs ?? 0), rev: d.rev, uploadedRev: d.uploadedRev, uploadedTimeMs: server?.timeSpentMs ?? 0, stats: d.stats ?? {} }
          : { mode: server?.mode === 'typed' || !preferInk ? 'typed' : 'ink', ink: null, typedText: server?.typedText ?? '', timeSpentMs: server?.timeSpentMs ?? 0, rev: 0, uploadedRev: 0, uploadedTimeMs: server?.timeSpentMs ?? 0, stats: {} }
        if (!d && server?.hasInk) {
          // The writing exists on the server but not on this device: it cannot be redrawn here.
          next[q.id].uploadedRev = next[q.id].rev = 1
        }
      }
      if (!cancelled) {
        setStates(next)
        setReady(true)
        setQueued(await queuedSubmit(submissionId))
      }
    })()
    return () => { cancelled = true }
  }, [data, submissionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((qid: string, patch: Partial<QState>, bumpRev = true) => {
    setStates((s) => ({ ...s, [qid]: { ...s[qid], ...patch, rev: bumpRev ? s[qid].rev + 1 : s[qid].rev } }))
  }, [])

  const persistLocal = useCallback(async () => {
    for (const [qid, st] of Object.entries(statesRef.current)) {
      const d: LocalDraft = {
        key: draftKey(submissionId, qid), submissionId, questionId: qid, mode: st.mode,
        ink: st.ink ?? undefined, typedText: st.typedText, timeSpentMs: st.timeSpentMs,
        rev: st.rev, uploadedRev: st.uploadedRev, stats: st.stats, updatedAt: Date.now(),
      }
      const existing = await loadDraft(d.key)
      if (!existing || existing.rev !== d.rev || existing.timeSpentMs !== d.timeSpentMs) await saveDraft(d)
    }
  }, [submissionId])

  /** Push changed answers to the server. Returns false if anything could not be sent. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!isOnline()) return false
    let allOk = true
    for (const q of data.questions) {
      const st = statesRef.current[q.id]
      if (!st) continue
      const contentChanged = st.rev !== st.uploadedRev
      if (!contentChanged && st.timeSpentMs - st.uploadedTimeMs < 5000) continue
      const rev = st.rev
      const time = st.timeSpentMs
      try {
        if (st.mode === 'ink' && !contentChanged) {
          await saveAnswer.mutateAsync({ submissionId, questionId: q.id, mode: 'ink', timeSpentMs: time })
        } else if (st.mode === 'ink' && st.ink && st.ink.strokes.length) {
          setUploading(true)
          await uploadInk(submissionId, q.id, st.ink)
          await saveAnswer.mutateAsync({ submissionId, questionId: q.id, mode: 'ink', timeSpentMs: st.timeSpentMs })
        } else {
          await saveAnswer.mutateAsync({
            submissionId, questionId: q.id, mode: 'typed', typedText: st.mode === 'typed' ? st.typedText : '',
            timeSpentMs: st.timeSpentMs, typingStats: st.mode === 'typed' ? st.stats : undefined,
          })
        }
        update(q.id, { uploadedRev: rev, uploadedTimeMs: time }, false)
        setProblem(null)
      } catch (e) {
        allOk = false
        setProblem(t('st.uploadFailed', { msg: (e as Error).message }))
      } finally {
        setUploading(false)
      }
    }
    await persistLocal()
    return allOk
  }, [data.questions, persistLocal, saveAnswer, submissionId, t, update])

  // Visible time on the current question; local autosave; upload after a pause.
  useEffect(() => {
    if (!ready || !question) return
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setStates((s) => (s[question.id] ? { ...s, [question.id]: { ...s[question.id], timeSpentMs: s[question.id].timeSpentMs + 1000 } } : s))
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [ready, question])

  // The visible-time tick re-renders every second, and these callbacks change identity with
  // it (mutation hooks do); timers read them through refs so they are not reset each second.
  const flushRef = useRef(flush)
  flushRef.current = flush
  const persistRef = useRef(persistLocal)
  persistRef.current = persistLocal

  useEffect(() => {
    if (!ready) return
    const save = setInterval(() => { void persistRef.current() }, AUTOSAVE_MS)
    const onHide = () => { if (document.visibilityState === 'hidden') { void persistRef.current(); void flushRef.current() } }
    const onBlur = () => { void persistRef.current() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    return () => { clearInterval(save); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('blur', onBlur) }
  }, [ready])

  const lastChange = useMemo(() => Object.values(states).reduce((s, x) => s + x.rev, 0), [states])
  useEffect(() => {
    if (!ready) return
    const h = setTimeout(() => { void flushRef.current() }, UPLOAD_AFTER_IDLE_MS)
    return () => clearTimeout(h)
  }, [lastChange, ready])

  const doSubmit = useCallback(async () => {
    setProblem(null)
    if (!isOnline()) {
      await persistLocal()
      await queueSubmit(submissionId)
      setQueued(true)
      return
    }
    const ok = await flush()
    if (!ok) return
    try {
      await submit.mutateAsync({ submissionId })
      await unqueueSubmit(submissionId)
      setQueued(false)
      onSubmitted()
    } catch (e) {
      setProblem(t('common.error', { msg: (e as Error).message }))
    }
  }, [flush, onSubmitted, persistLocal, submissionId, submit, t])

  const submitRef = useRef(doSubmit)
  submitRef.current = doSubmit

  // Back online: send everything and hand in if the student already asked to.
  useEffect(() => {
    setOnline(isOnline())
    const on = () => { setOnline(true); void (async () => { if (await queuedSubmit(submissionId)) await submitRef.current(); else await flushRef.current() })() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [submissionId])

  if (!ready || !question) return <div className="py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
  const st = states[question.id]
  const unanswered = data.questions.filter((q) => {
    const s = states[q.id]
    return !s || (s.mode === 'ink' ? !(s.ink?.strokes.length) && s.uploadedRev === 0 : !s.typedText.trim())
  }).length
  const serverOnlyInk = st.mode === 'ink' && !st.ink && st.uploadedRev > 0

  const goTo = (i: number) => { void flush(); setIndex(i) }
  const confirmSubmit = () => {
    const msg = [t('st.submit.confirm'), unanswered ? t('st.submit.unanswered', { n: unanswered }) : ''].filter(Boolean).join('\n\n')
    if (window.confirm(msg)) void doSubmit()
  }

  return (
    <div className="space-y-4">
      {!online && <HwMessage><span className="flex items-center gap-2"><CloudOff className="h-4 w-4" aria-hidden />{t('st.offline')}</span></HwMessage>}
      {queued && <HwMessage>{t('st.offlineQueued')}</HwMessage>}
      {problem && <HwMessage tone="error">{problem}</HwMessage>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist">
          {data.questions.map((q, i) => (
            <Button key={q.id} size="sm" variant={i === index ? 'default' : 'outline'} onClick={() => goTo(i)} aria-label={t('st.q.of', { i: i + 1, n: data.questions.length })}>
              {i + 1}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('st.uploading')}</> : st.rev === st.uploadedRev ? t('common.saved') : t('common.saving')}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{t('st.q.of', { i: index + 1, n: data.questions.length })}</span>
            <Badge variant="secondary">{t(`type.${question.type}`)}</Badge>
            <Badge>{marksLabel(t, question.marks)}</Badge>
          </div>
          <CardTitle className="whitespace-pre-wrap text-lg leading-relaxed">{question.prompt}</CardTitle>
          {modes.length > 1 && (
            <div className="flex gap-1" role="radiogroup">
              {modes.map((m) => (
                <Button key={m} size="sm" variant={st.mode === m ? 'default' : 'outline'} role="radio" aria-checked={st.mode === m}
                  onClick={() => update(question.id, { mode: m })}>
                  {t(m === 'ink' ? 'st.mode.write' : 'st.mode.type')}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {st.mode === 'ink' ? (
            serverOnlyInk ? (
              <HwMessage>{t('common.saved')} ✓</HwMessage>
            ) : (
              <InkPad
                key={question.id}
                value={st.ink}
                lines={question.answerLines}
                onChange={(doc: InkDocument, stats: InkStats) => update(question.id, { ink: doc, stats: { ...st.stats, pad: stats } })}
              />
            )
          ) : (
            <Textarea
              value={st.typedText}
              rows={Math.max(3, Math.min(30, question.answerLines))}
              placeholder={t('st.typed.placeholder')}
              lang={question.languageHint === 'hi' ? 'hi' : 'en'}
              onChange={(e) => update(question.id, { typedText: e.target.value })}
              onPaste={(e) => {
                // Recorded for the teacher's information only; pasting is not blocked.
                const n = e.clipboardData.getData('text').length
                const prev = (st.stats.pastes as { count: number; chars: number } | undefined) ?? { count: 0, chars: 0 }
                update(question.id, { stats: { ...st.stats, pastes: { count: prev.count + 1, chars: prev.chars + n } } }, false)
              }}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0}><ChevronLeft className="mr-1 h-4 w-4" />{t('common.previous')}</Button>
          <Button variant="outline" onClick={() => goTo(index + 1)} disabled={index === data.questions.length - 1}>{t('common.next')}<ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
        <Button onClick={confirmSubmit} disabled={submit.isPending || uploading || queued}>
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {t('st.submit')}
        </Button>
      </div>
    </div>
  )
}
