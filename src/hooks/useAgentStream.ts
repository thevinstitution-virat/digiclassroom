import { useState, useCallback, useRef } from 'react';
import { AgentStreamChunk } from '@/types/streaming';
import { AnyCitation } from '@/types/citations';

export type StreamStatus =
    | 'idle'
    | 'connecting'
    | 'streaming'
    | 'complete'
    | 'error'
    | 'scope_violation';

export interface StreamState {
    status: StreamStatus;
    tokens: string;
    citations: AnyCitation[];
    confidenceScore: number;
    audioJobId: string | null;
    scopeViolationMessage: string | null;
    errorMessage: string | null;
    isRecoverableError: boolean;
    agentName: string | null;
}

interface UseAgentStreamOptions {
    agentType: string;
    onComplete?: (finalText: string, citations: AnyCitation[]) => void;
    onScopeViolation?: (message: string) => void;
    onError?: (message: string, recoverable: boolean) => void;
}

const INITIAL_STATE: StreamState = {
    status: 'idle',
    tokens: '',
    citations: [],
    confidenceScore: 0,
    audioJobId: null,
    scopeViolationMessage: null,
    errorMessage: null,
    isRecoverableError: false,
    agentName: null,
};

export function useAgentStream({
    agentType,
    onComplete,
    onScopeViolation,
    onError,
}: UseAgentStreamOptions) {
    const [state, setState] = useState<StreamState>(INITIAL_STATE);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isCompleteRef = useRef<boolean>(false);
    const tokensRef = useRef<string>('');
    const citationsRef = useRef<any[]>([]);

    const sendMessage = useCallback(async (input: {
        query: string;
        studentName: string;
        grade: number;
        subject: string;
        language: string;
        sessionId: string;
        studentId: string;
        conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
        // Per-message agent identity (menu intent); overrides the hook-level default
        agentType?: string;
        // Student's subscribed medium (ENGLISH | HINDI) — drives default response language
        medium?: string;
        // CBSE answer-length tier (Deep Dive only): vsa | sa | la | essay
        answerLength?: string;
    }) => {
        // The agent persona selected for THIS message — falls back to the hook default
        const effectiveAgentType = input.agentType || agentType;
        // Cancel any in-flight stream before starting new one (handles React Strict Mode double-invokes)
        abortControllerRef.current?.abort();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        isCompleteRef.current = false;
        tokensRef.current = '';
        citationsRef.current = [];

        setState({ ...INITIAL_STATE, status: 'connecting' });

        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentType: effectiveAgentType, input }),
                signal: abortController.signal,
            });

            // Strict Mode race condition guard
            if (abortController.signal.aborted) return;

            let activeResponse = response;

            // Non-streaming fallback: agent not yet on graph path or fallback forced
            if (response.status === 400 || response.status === 404) {
                // Connect to the legacy /api/ai/chat endpoint which also streams (SSE) but expects a different payload
                const legacyPayload = {
                    message: input.query,
                    board: 'CBSE', // fallback
                    classLevel: `Class ${input.grade || 10}`,
                    subject: input.subject || 'general',
                    medium: input.medium,  // student's subscribed medium → default response language
                    answerLength: input.answerLength,  // CBSE answer-length tier (Deep Dive only)
                    conversationHistory: input.conversationHistory,
                    roleContext: {
                        menuIntent: effectiveAgentType
                    }
                };

                const fallbackResponse = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(legacyPayload),
                    signal: abortController.signal,
                });

                if (abortController.signal.aborted) return;

                if (!fallbackResponse.ok || !fallbackResponse.body) {
                    throw new Error('Legacy fallback connection failed');
                }

                activeResponse = fallbackResponse;
            }

            if (!activeResponse.ok || !activeResponse.body) {
                throw new Error(`Stream connection failed: ${activeResponse.status}`);
            }

            setState(prev => ({ ...prev, status: 'streaming' }));

            const reader = activeResponse.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (abortController.signal.aborted) {
                    reader.cancel('Operation cancelled by user');
                    break;
                }

                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Hardened SSE Parsing: Split strictly on event boundaries (\n\n)
                const eventBlocks = buffer.split('\n\n');

                // The last block might be incomplete arriving over the network, keep in buffer
                // If the buffer ends EXACTLY with \n\n, eventBlocks.pop() returns an empty string, which is correct
                buffer = eventBlocks.pop() ?? '';

                for (const eventBlock of eventBlocks) {
                    if (!eventBlock.trim()) continue;

                    // Find the exact line denoting the JSON payload
                    const dataLine = eventBlock.split('\n').find(line => line.startsWith('data: '));
                    if (!dataLine) continue;

                    const jsonStr = dataLine.slice(6).trim();
                    if (!jsonStr) continue;
                    
                    if (jsonStr === '[DONE]') {
                        setState(prev => ({ ...prev, status: 'complete' as const }));
                        
                        if (!isCompleteRef.current) {
                            isCompleteRef.current = true;
                            // Capture values synchronously from refs
                            const finalTokens = tokensRef.current;
                            const finalCitations = citationsRef.current;
                            setTimeout(() => {
                                onComplete?.(finalTokens, finalCitations);
                            }, 0);
                        }
                        continue;
                    }

                    let chunk: AgentStreamChunk;
                    try {
                        chunk = JSON.parse(jsonStr);
                    } catch {
                        // Malformed JSON is safely dropped, stream continues
                        continue;
                    }

                    switch (chunk.type) {
                        case 'token':
        // @ts-ignore
                        case 'chunk': // Legacy `/api/ai/chat` uses 'chunk'
                            tokensRef.current += chunk.content;
                            setState(prev => ({
                                ...prev,
                                tokens: tokensRef.current,
                            }));
                            break;

                        case 'citations':
                            citationsRef.current = chunk.citations;
                            setState(prev => ({
                                ...prev,
                                citations: citationsRef.current,
                                confidenceScore: chunk.confidenceScore,
                                agentName: chunk.agentName,
                            }));
                            break;

                        case 'audio_job':
                            setState(prev => ({ ...prev, audioJobId: chunk.audioJobId }));
                            break;

                        case 'scope_violation':
                            setState(prev => ({
                                ...prev,
                                status: 'scope_violation',
                                scopeViolationMessage: chunk.message,
                                tokens: chunk.message,
                            }));
                            onScopeViolation?.(chunk.message);
                            break;

                        case 'error':
                            setState(prev => ({
                                ...prev,
                                status: 'error',
                                errorMessage: chunk.message,
                                isRecoverableError: chunk.recoverable,
                            }));
                            onError?.(chunk.message, chunk.recoverable);
                            break;

        // @ts-ignore
                        case 'complete': { // Legacy `/api/ai/chat` uses 'complete' instead of 'done' and sends sources here
                            // Use the final answer from chunk if available, otherwise fallback to accumulated tokens
        // @ts-ignore
                            if (chunk.answer) {
        // @ts-ignore
                                tokensRef.current = chunk.answer;
                            }
        // @ts-ignore
                            if (chunk.sources?.sources) {
        // @ts-ignore
                                citationsRef.current = chunk.sources.sources;
                            }
                            
                            setState(prev => ({ 
                                ...prev, 
                                status: 'complete' as const,
                                tokens: tokensRef.current,
                                citations: citationsRef.current,
        // @ts-ignore
                                confidenceScore: chunk.sources?.sources?.[0]?.confidence || prev.confidenceScore,
        // @ts-ignore
                                agentName: chunk.menu?.agentUsed || prev.agentName,
                            }));
                            
                            if (!isCompleteRef.current) {
                                isCompleteRef.current = true;
                                const finalTokens = tokensRef.current;
                                const finalCitations = citationsRef.current;
                                setTimeout(() => {
                                    onComplete?.(finalTokens, finalCitations);
                                }, 0);
                            }
                            break;
                        }

                        case 'done': {
                            setState(prev => ({ ...prev, status: 'complete' as const }));
                            
                            if (!isCompleteRef.current) {
                                isCompleteRef.current = true;
                                const finalTokens = tokensRef.current;
                                const finalCitations = citationsRef.current;
                                setTimeout(() => {
                                    onComplete?.(finalTokens, finalCitations);
                                }, 0);
                            }
                            break;
                        }
                    }
                }
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') return; // User or React Strict Mode cancelled

            setState(prev => ({
                ...prev,
                status: 'error',
                errorMessage: (err as Error).message,
                isRecoverableError: true,
            }));
            onError?.((err as Error).message, true);
        }
    }, [agentType, onComplete, onScopeViolation, onError]);

    const cancel = useCallback(() => {
        abortControllerRef.current?.abort();
        setState(prev => ({ ...prev, status: 'idle' }));
    }, []);

    const reset = useCallback(() => {
        setState(INITIAL_STATE);
    }, []);

    return { state, sendMessage, cancel, reset };
}
