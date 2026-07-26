/**
 * Content taxonomy for the super-admin upload portal.
 *
 * Hierarchy (the order the upload form presents, and the structure stored in
 * the Qdrant chunk payload):
 *   1. domain   — School Education, College Education, Competitive Exams, …
 *   2. course   — CBSE, ICSE, UPSC, NEET, …          (per domain)
 *   3. level    — Class 9 / 1st Professional / Prelims (per course)
 *   4. subject  — Social Science, Anatomy, …          (umbrella, per course+level)
 *   5. book     — Economics, History, …               (leaf; same subject can have many books)
 *   6. medium   — English / Hindi / …
 *   7. bookTitle + file
 *
 * Retrieval note: the AI-tutor agents filter Qdrant by the LEAF the student
 * studies. That leaf is the `book` here (e.g. "Economics"), so the upload
 * pipeline stores the searchable `subject` payload = book and keeps the
 * umbrella (`subjectGroup`) = subject. See upload/route.ts.
 *
 * This file is intentionally data-driven and extensible — add courses/levels/
 * subjects/books here and the cascading dropdowns + storage pick them up with
 * no further code changes.
 */

export interface CourseNode {
  id: string
  label: string
  /** Ordered levels for this course (class/year/stage). */
  levels: { id: string; label: string }[]
  /**
   * Subjects → books, keyed by level id. Use `*` as a wildcard level that
   * applies when a specific level has no entry of its own.
   */
  subjects: Record<string, Record<string, string[]>>
}

export interface DomainNode {
  id: string
  label: string
  courses: CourseNode[]
}

export const MEDIUMS: string[] = ['English', 'Hindi', 'Bilingual', 'Urdu', 'Other']

// ── Reusable building blocks ────────────────────────────────────────────────
const SCHOOL_CLASSES = Array.from({ length: 12 }, (_, i) => ({
  id: `class-${i + 1}`,
  label: `Class ${i + 1}`,
}))

// Generic school subjects → books fallback (used via the `*` wildcard level).
const SCHOOL_DEFAULT_SUBJECTS: Record<string, string[]> = {
  Mathematics: ['Mathematics'],
  Science: ['Science'],
  'Social Science': ['History', 'Geography', 'Political Science', 'Economics'],
  English: ['English'],
  Hindi: ['Hindi'],
  'Computer Science': ['Computer Science'],
  Sanskrit: ['Sanskrit'],
}

const CBSE_CLASS9: Record<string, string[]> = {
  Mathematics: ['Mathematics'],
  Science: ['Science'],
  'Social Science': [
    'Economics',
    'History (India and the Contemporary World - I)',
    'Geography (Contemporary India - I)',
    'Political Science (Democratic Politics - I)',
  ],
  English: ['Beehive', 'Moments'],
  Hindi: ['Kshitij', 'Kritika', 'Sparsh', 'Sanchayan'],
}

const CBSE_CLASS10: Record<string, string[]> = {
  Mathematics: ['Mathematics'],
  Science: ['Science'],
  'Social Science': [
    'Economics (Understanding Economic Development)',
    'History (India and the Contemporary World - II)',
    'Geography (Contemporary India - II)',
    'Political Science (Democratic Politics - II)',
  ],
  English: ['First Flight', 'Footprints without Feet'],
  Hindi: ['Kshitij', 'Kritika', 'Sparsh', 'Sanchayan'],
}

const SENIOR_SCIENCE: Record<string, string[]> = {
  Physics: ['Physics Part I', 'Physics Part II'],
  Chemistry: ['Chemistry Part I', 'Chemistry Part II'],
  Mathematics: ['Mathematics Part I', 'Mathematics Part II'],
  Biology: ['Biology'],
  'Computer Science': ['Computer Science'],
  English: ['English'],
}

// ── Taxonomy ────────────────────────────────────────────────────────────────
export const CONTENT_TAXONOMY: DomainNode[] = [
  {
    id: 'school_education',
    label: 'School Education',
    courses: [
      {
        id: 'cbse',
        label: 'CBSE',
        levels: SCHOOL_CLASSES,
        subjects: {
          'class-9': CBSE_CLASS9,
          'class-10': CBSE_CLASS10,
          'class-11': SENIOR_SCIENCE,
          'class-12': SENIOR_SCIENCE,
          '*': SCHOOL_DEFAULT_SUBJECTS,
        },
      },
      {
        id: 'icse',
        label: 'ICSE',
        levels: SCHOOL_CLASSES,
        subjects: { '*': SCHOOL_DEFAULT_SUBJECTS },
      },
      {
        id: 'up_board',
        label: 'UP Board',
        levels: SCHOOL_CLASSES,
        subjects: { '*': SCHOOL_DEFAULT_SUBJECTS },
      },
      {
        id: 'state_board',
        label: 'State Board',
        levels: SCHOOL_CLASSES,
        subjects: { '*': SCHOOL_DEFAULT_SUBJECTS },
      },
    ],
  },
  {
    id: 'college_education',
    label: 'College Education',
    courses: [
      {
        id: 'mbbs',
        label: 'MBBS',
        levels: [
          { id: 'first-prof', label: '1st Professional' },
          { id: 'second-prof', label: '2nd Professional' },
          { id: 'third-prof-1', label: '3rd Professional Part I' },
          { id: 'third-prof-2', label: '3rd Professional Part II' },
        ],
        subjects: {
          'first-prof': { Anatomy: ['Anatomy'], Physiology: ['Physiology'], Biochemistry: ['Biochemistry'] },
          'second-prof': { Pathology: ['Pathology'], Pharmacology: ['Pharmacology'], Microbiology: ['Microbiology'], 'Forensic Medicine': ['Forensic Medicine'] },
          '*': { 'General Medicine': ['General Medicine'], Surgery: ['Surgery'], Pediatrics: ['Pediatrics'] },
        },
      },
      {
        id: 'btech',
        label: 'B.Tech',
        levels: Array.from({ length: 8 }, (_, i) => ({ id: `sem-${i + 1}`, label: `Semester ${i + 1}` })),
        subjects: { '*': { Mathematics: ['Engineering Mathematics'], Physics: ['Engineering Physics'], 'Computer Science': ['Programming Fundamentals', 'Data Structures'] } },
      },
      {
        id: 'bcom',
        label: 'B.Com',
        levels: Array.from({ length: 6 }, (_, i) => ({ id: `sem-${i + 1}`, label: `Semester ${i + 1}` })),
        subjects: { '*': { Accountancy: ['Financial Accounting'], Economics: ['Microeconomics', 'Macroeconomics'], 'Business Studies': ['Business Studies'] } },
      },
    ],
  },
  {
    id: 'competitive_exams',
    label: 'Competitive Exam Preparatory Courses',
    courses: [
      {
        id: 'upsc_cse',
        label: 'UPSC (Civil Services)',
        levels: [
          { id: 'prelims', label: 'Prelims' },
          { id: 'mains', label: 'Mains' },
          { id: 'interview', label: 'Interview' },
        ],
        subjects: {
          prelims: { 'General Studies': ['GS Paper I'], CSAT: ['CSAT Paper II'] },
          mains: { 'General Studies': ['GS I', 'GS II', 'GS III', 'GS IV'], Essay: ['Essay'], 'Optional Subject': ['Optional'] },
          '*': { 'Current Affairs': ['Current Affairs'] },
        },
      },
      {
        id: 'ssc_cgl',
        label: 'SSC (CGL)',
        levels: [
          { id: 'tier-1', label: 'Tier I' },
          { id: 'tier-2', label: 'Tier II' },
        ],
        subjects: { '*': { 'Quantitative Aptitude': ['Quantitative Aptitude'], 'General Intelligence': ['Reasoning'], 'English Language': ['English'], 'General Awareness': ['General Awareness'] } },
      },
      {
        id: 'banking',
        label: 'Banking (IBPS/SBI)',
        levels: [
          { id: 'prelims', label: 'Prelims' },
          { id: 'mains', label: 'Mains' },
        ],
        subjects: { '*': { Reasoning: ['Reasoning'], 'Quantitative Aptitude': ['Quantitative Aptitude'], English: ['English'], 'Banking Awareness': ['Banking Awareness'] } },
      },
    ],
  },
  {
    id: 'entrance_exams',
    label: 'Entrance Exam Preparatory Courses',
    courses: [
      {
        id: 'jee',
        label: 'JEE (Main + Advanced)',
        levels: [
          { id: 'class-11', label: 'Class 11' },
          { id: 'class-12', label: 'Class 12' },
          { id: 'dropper', label: 'Dropper / Repeater' },
        ],
        subjects: { '*': { Physics: ['Physics'], Chemistry: ['Chemistry'], Mathematics: ['Mathematics'] } },
      },
      {
        id: 'neet',
        label: 'NEET (UG)',
        levels: [
          { id: 'class-11', label: 'Class 11' },
          { id: 'class-12', label: 'Class 12' },
          { id: 'dropper', label: 'Dropper / Repeater' },
        ],
        subjects: { '*': { Physics: ['Physics'], Chemistry: ['Chemistry'], Biology: ['Botany', 'Zoology'] } },
      },
      {
        id: 'cuet',
        label: 'CUET (UG)',
        levels: [{ id: 'general', label: 'General' }],
        subjects: { '*': { 'General Test': ['General Test'], English: ['English'], Domain: ['Domain Subject'] } },
      },
    ],
  },
  {
    id: 'skill_development',
    label: 'Skill Development Courses',
    courses: [
      {
        id: 'web_development',
        label: 'Web Development',
        levels: [
          { id: 'beginner', label: 'Beginner' },
          { id: 'intermediate', label: 'Intermediate' },
          { id: 'advanced', label: 'Advanced' },
        ],
        subjects: { '*': { Frontend: ['HTML & CSS', 'JavaScript', 'React'], Backend: ['Node.js', 'Databases'] } },
      },
      {
        id: 'digital_marketing',
        label: 'Digital Marketing',
        levels: [
          { id: 'foundation', label: 'Foundation' },
          { id: 'professional', label: 'Professional' },
        ],
        subjects: { '*': { SEO: ['SEO'], 'Social Media': ['Social Media Marketing'], Analytics: ['Web Analytics'] } },
      },
      {
        id: 'data_science',
        label: 'Data Science',
        levels: [
          { id: 'beginner', label: 'Beginner' },
          { id: 'advanced', label: 'Advanced' },
        ],
        subjects: { '*': { Python: ['Python Programming'], Statistics: ['Statistics'], 'Machine Learning': ['Machine Learning'] } },
      },
    ],
  },
  {
    id: 'corporate_training',
    label: 'Corporate Training Courses',
    courses: [
      {
        id: 'leadership',
        label: 'Leadership & Management',
        levels: [
          { id: 'foundational', label: 'Foundational' },
          { id: 'advanced', label: 'Advanced' },
        ],
        subjects: { '*': { Leadership: ['Leadership Essentials'], Management: ['People Management', 'Project Management'] } },
      },
      {
        id: 'communication',
        label: 'Business Communication',
        levels: [{ id: 'all', label: 'All Levels' }],
        subjects: { '*': { Communication: ['Business Writing', 'Presentation Skills'], 'Soft Skills': ['Interpersonal Skills'] } },
      },
    ],
  },
]

// ── Accessors (drive the cascading dropdowns) ───────────────────────────────
export function getDomains() {
  return CONTENT_TAXONOMY.map((d) => ({ id: d.id, label: d.label }))
}

function findDomain(domainId: string) {
  return CONTENT_TAXONOMY.find((d) => d.id === domainId)
}
function findCourse(domainId: string, courseId: string) {
  return findDomain(domainId)?.courses.find((c) => c.id === courseId)
}

export function getCourses(domainId: string) {
  return findDomain(domainId)?.courses.map((c) => ({ id: c.id, label: c.label })) ?? []
}

export function getLevels(domainId: string, courseId: string) {
  return findCourse(domainId, courseId)?.levels ?? []
}

/** Subjects for a (domain, course, level), falling back to the `*` wildcard level. */
export function getSubjects(domainId: string, courseId: string, levelId: string): string[] {
  const course = findCourse(domainId, courseId)
  if (!course) return []
  const byLevel = course.subjects[levelId] ?? course.subjects['*'] ?? {}
  return Object.keys(byLevel)
}

/** Books for a (domain, course, level, subject), falling back to the `*` wildcard level. */
export function getBooks(domainId: string, courseId: string, levelId: string, subject: string): string[] {
  const course = findCourse(domainId, courseId)
  if (!course) return []
  const byLevel = course.subjects[levelId] ?? course.subjects['*'] ?? {}
  return byLevel[subject] ?? []
}

/** Human-readable labels for a set of ids (for display + storage). */
export function labelForDomain(domainId: string) {
  return findDomain(domainId)?.label ?? domainId
}
export function labelForCourse(domainId: string, courseId: string) {
  return findCourse(domainId, courseId)?.label ?? courseId
}
export function labelForLevel(domainId: string, courseId: string, levelId: string) {
  return findCourse(domainId, courseId)?.levels.find((l) => l.id === levelId)?.label ?? levelId
}
