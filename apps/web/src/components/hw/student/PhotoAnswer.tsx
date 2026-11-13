// Answering with a photo of an answer written on paper (homework that allows it, and always in InkBuddy). The photo is checked on the device
// first (light, glare, focus: photo/prepare.ts), shrunk, and uploaded at once; the server checks it again. A doubtful photo is shown back with
// what to fix, and the learner may still use it. The photo is never kept on the device, so this needs the network.

import { useRef, useState } from 'react'
import { Camera, Images, Loader2 } from 'lucide-react'
import { SOFT_PAGE_PROBLEMS, type PageProblem } from '@/lib/hw/photo/rules'
import { Button } from '@/components/ui/button'
import { preparePhoto, type PhotoFacts } from '../photo/prepare'
import { HwMessage } from '../HwShell'
import { useHwT, type HwKey } from '../strings'
import { isOnline, uploadPhoto } from './sync'

/**
 * Long side of the uploaded photo, in greyscale: plenty for one answer's handwriting, and it keeps the reading cost down. (The roadmap's first
 * idea was about 1000 px wide; a landscape photo that small falls below the shared 1-megapixel floor in photo/rules.ts, so 1600 on the long side.)
 */
const UPLOAD_LONG_SIDE = 1600

type Held = { blob: Blob; preview: string; facts: PhotoFacts; problem: PageProblem | 'unreadable' }

export function PhotoAnswer({ submissionId, questionId, url, onUploaded, onBusy }: {
  submissionId: string
  questionId: string
  /** The stored photo (a short-lived link), or null when there is none yet. */
  url: string | null
  onUploaded: (url: string) => void
  onBusy: (busy: boolean) => void
}) {
  const { t } = useHwT()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'checking' | 'uploading' | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const [error, setError] = useState<string | null>(null)

  const working = (b: 'checking' | 'uploading' | null) => { setBusy(b); onBusy(b !== null) }
  const dropHeld = () => { if (held?.preview) URL.revokeObjectURL(held.preview); setHeld(null) }

  async function send(blob: Blob, facts: PhotoFacts, override: boolean): Promise<boolean> {
    if (!isOnline()) { setError(t('st.photo.offline')); return false }
    working('uploading')
    try {
      const r = await uploadPhoto(submissionId, questionId, blob, { ...facts, override })
      onUploaded(r.url)
      return true
    } catch (e) {
      setError(t('st.photo.failed', { msg: (e as Error).message }))
      return false
    } finally {
      working(null)
    }
  }

  async function pick(files: FileList | null) {
    const file = files?.[0]
    if (camera.current) camera.current.value = ''
    if (gallery.current) gallery.current.value = ''
    if (!file) return
    setError(null)
    dropHeld()
    working('checking')
    let p: Awaited<ReturnType<typeof preparePhoto>>
    try {
      p = await preparePhoto(file, UPLOAD_LONG_SIDE, { grey: true })
    } catch {
      working(null)
      setHeld({ blob: file, preview: '', facts: { sharpness: 0, brightness: 0, glare: 0 }, problem: 'unreadable' })
      return
    }
    working(null)
    if (p.verdict.ok) await send(p.blob, p.facts, false)
    else setHeld({ blob: p.blob, preview: URL.createObjectURL(p.blob), facts: p.facts, problem: p.verdict.why })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('st.photo.howto')}</p>
      <div className="flex flex-wrap gap-2">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" data-testid="photo-camera" onChange={(e) => void pick(e.target.files)} />
        <input ref={gallery} type="file" accept="image/*" className="hidden" data-testid="photo-gallery" onChange={(e) => void pick(e.target.files)} />
        <Button disabled={busy !== null} onClick={() => camera.current?.click()}>
          <Camera className="mr-1 h-4 w-4" />{url ? t('st.photo.retake') : t('st.photo.take')}
        </Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => gallery.current?.click()}>
          <Images className="mr-1 h-4 w-4" />{t('st.photo.choose')}
        </Button>
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />{t(busy === 'checking' ? 'st.photo.checking' : 'st.photo.uploading')}
        </p>
      )}
      {error && <HwMessage tone="error">{error}</HwMessage>}

      {held && (
        <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40" data-testid="photo-held">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the learner's own photo */}
          {held.preview && <img src={held.preview} alt="" className="h-24 w-auto rounded border bg-white" />}
          <div className="min-w-0 flex-1 space-y-2">
            <p>{t(`st.photo.p.${held.problem}` as HwKey)}</p>
            <div className="flex flex-wrap gap-2">
              {held.problem !== 'unreadable' && SOFT_PAGE_PROBLEMS.has(held.problem) && (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={async () => { if (await send(held.blob, held.facts, true)) dropHeld() }}>
                  {t('st.photo.useAnyway')}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={dropHeld}>{t('st.photo.retake')}</Button>
            </div>
          </div>
        </div>
      )}

      {url && (
        <figure className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link to the learner's own photo */}
          <img src={url} alt={t('st.photo.alt')} className="max-h-[70vh] w-full rounded-md border bg-white object-contain" />
          <figcaption className="text-xs text-muted-foreground">{t('st.photo.saved')}</figcaption>
        </figure>
      )}
    </div>
  )
}
