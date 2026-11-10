// The list of exam packages and the form that starts a new one (a draft; nothing is offered to anyone until it is published).

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HwError, HwLoading } from '@/components/hw/HwShell'
import { Field } from '@/components/hw/fields'
import { BASE, Note, StatusBadge, rupees } from './shared'

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

function NewPackage({ onCancel }: { onCancel: () => void }) {
  const router = useRouter()
  const year = new Date().getFullYear() + 1
  const [f, setF] = useState({ board: 'CBSE', classLevel: '10', examYear: String(year), title: '', slug: '', slugTouched: false, blurb: '', attemptsPerSet: '5', price: '0' })
  const create = api.hw.exams.admin.create.useMutation({ onSuccess: (r) => router.push(`${BASE}/${r.id}`) })
  const set = (k: keyof typeof f, v: string) => setF((o) => {
    const n = { ...o, [k]: v }
    // board, class and year are already part of the package's identity, so the short name only needs the title
    if (k === 'title' && !o.slugTouched) n.slug = slugOf(v)
    if (k === 'slug') n.slugTouched = true
    return n
  })
  const submit = () => create.mutate({
    board: f.board.trim(), classLevel: Number(f.classLevel), examYear: Number(f.examYear), title: f.title.trim(), slug: f.slug,
    blurb: f.blurb, attemptsPerSet: Number(f.attemptsPerSet), pricePaise: Math.round(Number(f.price) * 100),
  })

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">New package</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Board"><Input value={f.board} onChange={(e) => set('board', e.target.value)} /></Field>
          <Field label="Class"><Input type="number" min={1} max={12} value={f.classLevel} onChange={(e) => set('classLevel', e.target.value)} /></Field>
          <Field label="Exam year"><Input type="number" min={2020} max={2100} value={f.examYear} onChange={(e) => set('examYear', e.target.value)} /></Field>
        </div>
        <Field label="Title" hint="What a learner sees, e.g. “Class 10 Science and Maths, 2027 boards”"><Input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Short name for links" hint="lowercase letters, digits and hyphens; cannot change once published"><Input value={f.slug} onChange={(e) => set('slug', e.target.value)} /></Field>
        <Field label="Description"><Textarea rows={3} value={f.blurb} onChange={(e) => set('blurb', e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Attempts per set" hint="cannot change once published"><Input type="number" min={1} max={50} value={f.attemptsPerSet} onChange={(e) => set('attemptsPerSet', e.target.value)} /></Field>
          <Field label="Price (₹)" hint="0 for a package you only grant"><Input type="number" min={0} step="1" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
        </div>
        <Note tone="error">{create.error?.message}</Note>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={create.isPending || !f.title.trim() || !f.slug}>Create draft</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function PackageList() {
  const list = api.hw.exams.admin.list.useQuery()
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exam packages</h1>
          <p className="text-sm text-muted-foreground">Past papers, sample papers and mock tests that a learner attempts against the clock and has marked from photographs.</p>
        </div>
        {!adding && <Button onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" />New package</Button>}
      </div>
      {adding && <NewPackage onCancel={() => setAdding(false)} />}
      {list.isLoading ? <HwLoading /> : list.error ? <HwError message={list.error.message} onRetry={() => list.refetch()} /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="px-4 py-2">Package</th><th className="px-3">Board / class / year</th><th className="px-3">Sets (published)</th><th className="px-3">Attempts</th><th className="px-3">Price</th><th className="px-3">Status</th></tr>
              </thead>
              <tbody>
                {list.data!.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2"><Link href={`${BASE}/${p.id}`} className="font-medium hover:underline">{p.title}</Link><div className="text-xs text-muted-foreground">{p.slug}</div></td>
                    <td className="px-3">{p.board} · {p.classLevel} · {p.examYear}</td>
                    <td className="px-3">{p.sets} ({p.publishedSets})</td>
                    <td className="px-3">{p.attemptsPerSet}</td>
                    <td className="px-3">{rupees(p.pricePaise)}</td>
                    <td className="px-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {!list.data!.length && <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground">No packages yet. Start one with “New package”.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
