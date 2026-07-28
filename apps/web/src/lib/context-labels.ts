/**
 * context-labels.ts
 *
 * ─── BUG FIXED ────────────────────────────────────────────────────────────────
 * BEFORE (Image 8): Bot message header showed:
 *   "CBSE Class 9 - explain_topic"   ← internal system identifier, raw
 *
 * CAUSE: The context header was built by directly concatenating the raw
 *   intent/mode string from state without any formatting.
 *
 * AFTER:
 *   "CBSE Class 9 — Explain Topic"   ← human-readable label
 *
 * HOW TO USE:
 *   import { formatContextHeader } from "@/lib/context-labels";
 *
 *   // In your message rendering:
 *   const header = formatContextHeader("CBSE", 9, currentMode);
 *   // → "CBSE Class 9 — Explain Topic"
 *
 *   // Or just format the intent label:
 *   const label = formatIntentLabel("explain_topic"); // → "Explain Topic"
 * ──────────────────────────────────────────────────────────────────────────────
 */

/** All known mode/intent identifiers and their display labels */
const INTENT_LABELS: Record<string, string> = {
  // ── Learning modes (the most common ones to appear in headers) ────────────
  explain_topic:      "Explain Topic",
  selfstudy_buddy:    "Self Study Buddy",
  selfstudy:          "Self Study",
  exam_prep:          "Exam Preparation",
  exam_mode:          "Exam Mode",
  practice:           "Practice",
  practice_questions: "Practice Questions",
  quick_quiz:         "Quick Quiz",
  quiz:               "Quiz",
  summary:            "Summary",
  chapter_summary:    "Chapter Summary",
  revision:           "Revision",
  flashcards:         "Flashcards",
  doubt_clearing:     "Doubt Clearing",
  concept_map:        "Concept Map",

  // ── Subject identifiers (if these ever appear in headers) ─────────────────
  english:     "English",
  hindi:       "Hindi",
  mathematics: "Mathematics",
  math:        "Mathematics",
  science:     "Science",
  civics:      "Civics",
  economics:   "Economics",
  history:     "History",
  geography:   "Geography",
  health_pe:   "Health & Physical Education",
  ict:         "ICT",
};

/**
 * Converts a raw system identifier to a user-readable label.
 *
 * Strategy:
 *   1. Check the lookup table for an exact match (case-insensitive)
 *   2. Fall back to automatic Title Case conversion of snake_case/kebab-case
 *   3. Never return the raw identifier unchanged
 *
 * @example
 *   formatIntentLabel("explain_topic")   → "Explain Topic"
 *   formatIntentLabel("new_future_mode") → "New Future Mode"  (automatic fallback)
 *   formatIntentLabel(null)              → ""
 */
export function formatIntentLabel(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";

  // 1. Exact match in lookup table
  const key = raw.toLowerCase().trim();
  if (INTENT_LABELS[key]) return INTENT_LABELS[key];

  // 2. Automatic Title Case from snake_case or kebab-case
  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Builds the context header line shown in italics at the top of each bot message.
 * e.g. "CBSE Class 9 — Explain Topic"
 *
 * Pass `null` for any part you want to omit.
 *
 * @example
 *   formatContextHeader("CBSE", 9, "explain_topic")
 *   → "CBSE Class 9 — Explain Topic"
 *
 *   formatContextHeader("CBSE", 9, null)
 *   → "CBSE Class 9"
 */
export function formatContextHeader(
  board: string | null | undefined,
  classLevel: string | number | null | undefined,
  intent: string | null | undefined
): string {
  const parts: string[] = [];

  if (board) {
    parts.push(board.toUpperCase().trim());
  }

  if (classLevel !== null && classLevel !== undefined && classLevel !== "") {
    parts.push(`Class ${classLevel}`);
  }

  const intentLabel = formatIntentLabel(intent);
  if (intentLabel) {
    parts.push(intentLabel);
  }

  return parts.join(" — ");
}
