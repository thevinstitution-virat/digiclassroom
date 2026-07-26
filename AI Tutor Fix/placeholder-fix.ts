/**
 * placeholder-fix.ts
 *
 * DROP-IN REPLACEMENT for getPlaceholderText() in useAiTutor.tsx
 *
 * ─── BUG FIXED ────────────────────────────────────────────────────────────────
 * BEFORE (Images 1, 4, 8):
 *   Placeholder showed "Please select what you'd like to do" — truncated at the
 *   bottom of the input box in most app states.
 *
 * ROOT CAUSES:
 *   1. The old function built strings by CONCATENATING dynamic variables,
 *      producing fragments like "your subject using the" when variables
 *      were null/undefined.
 *   2. The fix from last session (returning "Ask anything about Class 9...")
 *      only handled the CHATTING state. All other states (subject selection,
 *      mode selection, initial) still fell through to the broken string.
 *   3. The placeholder CSS had no whitespace-pre-wrap, so long placeholder
 *      strings got clipped rather than wrapping.
 *
 * AFTER: All states return safe, clean strings. Never a fragment.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * HOW TO INTEGRATE:
 *   In useAiTutor.tsx, replace your existing getPlaceholderText function body
 *   with the body of getPlaceholderText below. Pass in the relevant state
 *   values from your hook's state.
 *
 *   Also make sure MultiModalInput.tsx has these classes on the <Textarea>:
 *     whitespace-pre-wrap  (allows placeholder to wrap)
 *     placeholder:text-gray-400
 *   Remove any: truncate, whitespace-nowrap, overflow-hidden from the textarea.
 */

/** All possible states the AI tutor can be in */
export type TutorPhase =
  | "initial"             // App just loaded, nothing selected yet
  | "selecting_subject"   // Bot has asked "which subject?" and user is choosing
  | "selecting_mode"      // Subject chosen, bot is asking for study mode
  | "chatting"            // Actively in a conversation (subject + mode both set)
  | "streaming"           // Bot is currently responding (stream in progress)
  | string;               // Any future phase — handled by safe fallback

interface PlaceholderContext {
  /** Current phase of the tutor conversation */
  phase?: TutorPhase;
  /** The subject the user has selected, if any */
  selectedSubject?: string | null;
  /** The mode the user has selected ("explain_topic", "selfstudy_buddy", etc.) */
  selectedMode?: string | null;
}

/**
 * Returns a clean, complete placeholder string for the input box.
 *
 * Rules:
 * - Never builds strings by concatenation (avoids fragment bugs)
 * - Never returns an empty string
 * - Always returns a full, natural-reading sentence
 * - Phase takes priority; subject/mode context provides specificity when available
 *
 * @example
 *   getPlaceholderText({ phase: "initial" })
 *   → "Choose a subject to get started..."
 *
 *   getPlaceholderText({ phase: "chatting", selectedSubject: "Economics" })
 *   → "Ask anything about Economics..."
 *
 *   getPlaceholderText({ phase: "selecting_mode", selectedSubject: "History" })
 *   → "Choose how you'd like to study History..."
 */
export function getPlaceholderText(ctx?: PlaceholderContext): string {
  const { phase, selectedSubject, selectedMode } = ctx ?? {};

  // ── Most specific: actively chatting with a known subject ─────────────────
  if (selectedSubject && selectedMode) {
    return `Ask anything about ${selectedSubject}...`;
  }

  // ── Phase-based lookups ───────────────────────────────────────────────────
  switch (phase) {
    case "initial":
      return "Choose a subject to get started...";

    case "selecting_subject":
      return "Select a subject above...";

    case "selecting_mode":
      return selectedSubject
        ? `Choose how you'd like to study ${selectedSubject}...`
        : "Choose how you'd like to study...";

    case "chatting":
      return selectedSubject
        ? `Ask anything about ${selectedSubject}...`
        : "Ask anything about Class 9...";

    case "streaming":
      // Input is disabled while streaming, but show a relevant placeholder
      return "Waiting for response...";

    default:
      // Safe fallback — NEVER returns a fragment or empty string
      return "Ask anything about Class 9...";
  }
}

// ─── For MultiModalInput.tsx ──────────────────────────────────────────────────
//
// In your <Textarea> element, ensure these classes are present and these are REMOVED:
//
// ✅ ADD:
//   className={cn(
//     "flex-1 resize-none bg-transparent outline-none",
//     "text-sm leading-relaxed",
//     "whitespace-pre-wrap",            ← allows placeholder to wrap on mobile
//     "placeholder:text-gray-400",
//     className
//   )}
//
// ❌ REMOVE from the Textarea className (any of these will break the placeholder):
//   truncate
//   overflow-hidden
//   whitespace-nowrap
//   max-w-[Npx]        (any fixed max-width on the textarea itself)
