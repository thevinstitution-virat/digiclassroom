"use client";

/**
 * StreamingChatMessage.tsx
 *
 * ─── BUG FIXED ────────────────────────────────────────────────────────────────
 * BEFORE (Image 7):
 *   ┌──────────────────────────────┐
 *   │  ● ● ●                       │   ← typing bubble, NO avatar
 *   └──────────────────────────────┘
 *   [gradient avatar]  ■ Stop generating  ← avatar here, next to stop button
 *
 * CAUSE: The parent page.tsx still had a separate
 *   {status === 'connecting' && <div><BotAvatar /><StopButton /></div>}
 *   block from the OLD code. The new StreamingChatMessage rendered the dots
 *   WITHOUT an avatar, then the old block rendered its OWN avatar + stop button
 *   below. Two separate render paths = split layout.
 *
 * AFTER:
 *   [avatar]  ┌──────────────────┐
 *             │  ● ● ●           │   ← typing bubble aligned with avatar
 *             └──────────────────┘
 *             ■ Stop generating      ← stop button indented under bubble
 *
 * HOW TO USE IN page.tsx:
 *   // REMOVE the old stop button block entirely:
 *   // ❌ {agentStreamState.status === 'connecting' && (<div><Avatar /><StopBtn/></div>)}
 *
 *   // REMOVE the avatar wrapper around this component:
 *   // ❌ <div className="flex gap-2"><BotAvatar /><StreamingChatMessage ... /></div>
 *
 *   // JUST render the component — it handles its own avatar:
 *   // ✅ <StreamingChatMessage streamState={agentStreamState} onStop={handleStop} />
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils"; // adjust path if needed

export type StreamStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export interface AgentStreamState {
  status: StreamStatus;
  text?: string;
  error?: string;
}

interface StreamingChatMessageProps {
  streamState: AgentStreamState;
  onStop?: () => void;
  /** Optionally pass a custom avatar. Defaults to the gradient bot icon. */
  avatarNode?: React.ReactNode;
  className?: string;
}

// ─── Internal: animated typing dots ──────────────────────────────────────────

const TypingDots: React.FC = () => (
  <div className="flex items-center gap-[5px] py-0.5" role="status" aria-label="AI is typing">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="block w-[7px] h-[7px] rounded-full bg-gray-400"
        style={{
          animation: "vcBob 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
          willChange: "transform, opacity",
        }}
      />
    ))}
    {/* Scoped keyframes — only defined once when first dot renders */}
    <style>{`
      @keyframes vcBob {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
        40% { transform: translateY(-5px); opacity: 1; }
      }
    `}</style>
  </div>
);

// ─── Internal: default gradient bot avatar ────────────────────────────────────

const DefaultBotAvatar: React.FC = () => (
  <div
    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
    style={{ background: "linear-gradient(135deg, #534AB7 0%, #EF9F27 100%)" }}
    aria-hidden="true"
  >
    {/* Inline SVG robot — avoids extra icon import */}
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="11" />
      <circle cx="8.5" cy="16" r="1" fill="white" stroke="none" />
      <circle cx="15.5" cy="16" r="1" fill="white" stroke="none" />
    </svg>
  </div>
);

// ─── Main export ──────────────────────────────────────────────────────────────

const StreamingChatMessage: React.FC<StreamingChatMessageProps> = ({
  streamState,
  onStop,
  avatarNode,
  className,
}) => {
  const { status, text } = streamState;

  // Show typing dots when: still connecting, OR streaming but text hasn't arrived yet
  const showDots =
    status === "connecting" || (status === "streaming" && !text?.trim());

  // Show stop button only while the stream is active
  const showStop = (status === "connecting" || status === "streaming") && !!onStop;

  // Don't render anything in idle state with no text
  if (status === "idle" && !text?.trim()) return null;

  return (
    /*
     * Outer row: [avatar] | [column: bubble + stop button]
     * items-start keeps avatar pinned to the TOP of the bubble,
     * NOT drifting down next to the stop button.
     */
    <div className={cn("flex items-start gap-2.5", className)}>
      {/* Avatar — always top-aligned, always next to the bubble */}
      <div className="flex-shrink-0 mt-0.5">
        {avatarNode ?? <DefaultBotAvatar />}
      </div>

      {/* Column: bubble on top, stop button below */}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {/* ── Chat bubble ─────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm self-start max-w-[90%]">
          {showDots ? (
            <TypingDots />
          ) : (
            <>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                {text}
              </p>
              {status === "error" && (
                <p className="text-xs text-red-500 mt-1.5">
                  Something went wrong — please try again.
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Stop generating button ──────────────────────────────── */}
        {/* Lives here: below the bubble, indented with it, NOT floating in empty space */}
        {showStop && (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 self-start px-3 py-1 rounded-full border border-gray-200 bg-white text-xs text-gray-400 hover:text-red-500 hover:border-red-300 transition-all duration-150"
          >
            <Square size={9} className="fill-current" aria-hidden="true" />
            Stop generating
          </button>
        )}
      </div>
    </div>
  );
};

export { StreamingChatMessage };
