/**
 * Audio Generation Job Types
 * Shared between queue producer (AgentManager) and worker (instrumentation.ts)
 */

import type { AudioLessonResult } from '@/lib/services/AudioLessonService';

export interface AudioJobData {
    /** The text content to synthesize */
    content: string;
    /** Agent name — used by AudioLessonService to check eligibility */
    agentName: string;
    /** Language for TTS synthesis */
    language: 'english' | 'hindi';
    /** Session identifier for job deduplication */
    sessionId: string;
}

export type AudioJobResult = AudioLessonResult | null;
