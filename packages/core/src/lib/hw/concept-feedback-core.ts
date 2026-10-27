// The arithmetic of per-concept feedback (concept-feedback.ts), with nothing but types imported, so it is tested alone.
import type { GraphExpansion } from '../library/graph-client';

export interface GradedQuestion {
  id: string;
  /** As stored: counts from 0. */
  position: number;
  prompt: string;
  marks: number;
  /** Null while not marked. */
  awarded: number | null;
}

export interface ConceptFeedback {
  concept: string;
  /** Marks lost on the questions that test this concept (a question testing two concepts counts for both). */
  lost: number;
  outOf: number;
  /** Question numbers as the student sees them (1-based). */
  questions: number[];
  revisitFirst: { label: string; chapter: number }[];
  message: string;
}

/**
 * Pure: per concept, the marks lost and available across the marked questions that test it, weakest first. Only
 * concepts where marks were lost get a message; fully correct concepts are listed as strengths.
 */
export function conceptFeedback(questions: GradedQuestion[], graphOf: Map<string, GraphExpansion | null>): { weak: ConceptFeedback[]; strong: string[] } {
  const byConcept = new Map<string, { lost: number; outOf: number; questions: Set<number>; pre: Map<string, number> }>();
  for (const q of questions) {
    if (q.awarded === null) continue;
    const g = graphOf.get(q.id);
    if (!g?.concepts.length) continue;
    const lost = Math.max(0, q.marks - q.awarded);
    // The concepts the question's passages teach, at most three, so one long passage does not spread blame thin.
    for (const c of g.concepts.slice(0, 3)) {
      const e = byConcept.get(c.label) ?? { lost: 0, outOf: 0, questions: new Set<number>(), pre: new Map<string, number>() };
      e.lost += lost;
      e.outOf += q.marks;
      e.questions.add(q.position + 1); // positions count from 0; students see question 1, 2, …
      for (const p of g.prerequisites.filter((x) => x.for_concept === c.label)) e.pre.set(p.label, p.first_chapter);
      byConcept.set(c.label, e);
    }
  }
  const weak: ConceptFeedback[] = [];
  const strong: string[] = [];
  for (const [concept, e] of byConcept) {
    if (e.lost === 0) {
      strong.push(concept);
      continue;
    }
    const revisitFirst = [...e.pre.entries()].map(([label, chapter]) => ({ label, chapter })).slice(0, 3);
    const qs = [...e.questions].sort((a, b) => a - b);
    const round = (n: number) => Math.round(n * 10) / 10;
    const message =
      `You lost ${round(e.lost)} of ${round(e.outOf)} marks on ${concept} (question${qs.length > 1 ? 's' : ''} ${qs.join(', ')}).` +
      (revisitFirst.length ? ` It builds on ${revisitFirst.map((p) => `${p.label} (chapter ${p.chapter})`).join(' and ')}: revise ${revisitFirst.length > 1 ? 'those' : 'that'} first.` : '');
    weak.push({ concept, lost: round(e.lost), outOf: round(e.outOf), questions: qs, revisitFirst, message });
  }
  weak.sort((a, b) => b.lost / b.outOf - a.lost / a.outOf || b.lost - a.lost || a.concept.localeCompare(b.concept));
  return { weak, strong: strong.sort() };
}
