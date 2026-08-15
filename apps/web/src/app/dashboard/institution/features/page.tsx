'use client'

// Institution admin: toggle which entitled features are active for the institution.
// Only features granted by super_admin (allowedFeatures) are toggleable.
import { useEffect, useState } from 'react'

interface Feature {
  key: string
  name: string
  description: string
}

export default function InstitutionFeaturesPage() {
  const [catalog, setCatalog] = useState<Feature[]>([])
  const [allowed, setAllowed] = useState<string[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [plan, setPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/institution/features')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setCatalog(d.catalog ?? [])
        setAllowed(d.allowedFeatures ?? [])
        setEnabled(d.enabledFeatures ?? [])
        setPlan(d.plan ?? null)
      })
      .catch(() => setError('Could not load features.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (key: string) => {
    if (!allowed.includes(key) || saving) return
    const next = enabled.includes(key) ? enabled.filter((k) => k !== key) : [...enabled, key]
    const prev = enabled
    setEnabled(next)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/institution/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledFeatures: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setEnabled(prev) // rollback
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="px-4 py-10 text-muted-foreground">Loading features…</div>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="grad text-2xl font-bold">
            Features
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn features on or off for your institution.
            {plan && <span className="ml-1">Plan: <strong>{plan}</strong>.</span>}
          </p>
        </div>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
        {catalog.map((f) => {
          const isAllowed = allowed.includes(f.key)
          const isOn = enabled.includes(f.key)
          return (
            <li key={f.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className={isAllowed ? '' : 'opacity-50'}>
                <p className="font-semibold text-foreground">{f.name}</p>
                <p className="text-sm text-muted-foreground">
                  {f.description}
                  {!isAllowed && <span className="ml-2 text-amber-600">· not in your plan</span>}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                disabled={!isAllowed || saving}
                onClick={() => toggle(f.key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  isOn ? 'bg-primary' : 'bg-muted'
                } ${!isAllowed ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-5 w-5 translate-y-0.5 transform rounded-full bg-white shadow transition-transform ${
                    isOn ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Features outside your plan are managed by the platform team (super_admin).
      </p>
    </div>
  )
}
