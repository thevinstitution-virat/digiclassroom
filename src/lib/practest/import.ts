// src/lib/practest/import.ts
//
// Dependency-free bulk question importer (CSV — Excel "Save As CSV").
// Pure & isomorphic: used by the admin UI for client-side preview AND by the
// commit API for authoritative re-validation. Two-phase by design:
//   parse → structural validate (here) → server dedupe (validate API) → commit.
//
// The correct answer is captured into the shuffle-safe option model
// (NormalizedOption[]) at import time, so imported questions are correct-by-id.

import { type NormalizedOption, validateOptions } from './options'

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const
export const BLOOMS = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'] as const
export const QTYPES = ['MCQ', 'TRUE_FALSE'] as const

// Canonical template columns (header row). Aliases are accepted case/space-insensitively.
export const TEMPLATE_COLUMNS = [
  'external_id', 'board', 'language', 'class', 'subject', 'chapter', 'topic', 'subtopic',
  'difficulty', 'bloom', 'type', 'question',
  'optionA', 'optionB', 'optionC', 'optionD', 'correct',
  'explanation', 'marks',
  'casa_book', 'casa_edition', 'casa_page', 'casa_anchor',
] as const

const HEADER_ALIASES: Record<string, string> = {
  externalid: 'external_id', id: 'external_id', qid: 'external_id',
  board: 'board', medium: 'language', language: 'language', lang: 'language',
  class: 'class', classlevel: 'class', grade: 'class',
  subject: 'subject', chapter: 'chapter', topic: 'topic', subtopic: 'subtopic',
  difficulty: 'difficulty', level: 'difficulty', bloom: 'bloom', bloomlevel: 'bloom',
  type: 'type', questiontype: 'type',
  question: 'question', questiontext: 'question', q: 'question',
  optiona: 'optionA', optionb: 'optionB', optionc: 'optionC', optiond: 'optionD',
  a: 'optionA', b: 'optionB', c: 'optionC', d: 'optionD',
  correct: 'correct', correctoption: 'correct', answer: 'correct', correctanswer: 'correct',
  explanation: 'explanation', solution: 'explanation',
  marks: 'marks', maxmarks: 'marks', mark: 'marks',
  casabook: 'casa_book', book: 'casa_book',
  casaedition: 'casa_edition', edition: 'casa_edition',
  casapage: 'casa_page', page: 'casa_page',
  casaanchor: 'casa_anchor', anchor: 'casa_anchor',
}

export interface ImportedQuestion {
  external_id?: string
  board?: string
  language?: string
  class_level?: number
  subject?: string
  chapter?: string
  topic?: string
  subtopic?: string
  difficulty?: string
  bloom?: string
  type?: string
  question_text: string
  options: NormalizedOption[]
  explanation?: string
  max_marks?: number
  casa_book?: string
  casa_edition?: string
  casa_page?: number | null
  casa_anchor?: string
  content_hash: string
}

export interface RowResult {
  rowNumber: number
  status: 'new' | 'duplicate' | 'error'
  errors: string[]
  question: ImportedQuestion | null
}

export interface ParseResult {
  rows: RowResult[]
  summary: { total: number; valid: number; errors: number; duplicates: number }
}

// ── RFC-4180-ish CSV parser (quotes, escaped "", CRLF) ───────────────────────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\r') {
      // handled by \n
    } else if (ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  // last field/row
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[\s_\-./]/g, '')

// Small, stable, dependency-free content hash (FNV-1a) for de-duplication.
export function hashQuestion(q: { question_text: string; options: NormalizedOption[]; class_level?: number; subject?: string }): string {
  const correct = q.options.filter((o) => o.isCorrect).map((o) => o.text).sort().join('|')
  const allOpts = q.options.map((o) => o.text.trim().toLowerCase()).sort().join('|')
  const basis = `${(q.subject || '').trim().toLowerCase()}#${q.class_level ?? ''}#${q.question_text.trim().toLowerCase().replace(/\s+/g, ' ')}#${allOpts}#${correct.toLowerCase()}`
  let h = 0x811c9dc5
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Parse CSV text → validated rows (structural validation only; DB dedupe is server-side). */
export function parseAndValidate(csvText: string): ParseResult {
  const grid = parseCsv(csvText)
  if (grid.length < 2) {
    return { rows: [], summary: { total: 0, valid: 0, errors: 0, duplicates: 0 } }
  }
  const header = grid[0].map((h) => HEADER_ALIASES[normHeader(h)] ?? normHeader(h))
  const idx = (name: string) => header.indexOf(name)
  const get = (cells: string[], name: string) => {
    const i = idx(name)
    return i >= 0 ? (cells[i] ?? '').trim() : ''
  }

  const seenHashes = new Set<string>()
  const rows: RowResult[] = []

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]
    const errors: string[] = []
    const rowNumber = r + 1 // 1-based incl. header

    const question_text = get(cells, 'question')
    const subject = get(cells, 'subject')
    const classRaw = get(cells, 'class')
    const class_level = classRaw ? parseInt(classRaw, 10) : undefined

    if (!question_text) errors.push('Missing question text')
    if (!subject) errors.push('Missing subject')
    if (!classRaw) errors.push('Missing class')
    else if (Number.isNaN(class_level!) || class_level! < 1 || class_level! > 12) errors.push(`Invalid class "${classRaw}" (expected 1–12)`)

    // Build options from A–D
    const slots = [
      { id: 'o1', letter: 'A', text: get(cells, 'optionA') },
      { id: 'o2', letter: 'B', text: get(cells, 'optionB') },
      { id: 'o3', letter: 'C', text: get(cells, 'optionC') },
      { id: 'o4', letter: 'D', text: get(cells, 'optionD') },
    ].filter((s) => s.text !== '')

    const correctRaw = get(cells, 'correct')
    let options: NormalizedOption[] = []
    if (slots.length < 2) {
      errors.push('At least 2 options required')
    } else if (!correctRaw) {
      errors.push('Missing correct answer')
    } else {
      const upper = correctRaw.trim().toUpperCase()
      const byLetter = slots.find((s) => s.letter === upper)
      const byText = slots.find((s) => s.text.trim().toLowerCase() === correctRaw.trim().toLowerCase())
      const correctSlot = byLetter ?? byText
      if (!correctSlot) errors.push(`Correct answer "${correctRaw}" does not match any option (use A/B/C/D or the exact option text)`)
      options = slots.map((s) => ({ id: s.id, text: s.text, isCorrect: s === correctSlot }))
      errors.push(...validateOptions(options))
    }

    // Enums (soft — normalize/warn)
    const difficulty = normalizeEnum(get(cells, 'difficulty'), DIFFICULTIES, 'MEDIUM')
    const bloom = normalizeEnum(get(cells, 'bloom'), BLOOMS, 'UNDERSTAND')
    const type = normalizeEnum(get(cells, 'type'), QTYPES, 'MCQ')

    const marksRaw = get(cells, 'marks')
    const max_marks = marksRaw ? Math.max(1, parseInt(marksRaw, 10) || 1) : 1
    const pageRaw = get(cells, 'casa_page')

    if (errors.length) {
      rows.push({ rowNumber, status: 'error', errors, question: null })
      continue
    }

    const question: ImportedQuestion = {
      external_id: get(cells, 'external_id') || undefined,
      board: get(cells, 'board') || undefined,
      language: get(cells, 'language') || undefined,
      class_level,
      subject,
      chapter: get(cells, 'chapter') || undefined,
      topic: get(cells, 'topic') || undefined,
      subtopic: get(cells, 'subtopic') || undefined,
      difficulty,
      bloom,
      type,
      question_text,
      options,
      explanation: get(cells, 'explanation') || undefined,
      max_marks,
      casa_book: get(cells, 'casa_book') || undefined,
      casa_edition: get(cells, 'casa_edition') || undefined,
      casa_page: pageRaw ? parseInt(pageRaw, 10) || null : null,
      casa_anchor: get(cells, 'casa_anchor') || undefined,
      content_hash: '',
    }
    question.content_hash = hashQuestion(question)

    // In-sheet duplicate?
    if (seenHashes.has(question.content_hash)) {
      rows.push({ rowNumber, status: 'duplicate', errors: ['Duplicate of an earlier row in this file'], question })
    } else {
      seenHashes.add(question.content_hash)
      rows.push({ rowNumber, status: 'new', errors: [], question })
    }
  }

  const summary = {
    total: rows.length,
    valid: rows.filter((r) => r.status === 'new').length,
    errors: rows.filter((r) => r.status === 'error').length,
    duplicates: rows.filter((r) => r.status === 'duplicate').length,
  }
  return { rows, summary }
}

function normalizeEnum<T extends readonly string[]>(value: string, allowed: T, fallback: T[number]): T[number] {
  if (!value) return fallback
  const up = value.trim().toUpperCase()
  return (allowed as readonly string[]).includes(up) ? (up as T[number]) : fallback
}

/** The downloadable CSV template (header + one example row). */
export function templateCsv(): string {
  const header = TEMPLATE_COLUMNS.join(',')
  const example = [
    'NCERT-EN-09-HIS-01.01-0001', 'CBSE', 'English', '9', 'Social Science', 'The French Revolution',
    'French Society', '', 'EASY', 'REMEMBER', 'MCQ',
    'In which year did the French Revolution begin?',
    '1789', '1790', '1799', '1804', 'A',
    'The French Revolution began in 1789 with the storming of the Bastille.', '1',
    'NCERT History 9', '2023', '5', 'p5-para2',
  ]
    .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
    .join(',')
  return `${header}\n${example}\n`
}
