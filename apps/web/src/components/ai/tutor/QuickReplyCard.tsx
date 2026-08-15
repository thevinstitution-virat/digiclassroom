"use client";

/**
 * QuickReplyCard.tsx
 *
 * Renders the clickable option cards shown inside bot messages.
 *
 * ─── BUGS FIXED ───────────────────────────────────────────────────────────────
 * BUG: "Step-by-step gu..." — subtitle truncated in Images 4 & 8
 *   CAUSE: className had `truncate`, `overflow-hidden`, or `max-w-[200px]`
 *          on the subtitle <p>. Any of these will clip text.
 *   FIX:   Removed all truncation classes. Added `whitespace-normal` and
 *          `break-words` so text wraps naturally on any screen width.
 *
 * BUG: "FileText" / "Zap" showing as literal text (Images 3)
 *   CAUSE: Icon prop was a string ("FileText") not a component.
 *   FIX:   Icon prop must be a LucideIcon component reference.
 *          If you accidentally pass a string, the component warns you in dev.
 *
 * BUG: "Information and..." card truncated (Image 3)
 *   CAUSE: Card title had whitespace-nowrap or overflow-hidden.
 *   FIX:   Same as above — whitespace-normal, no max-w constraints.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { cn } from "@/lib/utils"; // adjust path if needed
import { type LucideIcon, AlertCircle } from "lucide-react";

export interface QuickReply {
  id: string;
  text: string;
  description?: string;  // the subtitle — must NEVER be truncated
  Icon?: LucideIcon;     // MUST be a component reference, NEVER a string
  value?: string;        // what gets sent when clicked (defaults to title)
}

// ─── Single Card ──────────────────────────────────────────────────────────────

interface QuickReplyCardProps {
  reply: QuickReply;
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const QuickReplyCard: React.FC<QuickReplyCardProps> = ({
  reply,
  onSelect,
  disabled = false,
  className,
}) => {
  const { text, description, Icon, value } = reply;

  // Dev-time guard: catch accidental string icons before they reach production
  if (process.env.NODE_ENV !== "production" && typeof Icon === "string") {
    console.error(
      `[QuickReplyCard] Icon for "${text}" is a string ("${Icon}"). ` +
        `Import the LucideIcon component and pass the reference instead:\n` +
        `  import { ${Icon} } from "lucide-react";\n` +
        `  <QuickReplyCard reply={{ ..., Icon: ${Icon} }} />`
    );
  }

  const isIconComponent = Icon && typeof Icon !== "string";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value ?? text)}
      className={cn(
        // Layout
        "flex items-start gap-3 w-full text-left",
        // Spacing
        "px-3 py-2.5",
        // Shape
        "rounded-xl",
        // Colors
        "border border-orange-100 bg-orange-50/30",
        // Hover / active states
        "hover:bg-orange-50 hover:border-orange-200",
        "active:scale-[0.99]",
        // Disabled
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        // Transitions
        "transition-all duration-150",
        className
      )}
    >
      {/* Icon — only render if it's a valid component */}
      {isIconComponent && (
        <span className="mt-0.5 flex-shrink-0 text-orange-600" aria-hidden="true">
          <Icon size={17} strokeWidth={1.8} />
        </span>
      )}

      {/* Text block
          CRITICAL: min-w-0 + flex-1 allows the block to shrink below its content size,
          which is required for text-wrap to work inside a flex container.
          Without min-w-0, the container grows to fit the text and never wraps. */}
      <div className="min-w-0 flex-1">
        {/* Title: font-medium, WRAPS naturally — no truncate */}
        <p
          className={cn(
            "text-sm font-semibold text-foreground leading-snug",
            "whitespace-normal break-words"  // ← key: allows wrapping
            // NEVER: truncate, overflow-hidden, whitespace-nowrap, max-w-[Npx]
          )}
        >
          {text}
        </p>

        {/* Subtitle / description: also WRAPS — no truncation */}
        {description && (
          <p
            className={cn(
              "text-xs text-muted-foreground mt-0.5 leading-relaxed",
              "whitespace-normal break-words"  // ← key: allows wrapping
              // NEVER: truncate, overflow-hidden, whitespace-nowrap, max-w-[Npx]
            )}
          >
            {description}
          </p>
        )}
      </div>
    </button>
  );
};

// ─── Card List ─────────────────────────────────────────────────────────────────

interface QuickRepliesProps {
  replies: QuickReply[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const QuickReplies: React.FC<QuickRepliesProps> = ({
  replies,
  onSelect,
  disabled = false,
  className,
}) => {
  if (!replies?.length) return null;

  return (
    // flex flex-col: single column, cards stack vertically — no grid, no truncation
    <div className={cn("flex flex-col gap-2 mt-3 w-full", className)}>
      {replies.map((reply) => (
        <QuickReplyCard
          key={reply.id}
          reply={reply}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

export default QuickReplies;
