/**
 * useAudioLesson — Frontend polling hook for async TTS audio.
 * Phase 5.2: BullMQ Production Hardening
 *
 * Polls /api/audio/[jobId] with a hard 30-second timeout.
 * Never polls indefinitely. Students already have the text response;
 * audio is non-critical enhancement.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type AudioStatus = 'idle' | 'pending' | 'completed' | 'failed' | 'timeout';

interface UseAudioLessonResult {
    audioBase64: string | null;
    status: AudioStatus;
    durationSeconds: number | null;
    retry: () => void;
}

interface UseAudioLessonOptions {
    jobId: string | null;
    /** Max poll attempts before timeout. Default: 15 (15 × 2s = 30s) */
    maxAttempts?: number;
    /** Poll interval in ms. Default: 2000 */
    intervalMs?: number;
    /** Optional callback when timeout occurs */
    onTimeout?: () => void;
}

export function useAudioLesson({
    jobId,
    maxAttempts = 15,
    intervalMs = 2000,
    onTimeout,
}: UseAudioLessonOptions): UseAudioLessonResult {
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [status, setStatus] = useState<AudioStatus>('idle');
    const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
    const attemptsRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const startPolling = useCallback(() => {
        if (!jobId) return;

        attemptsRef.current = 0;
        setStatus('pending');
        setAudioBase64(null);

        intervalRef.current = setInterval(async () => {
            attemptsRef.current++;

            // Hard timeout — never poll indefinitely
            if (attemptsRef.current > maxAttempts) {
                setStatus('timeout');
                stopPolling();
                onTimeout?.();
                return;
            }

            try {
                const res = await fetch(`/api/audio/${jobId}`);
                if (!res.ok) return; // transient error — keep polling

                const data = await res.json();

                if (data.status === 'completed') {
                    setAudioBase64(data.result?.audioBase64 ?? null);
                    setDurationSeconds(data.result?.durationSeconds ?? null);
                    setStatus('completed');
                    stopPolling();
                } else if (data.status === 'failed' || data.status === 'not_found') {
                    setStatus('failed'); // silent — text response already rendered
                    stopPolling();
                }
                // 'pending' → keep polling
            } catch {
                // Network error — keep polling until timeout
            }
        }, intervalMs);
    }, [jobId, maxAttempts, intervalMs, onTimeout, stopPolling]);

    useEffect(() => {
        startPolling();
        return stopPolling; // cleanup on unmount
    }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        audioBase64,
        status,
        durationSeconds,
        retry: startPolling,
    };
}
