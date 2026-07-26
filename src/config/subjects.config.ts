/**
 * subjects.config.ts
 *
 * SOURCE OF TRUTH for all subjects.
 *
 * ─── BUG FIXED ────────────────────────────────────────────────────────────────
 * BEFORE: Subject data stored icons as STRINGS → "FileText", "Zap", "Building2"
 *         React rendered those strings as literal text inside the button:
 *           <FileText /> became the word "FileText" on screen
 *
 * AFTER:  Icon is stored as the IMPORTED LucideIcon component reference.
 *         Usage: <subject.Icon size={18} /> — never a string.
 *
 * Also fixed:
 *  - History: was using a building icon. Now uses ScrollText (a scroll/document)
 *  - Geography: was using same building as History. Now uses Globe2
 *  - Health & PE: "Zap" was literal text. Now uses HeartPulse
 *  - ICT: "Information and..." truncated. Fixed in displayName + card component.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import {
  BookOpen,       // English
  Languages,      // Hindi
  Calculator,     // Mathematics
  Atom,           // Science
  Scale,          // Civics
  TrendingUp,     // Economics
  ScrollText,     // History (was wrong building icon)
  Globe2,         // Geography (was wrong building icon)
  HeartPulse,     // Health & Physical Education (was "Zap" text)
  Monitor,        // Information and Communication Technology
  type LucideIcon,
} from "lucide-react";

export interface SubjectConfig {
  id: string;
  displayName: string;    // What the user sees (full, untruncated)
  shortName?: string;     // For compact display contexts
  Icon: LucideIcon;       // MUST be a component reference, NEVER a string
}

export const CBSE_CLASS9_SUBJECTS: SubjectConfig[] = [
  {
    id: "english",
    displayName: "English",
    Icon: BookOpen,
  },
  {
    id: "hindi",
    displayName: "Hindi",
    Icon: Languages,
  },
  {
    id: "mathematics",
    displayName: "Mathematics",
    Icon: Calculator,
  },
  {
    id: "science",
    displayName: "Science",
    Icon: Atom,
  },
  {
    id: "civics",
    displayName: "Civics",
    // WAS: icon: "FileText" (a string — rendered as the word "FileText" on screen)
    // NOW: Icon: Scale (the imported component)
    Icon: Scale,
  },
  {
    id: "economics",
    displayName: "Economics",
    Icon: TrendingUp,
  },
  {
    id: "history",
    displayName: "History",
    // WAS: Building2 icon (wrong choice)
    // NOW: ScrollText — communicates historical documents/records
    Icon: ScrollText,
  },
  {
    id: "geography",
    displayName: "Geography",
    // WAS: same building icon as History (both wrong)
    // NOW: Globe2 — communicates the world/maps
    Icon: Globe2,
  },
  {
    id: "health-pe",
    displayName: "Health & Physical Education",
    shortName: "Health & PE",
    // WAS: icon: "Zap" (a string — rendered as the word "Zap" on screen)
    // NOW: Icon: HeartPulse (the imported component)
    Icon: HeartPulse,
  },
  {
    id: "ict",
    displayName: "Information and Communication Technology",
    shortName: "ICT",
    Icon: Monitor,
  },
];

/** Quick lookup by id */
export function getSubjectById(id: string): SubjectConfig | undefined {
  return CBSE_CLASS9_SUBJECTS.find((s) => s.id === id);
}
