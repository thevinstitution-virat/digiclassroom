'use client'

/**
 * DEPRECATED SHIM — do not add code here.
 *
 * This path previously held a second, diverging implementation of
 * AnswerActionButtons: a ~95-line subset offering only Word Meaning / Add to
 * Sanchika / Copy, where "Add to Sanchika" was a no-op that flipped a local
 * `saved` flag and never called /api/notes ("Implement actual save logic if
 * necessary"). Its Button import also pointed at a different path
 * (@/components/core/ui/button).
 *
 * Nothing imported it. The live UI imports '@/components/ai/AnswerActionButtons'
 * from both src/app/dashboard/user/ai-tutor/page.tsx (line 10) and
 * src/app/dashboard/user/ai-tutor/_hooks/useAiTutor.tsx (line 23).
 *
 * It is now a pure re-export of the canonical component so the two cannot drift
 * apart again, and so nobody wires up the version whose save button does nothing.
 * Kept rather than deleted so any existing import path still resolves; safe to
 * delete once the tree is confirmed free of references to
 * '@/components/ai/core/AnswerActionButtons'.
 *
 * Canonical file: src/components/ai/AnswerActionButtons.tsx
 */

export { default } from '@/components/ai/AnswerActionButtons'
