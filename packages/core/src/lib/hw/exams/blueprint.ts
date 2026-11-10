// Exam packages: the board's own blueprint for a paper — marks per unit, the chapters in each unit, the paper section each unit is
// examined in, and the topics the curriculum keeps out of the year-end paper ("assessed only formatively"). Pure data and pure checks.
//
// Every number and topic here is copied from the board's curriculum document named in `source`, and was checked against the 2026 board
// papers and the official marking scheme for 31/4/1-3 (docs/hw-eval/cbse-2026-sources.md). A blueprint is added only from the board's
// own document: never from a third party's summary.

import type { ItemFacts, SetProblem } from './build-rules';
import type { QuestionOutcome } from './rules';

export type PaperSection = 'Biology' | 'Chemistry' | 'Physics';

export interface BlueprintUnit {
  id: string;
  name: string;
  marks: number;
  /** The section of the question paper this unit is examined in (2026 pattern: A Biology, B Chemistry, C Physics). */
  section: PaperSection;
  /** Chapter names as a super-admin would type them; the first is the canonical name. */
  chapters: { name: string; aliases: string[] }[];
}

export interface FormativeTopic {
  /** As the curriculum names it. */
  topic: string;
  unit: string;
  /** A chapter label that means only this topic (it was its own chapter), or null when it sits inside an assessed chapter. */
  chapter: { name: string; aliases: string[] } | null;
  /** Phrases that, in a question someone wrote, point to this topic. Kept narrow on purpose: "motor neuron" is Biology and assessed. */
  phrases: string[];
}

export interface Blueprint {
  board: string;
  classLevel: number;
  subjectCode: string;
  session: string;
  /** The board exam year this session leads to. */
  examYear: number;
  totalMarks: number;
  source: { title: string; url: string };
  units: BlueprintUnit[];
  formativeOnly: FormativeTopic[];
  /** Smaller exclusions the curriculum states inside an assessed chapter. */
  notAssessed: { topic: string; phrases: string[] }[];
}

const SCIENCE_X_2026_27: Blueprint = {
  board: 'CBSE',
  classLevel: 10,
  subjectCode: '086',
  session: '2026-27',
  examYear: 2027,
  totalMarks: 80,
  source: {
    title: 'CBSE Curriculum 2026-27, Secondary, Science (086), Class X: course structure, unit contents and notes for teachers',
    url: 'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Science_SecP1_2026-27.pdf',
  },
  units: [
    {
      id: 'I', name: 'Chemical Substances - Nature and Behaviour', marks: 25, section: 'Chemistry',
      chapters: [
        { name: 'Chemical Reactions and Equations', aliases: ['chemical reactions', 'chemical reaction and equation'] },
        { name: 'Acids, Bases and Salts', aliases: ['acids bases salts', 'acid base and salt', 'acids and bases'] },
        { name: 'Metals and Non-metals', aliases: ['metals and nonmetals', 'metal and non metal'] },
        { name: 'Carbon and its Compounds', aliases: ['carbon compounds', 'carbon and its compound'] },
      ],
    },
    {
      id: 'II', name: 'World of Living', marks: 25, section: 'Biology',
      chapters: [
        { name: 'Life Processes', aliases: ['life process'] },
        { name: 'Control and Coordination', aliases: ['control and co ordination'] },
        { name: 'How do Organisms Reproduce?', aliases: ['reproduction'] },
        // The NCERT chapter is now "Heredity"; the old title is still common. Its evolution half is formative (below).
        { name: 'Heredity', aliases: ['heredity and evolution'] },
      ],
    },
    {
      id: 'III', name: 'Natural Phenomena', marks: 12, section: 'Physics',
      chapters: [
        { name: 'Light - Reflection and Refraction', aliases: ['light'] },
        { name: 'The Human Eye and the Colourful World', aliases: ['human eye and the colourful world', 'human eye and colourful world', 'the human eye', 'human eye'] },
      ],
    },
    {
      id: 'IV', name: 'Effects of Current', marks: 13, section: 'Physics',
      chapters: [
        { name: 'Electricity', aliases: [] },
        { name: 'Magnetic Effects of Electric Current', aliases: ['magnetic effects of current', 'magnetic effect of electric current', 'magnetism'] },
      ],
    },
    {
      id: 'V', name: 'Natural Resources', marks: 5, section: 'Biology',
      chapters: [{ name: 'Our Environment', aliases: ['environment'] }],
    },
  ],
  formativeOnly: [
    {
      topic: 'Periodic Classification of Elements', unit: 'I',
      chapter: { name: 'Periodic Classification of Elements', aliases: ['periodic classification', 'periodic table'] },
      phrases: ['periodic table', 'mendeleev', 'dobereiner', 'newlands', 'law of octaves', 'triads', 'periodic classification'],
    },
    {
      topic: 'Evolution (acquired and inherited traits, speciation, evolution and classification, fossils, human evolution)', unit: 'II',
      chapter: { name: 'Evolution', aliases: [] },
      phrases: ['speciation', 'fossil', 'acquired trait', 'acquired and inherited', 'evolutionary', 'human evolution', 'evolution by stages', 'homologous organ', 'analogous organ'],
    },
    {
      topic: 'Motor, Electromagnetic Induction, Electric Generator', unit: 'IV',
      chapter: null,
      phrases: ['electric motor', 'dc motor', 'electromagnetic induction', 'induced current', 'generator', 'fleming s right hand rule', 'flemings right hand rule'],
    },
  ],
  notAssessed: [
    { topic: 'the colour of the sun at sunrise and sunset', phrases: ['sunrise', 'sunset'] },
  ],
};

const BLUEPRINTS: Blueprint[] = [SCIENCE_X_2026_27];

/** The blueprint for a package's paper, or null when the board's own document for it has not been added. */
export function blueprintFor(q: { board: string; classLevel: number; examYear: number; subjectCode: string }): Blueprint | null {
  return BLUEPRINTS.find((b) => b.board.toLowerCase() === q.board.trim().toLowerCase() && b.classLevel === q.classLevel
    && b.examYear === q.examYear && b.subjectCode === q.subjectCode.trim()) ?? null;
}

/** Lower case, accents and punctuation gone, "&" read as "and", single spaces. */
export function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export type ChapterMatch =
  | { kind: 'unit'; unit: BlueprintUnit; chapter: string }
  | { kind: 'formative'; topic: FormativeTopic; chapter: string }
  | { kind: 'unknown' }
  | { kind: 'blank' };

/** Which unit a typed chapter belongs to; a chapter that is only a formative topic is said so; anything else is unknown, never guessed. */
export function matchChapter(bp: Blueprint, chapter: string): ChapterMatch {
  const f = fold(chapter);
  if (!f) return { kind: 'blank' };
  for (const t of bp.formativeOnly) {
    if (t.chapter && [t.chapter.name, ...t.chapter.aliases].some((a) => fold(a) === f)) return { kind: 'formative', topic: t, chapter: t.chapter.name };
  }
  for (const u of bp.units) {
    for (const c of u.chapters) if ([c.name, ...c.aliases].some((a) => fold(a) === f)) return { kind: 'unit', unit: u, chapter: c.name };
  }
  return { kind: 'unknown' };
}

/** The canonical chapter names, unit by unit, for the builder's suggestions. */
export function blueprintChapters(bp: Blueprint): string[] {
  return bp.units.flatMap((u) => u.chapters.map((c) => c.name));
}

const hasPhrase = (text: string, phrase: string) => ` ${fold(text)} `.includes(` ${fold(phrase)} `);

export interface BlueprintItem extends Pick<ItemFacts, 'number' | 'marks' | 'choiceGroup'> {
  alt?: string | null;
  chapter: string;
  /** For a question the super-admin wrote: its words and scheme, checked for formative topics. Null for a board-paper row. */
  authoredText: string | null;
}

const label = (it: Pick<BlueprintItem, 'number' | 'alt'>) => `Q${it.number}${it.alt ?? ''}`;
const half = (n: number) => Math.round(n * 2) / 2;

/**
 * What the board's blueprint says about a mock. Board papers (pyq, sqp) are the board's own and are not checked against it.
 * Problems stop publishing: a chapter the board paper will not test has no place in a mock that claims to prepare for it.
 * Warnings do not: the super-admin may have reasons, and a typed chapter we cannot recognise is not proof of anything.
 */
export function blueprintCheck(bp: Blueprint, set: { kind: string; syllabusScope: string[] }, items: BlueprintItem[]): { problems: SetProblem[]; warnings: string[] } {
  const problems: SetProblem[] = [];
  const warnings: string[] = [];
  if (set.kind !== 'mock_half' && set.kind !== 'mock_full') return { problems, warnings };

  const formative = new Map<string, { topic: string; numbers: string[] }>();
  const unknown: string[] = [];
  for (const it of items) {
    const m = matchChapter(bp, it.chapter);
    if (m.kind === 'formative') {
      const row = formative.get(m.chapter) ?? { topic: m.topic.topic, numbers: [] };
      row.numbers.push(label(it));
      formative.set(m.chapter, row);
    } else if (m.kind === 'unknown') unknown.push(`${label(it)} ("${it.chapter.trim()}")`);
    // A question already refused for its chapter needs no second line about its words.
    if (it.authoredText && m.kind !== 'formative') {
      for (const t of [...bp.formativeOnly, ...bp.notAssessed]) {
        const hit = t.phrases.find((p) => hasPhrase(it.authoredText!, p));
        if (hit) warnings.push(`${label(it)} mentions "${hit}": ${t.topic} ${'unit' in t ? 'is assessed only formatively' : 'is not assessed'} in ${bp.session}, so the board paper will not ask it.`);
      }
    }
  }
  for (const [chapter, r] of formative) problems.push({ code: 'formative_chapter', chapter, topic: r.topic, numbers: r.numbers, session: bp.session });

  if (set.kind === 'mock_half') {
    for (const s of set.syllabusScope) {
      const m = matchChapter(bp, s);
      if (m.kind === 'formative') problems.push({ code: 'formative_scope', chapter: m.chapter, session: bp.session });
      else if (m.kind === 'unknown') warnings.push(`The syllabus scope names "${s.trim()}", which is not a chapter of the ${bp.session} curriculum as written here.`);
    }
  }

  if (unknown.length) warnings.push(`Not a chapter of the ${bp.session} curriculum as written: ${unknown.join(', ')}. Pick one of the suggested names so weak areas and unit marks can be counted.`);

  if (set.kind === 'mock_full') {
    const blank = items.filter((it) => matchChapter(bp, it.chapter).kind === 'blank');
    if (unknown.length || blank.length || formative.size) {
      warnings.push('Marks per unit are checked against the board paper once every question has a curriculum chapter.');
    } else {
      for (const d of unitMarks(bp, items)) {
        if (d.marks !== d.boardMarks) warnings.push(`Unit ${d.unit} (${d.name}) has ${d.marks} marks here; the board paper gives it ${d.boardMarks}.`);
      }
    }
  }
  return { problems, warnings };
}

/** Marks per unit in a set: each internal choice (or question number) counted once, at its highest-mark alternative's chapter. */
export function unitMarks(bp: Blueprint, items: BlueprintItem[]): { unit: string; name: string; section: PaperSection; marks: number; boardMarks: number }[] {
  const best = new Map<string, BlueprintItem>();
  for (const it of items) {
    const key = it.choiceGroup ? `g:${it.choiceGroup}` : `n:${it.number}`;
    const cur = best.get(key);
    if (!cur || it.marks > cur.marks) best.set(key, it);
  }
  const by = new Map<string, number>(bp.units.map((u) => [u.id, 0]));
  for (const it of best.values()) {
    const m = matchChapter(bp, it.chapter);
    if (m.kind === 'unit') by.set(m.unit.id, half((by.get(m.unit.id) ?? 0) + it.marks));
  }
  return bp.units.map((u) => ({ unit: u.id, name: u.name, section: u.section, marks: by.get(u.id) ?? 0, boardMarks: u.marks }));
}

export interface StudyPriority {
  unit: string;
  name: string;
  section: PaperSection;
  /** What the unit carries in the board paper. */
  boardMarks: number;
  /** In this attempt: the unit's marks and what the learner scored. */
  marks: number;
  awarded: number;
  /** Board marks at stake: the unit's board marks × the share of its marks lost in this attempt, to the half mark. */
  gainable: number;
  chapters: string[];
}

/**
 * Where a learner's next hour is worth most: per unit, the share of marks lost in this attempt applied to what the unit carries in the
 * board paper. A unit worth 25 marks with half of it lost (12.5 to gain) comes before a 5-mark unit lost entirely (5 to gain). Questions
 * with no recognised chapter are left out rather than guessed; a unit this attempt did not test is not listed.
 */
export function studyPriorities(bp: Blueprint, outcomes: Pick<QuestionOutcome, 'chapter' | 'marks' | 'awarded'>[]): StudyPriority[] {
  const by = new Map<string, StudyPriority>();
  for (const o of outcomes) {
    const m = matchChapter(bp, o.chapter);
    if (m.kind !== 'unit' || o.marks <= 0) continue;
    const row = by.get(m.unit.id) ?? { unit: m.unit.id, name: m.unit.name, section: m.unit.section, boardMarks: m.unit.marks, marks: 0, awarded: 0, gainable: 0, chapters: [] };
    row.marks += o.marks;
    row.awarded += Math.min(o.awarded, o.marks);
    if (!row.chapters.includes(m.chapter)) row.chapters.push(m.chapter);
    by.set(m.unit.id, row);
  }
  return [...by.values()]
    .map((r) => ({ ...r, marks: half(r.marks), awarded: half(r.awarded), gainable: half(r.boardMarks * (1 - r.awarded / r.marks)) }))
    .sort((a, b) => b.gainable - a.gainable || b.boardMarks - a.boardMarks || a.unit.localeCompare(b.unit));
}
