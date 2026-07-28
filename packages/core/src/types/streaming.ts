/**
 * AgentStreamChunk — Discriminated union for streaming agent responses.
 * Phase 5.1: Streaming Infrastructure
 *
 * Frontend switches on `chunk.type` to handle each event:
 * - 'token': incremental text content
 * - 'citations': full citation block after generation completes
 * - 'audio_job': BullMQ job ID for async TTS polling
 * - 'scope_violation': polite refusal for out-of-scope queries
 * - 'error': recoverable or fatal error
 * - 'done': terminal event — close the stream
 */

import type { AnyCitation } from './citations';

export type AgentStreamChunk =
    | {
        type: 'token';
        content: string;
    }
    | {
        type: 'citations';
        citations: AnyCitation[];
        confidenceScore: number;
        scopeValid: boolean;
        agentName: string;
    }
    | {
        type: 'audio_job';
        audioJobId: string;
    }
    | {
        type: 'scope_violation';
        message: string;
    }
    | {
        type: 'error';
        message: string;
        recoverable: boolean;
    }
    | {
        type: 'done';
    };
