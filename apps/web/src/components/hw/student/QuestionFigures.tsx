'use client'

// The figures of a board-paper question: the board paper's own pictures, private and short-lived links, with their words for a screen reader.

import { useHwT } from '../strings'

export interface QuestionFigure { figureId: string; description: string; url: string }

export function QuestionFigures({ figures }: { figures?: QuestionFigure[] }) {
  const { t } = useHwT()
  if (!figures || figures.length === 0) return null
  return (
    <div className="space-y-3" data-testid="question-figures">
      {figures.map((f) => (
        <figure key={f.figureId} className="rounded-md border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={f.description} className="mx-auto max-h-[28rem] w-auto max-w-full" loading="lazy" />
          <figcaption className="sr-only">{t('st.q.figure')}: {f.description}</figcaption>
        </figure>
      ))}
    </div>
  )
}
