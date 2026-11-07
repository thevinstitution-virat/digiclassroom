// The board-paper screens, rendered on the server (no browser, no network): the learner's CBSE paper card, the teacher's picker, and the figures on the
// answer screen. The tRPC hooks are faked with the data the real procedures return.

import { renderToStaticMarkup } from 'react-dom/server'
import { translate, type HwKey } from '@/components/hw/strings'

const mockState: { papers: unknown; questions: unknown; teacherPapers: unknown; teacherQuestions: unknown } = { papers: null, questions: null, teacherPapers: null, teacherQuestions: null }
function mockQ(data: unknown) { return { data, isLoading: false, error: null, isFetching: false, refetch: () => undefined } }
function mockMut() { return { mutate: () => undefined, isPending: false, error: null, variables: undefined } }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))
jest.mock('../../../../../packages/core/src/lib/trpc/client', () => ({
  api: {
    hw: {
      practice: {
        papers: { useQuery: () => mockQ(mockState.papers) },
        paperQuestions: { useQuery: () => mockQ(mockState.questions) },
        startPaperQuestion: { useMutation: mockMut },
      },
      bank: {
        papers: { useQuery: () => mockQ(mockState.teacherPapers) },
        questions: { useQuery: () => mockQ(mockState.teacherQuestions) },
        addQuestion: { useMutation: mockMut },
      },
    },
  },
}))

import { PaperPractice } from '@/components/hw/practice/PaperPractice'
import { PaperPicker } from '@/components/hw/teacher/PaperPicker'
import { QuestionFigures } from '@/components/hw/student/QuestionFigures'

const paper = { paperId: 'p1', board: 'CBSE', classLevel: 10, subject: 'Science', subjectCode: '086', session: '2026-27', kind: 'sqp', title: 'SQP', questions: 3 }
const question = (over: Record<string, unknown> = {}) => ({
  rowId: 'r1', variant: null, label: '1', number: 1, alt: null, section: 'A', marks: 1, qtype: 'mcq', stem: 'Which gas do plants take in?', figures: [], hasDrawing: false, alsoOffered: [], ...over,
})

describe('the learner\'s CBSE paper card', () => {
  beforeEach(() => { mockState.papers = { available: true, papers: [paper] }; mockState.questions = { paper, questions: [question()] } })

  it('lists the paper and its questions, with a button for each', () => {
    const html = renderToStaticMarkup(<PaperPractice />)
    expect(html).toContain('CBSE paper practice')
    expect(html).toContain('CBSE Class 10 Science, sample paper 2026-27')
    expect(html).toContain('3 question(s) you can practise now')
    expect(html).toContain('Question 1')
    expect(html).toContain('Which gas do plants take in?')
    expect(html).toContain('Practise this')
    expect(html).toContain('1 mark')
  })

  it('says a figure and a drawing, and that the other alternative is not also attempted', () => {
    mockState.questions = { paper, questions: [question({ label: '26A', alt: 'A', marks: 2, figures: [{ figureId: 'q26-fig1', description: 'A circuit' }], hasDrawing: true, alsoOffered: ['26B'] })] }
    const html = renderToStaticMarkup(<PaperPractice />)
    expect(html).toContain('Has a figure')
    expect(html).toContain('Draw it on paper: it is not marked here')
    expect(html).toContain('You attempt this or 26B, not both.')
  })

  it('shows nothing at all when no paper has a question on offer, or the feature is off', () => {
    mockState.papers = { available: true, papers: [] }
    expect(renderToStaticMarkup(<PaperPractice />)).toBe('')
    mockState.papers = { available: false, papers: [] }
    expect(renderToStaticMarkup(<PaperPractice />)).toBe('')
  })

  it('never shows an option letter list or an answer: only what the server sent', () => {
    expect(renderToStaticMarkup(<PaperPractice />)).not.toMatch(/Carbon dioxide|correct option/i)
  })
})

describe('the teacher\'s picker', () => {
  beforeEach(() => { mockState.teacherPapers = [paper]; mockState.teacherQuestions = { paper, questions: [question({ rowId: 'r9', label: '4', variant: null, hasDrawing: true, marks: 2 }), question({ rowId: 'r10', label: '1-vi', variant: 'vi' })] } })

  it('is one button until opened, and nothing when no paper is published', () => {
    expect(renderToStaticMarkup(<PaperPicker assignmentId="a1" onAdded={() => undefined} />)).toContain('Add a question from a CBSE paper')
    mockState.teacherPapers = []
    expect(renderToStaticMarkup(<PaperPicker assignmentId="a1" onAdded={() => undefined} />)).toBe('')
  })
})

describe('the figures on the answer screen', () => {
  const figs = [{ figureId: 'q4-fig1', description: 'A blank circle to draw in.', url: 'https://signed.test/hw-bank/x.v1.png' }]
  it('shows each picture with its words as the alt text and for a screen reader', () => {
    const html = renderToStaticMarkup(<QuestionFigures figures={figs} />)
    expect(html).toContain('src="https://signed.test/hw-bank/x.v1.png"')
    expect(html).toContain('alt="A blank circle to draw in."')
    expect(html).toContain('Figure: A blank circle to draw in.')
  })
  it('shows nothing for a question without figures', () => {
    expect(renderToStaticMarkup(<QuestionFigures />)).toBe('')
    expect(renderToStaticMarkup(<QuestionFigures figures={[]} />)).toBe('')
  })
})

describe('the new text', () => {
  const keys = ['pr.paper.title', 'pr.paper.intro', 'pr.paper.label', 'pr.paper.count', 'pr.paper.q', 'pr.paper.also', 'pr.paper.drawing', 'st.q.figure', 'tc.b.paper.title', 'tc.b.paper.added', 'tc.b.paper.drawingNote'] as HwKey[]
  const vars = { board: 'CBSE', cls: 10, subject: 'Science', kind: 'k', session: 's', n: 2, label: '1', others: '2B', s: 'A', marks: 2 }
  it.each(keys)('%s has English and Hindi, with nothing left unfilled', (k) => {
    for (const lang of ['en', 'hi'] as const) {
      const text = translate(lang, k, vars)
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toMatch(/\{\w+\}/)
    }
    expect(/[ऀ-ॿ]/.test(translate('hi', k, vars))).toBe(true)
  })
})
