// Small display helpers for the platform owner's evaluation tabs.

export const pct = (x: number | null | undefined, digits = 0): string => (x === null || x === undefined ? '–' : `${(x * 100).toFixed(digits)}%`)
export const num1 = (x: number | null | undefined): string => (x === null || x === undefined ? '–' : (Math.round(x * 100) / 100).toString())
export const inr = (paise: number | null | undefined): string => (paise === null || paise === undefined ? '–' : `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
export const secs = (s: number | null | undefined): string => (s === null || s === undefined ? '–' : s >= 3600 ? `${(s / 3600).toFixed(1)} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`)
export const ist = (d: Date | string): string => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST'

export const STATUS_LABEL: Record<string, string> = {
  eligible: 'Eligible',
  not_yet: 'Not yet',
  insufficient_data: 'Insufficient data',
  config_changed: 'Paused: setup changed',
  no_record: 'No record',
}
