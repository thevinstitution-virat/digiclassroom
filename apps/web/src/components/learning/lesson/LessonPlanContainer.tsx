"use client"

import React, { useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ObjectivesSection, KeyPointsSection, ActivitiesSection, AssessmentSection, LessonActionBar } from './LessonSections'
import LessonPrintView from './LessonPrintView'
import { useLessonExports } from './useLessonExports'

// Tiny heuristic to split a markdown lesson into sections by common headings
function splitSections(markdown: string) {
  const sections: Record<string, string> = {}
  const lines = markdown.split(/\n/)
  let current = 'content'
  sections[current] = ''
  for (const line of lines) {
    const header = line.trim().toLowerCase()
    if (/^##?\s+(objectives|learning objectives)/.test(header)) current = 'objectives'
    else if (/^##?\s+(key points|key concepts|summary)/.test(header)) current = 'key'
    else if (/^##?\s+(activities|examples and activities|activity)/.test(header)) current = 'activities'
    else if (/^##?\s+(assessment|evaluation|questions)/.test(header)) current = 'assessment'
    if (!sections[current]) sections[current] = ''
    sections[current] += line + '\n'
  }
  return sections
}

export default function LessonPlanContainer({ markdown }: { markdown: string }) {
  const { setPrintRef, copyToClipboard, printLesson, exportPdf } = useLessonExports()
  const sections = useMemo(() => splitSections(markdown), [markdown])

  const handleCopy = async () => { await copyToClipboard(markdown) }

  return (
    <div>
      <LessonActionBar onCopy={handleCopy} onPrint={printLesson} onExportPdf={exportPdf} />
      <LessonPrintView ref={setPrintRef}>
        {sections.objectives && <ObjectivesSection title="Objectives" markdown={sections.objectives} />}
        {sections.key && <KeyPointsSection title="Key Points" markdown={sections.key} />}
        {sections.activities && <ActivitiesSection title="Activities" markdown={sections.activities} />}
        {sections.assessment && <AssessmentSection title="Assessment" markdown={sections.assessment} />}
        {!sections.objectives && !sections.key && !sections.activities && !sections.assessment && (
          <div className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        )}
      </LessonPrintView>
    </div>
  )
}

