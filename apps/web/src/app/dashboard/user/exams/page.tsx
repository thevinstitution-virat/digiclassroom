'use client'

// Board exam practice (docs/hw-eval/exam-packages.md, phase 3): the packages a learner can take. Off unless HW_EXAMS_ENABLED.

import { Catalogue, ExamFrame } from '@/components/hw-exams/learner/Catalogue'

export default function ExamsPage() {
  return <ExamFrame><Catalogue /></ExamFrame>
}
