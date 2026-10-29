/**
 * Streaming Chat API Route
 * Phase 5.1: SSE endpoint for LangGraph streaming responses.
 *
 * Only available for agents on the graph path.
 * Returns 400 for non-graph agents with a fallback URL.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getOrgContextOrNull } from '@/lib/auth/get-org-context';
import { headers } from 'next/headers';
import { getFeatureFlags } from '@/lib/config/feature-flags';
import { GRAPH_FEATURE_FLAGS } from '@/lib/agents/graph/registry';
import { studentRateLimiter } from '@/lib/services/student-rate-limiter';
import { StudentCostMonitor } from '@/lib/services/cost-monitor';
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service';
import { capTutorHistory, isTutorTier, tutorRequestTokens, tutorTierModel, tutorTiersEnabled, tutorTokenQuotaEnabled, useTutorModelForRequest, withTutorScope, type TutorTier } from '@/lib/ai/tutor-tiers';

export const runtime = 'nodejs'; // Required for streaming + BullMQ

// Each request runs in its own tier scope, so the Basic/Prime model it sets reaches its own agents only.
export function POST(req: NextRequest) {
    return withTutorScope(() => handlePost(req));
}

async function handlePost(req: NextRequest) {
    const body = await req.json() as Record<string, unknown>;

    // Determine which agents currently support streaming (= on graph path)
    const flags = getFeatureFlags();
    const streamingEligible = Object.entries(GRAPH_FEATURE_FLAGS)
        .filter(([, flag]) => flag && flags[flag])
        .map(([agentType]) => agentType);

    const menuIntent = (body.agentType as string) || (body.metadata as any)?.menu_intent || (body.input as any)?.metadata?.menu_intent;
    if (!menuIntent || !streamingEligible.includes(menuIntent)) {
        return Response.json(
            {
                error: `${menuIntent || 'unknown'} is not available for streaming.`,
                availableAgents: streamingEligible,
                fallback: '/api/ai/chat', // Updated fallback to the correct legacy endpoint
            },
            { status: 400 }
        );
    }

    // ── Identity from the verified server session (NOT spoofable body fields) ──
    // chat/stream serves both B2C (no org) and institutional students, so we
    // authenticate via the session but do NOT require an active organization here.
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = (session.user.role ?? 'student') as string;
    // ── Phase 2c: VERIFIED org scope ──────────────────────────────────────────
    // Resolve the active org via getOrgContextOrNull(), which verifies the user
    // is actually a member of the x-org-id org (the header alone is forgeable).
    // Returns null for B2C / no-org / non-members.
    const orgCtx = await getOrgContextOrNull();

    // Map verified context to the RAG vector-isolation directive:
    //   - platform staff (super_admin/admin) → null      → all orgs' + global vectors
    //   - verified org member                 → orgId     → own org + global (NCERT)
    //   - B2C / no org / not a member          → undefined → global-only (fail closed)
    const ragOrgScope: string | null | undefined =
        orgCtx?.isPlatformBypass ? null : (orgCtx?.orgId ?? undefined);

    // Global cost check - fail open if langfuse is down, but block if budget exceeded
    const budget = await StudentCostMonitor.checkDailyBudget();
    if (!budget.safe) {
        return Response.json(
            {
                error: 'AI Services are temporarily paused due to scheduled maintenance (daily limit). Please try again tomorrow.',
                budgetExceeded: true
            },
            { status: 503 }
        );
    }

    // Rate limiting per user — userId/userRole derived from the session above.
    // Fast path: if admin or teacher, allow. Otherwise rate limit students
    if (userRole === 'student') {
        const rateLimit = await studentRateLimiter(userId, 'FREE');
        if (!rateLimit.allowed) {
            return Response.json(
                {
                    error: 'DAILY_LIMIT_EXCEEDED',
                    message: 'You have reached your daily question limit.',
                    resetTime: new Date(rateLimit.resetTimeMs).toISOString()
                },
                { status: 429 } // 429 Too Many Requests
            );
        }
    }

    // Basic or Prime (TUTOR_TIERS_ENABLED): the same daily split as the /api/ai/chat path, counted in ai_tutor_usage
    // (the Redis limit above still applies). Off: nothing here runs and the agents use their own model as before.
    const inputForTier = (body.input as any) || {};
    const requestedTier: TutorTier = isTutorTier(inputForTier.tier ?? body.tier) ? (inputForTier.tier ?? body.tier) : 'basic';
    let tier: TutorTier = 'basic';
    let downgraded = false;
    // The token windows are checked by the same tier check (it counts tokens when TUTOR_TOKEN_QUOTA_ENABLED).
    if (tutorTiersEnabled() || tutorTokenQuotaEnabled()) {
        const check = await subscriptionValidationService.checkTutorTier(userId, requestedTier);
        if (!check.allowed) {
            return Response.json({ error: 'DAILY_LIMIT_EXCEEDED', message: check.message, limit: check.limit }, { status: 429 });
        }
        tier = check.tier;
        downgraded = check.downgraded;
        // Set before the stream is built: its start() runs inside this request's context, so every agent model
        // created for this answer uses the tier's model.
        useTutorModelForRequest(tutorTierModel(tier));
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const { getAgentGraph } = await import('@/lib/agents/graph/registry');
                const { HumanMessage, AIMessage } = await import('@langchain/core/messages');

                const graph = getAgentGraph(menuIntent);

                const inputData = (body.input as any) || {};
                // At most the last 6 messages, as the tutor screen sends (capTutorHistory).
                const messages = capTutorHistory(inputData.conversationHistory).map((msg: any) =>
                    msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
                );
                
                if (inputData.query) {
                    messages.push(new HumanMessage(inputData.query));
                }

                const streamEvents = await graph.streamEvents({
                    messages,
                    studentName: inputData.studentName || '',
                    grade: inputData.grade || 9,
                    subject: inputData.subject || '',
                    language: inputData.language || 'english',
                    sessionId: inputData.sessionId || '',
                    // Real, server-verified identity — not a client-supplied value.
                    studentId: userId,
                    // Batch 2b: per-org vector isolation directive (see TutorGraphState).
                    organizationId: ragOrgScope,
                    agentName: menuIntent,
                }, { version: "v2" });

                for await (const event of streamEvents) {
                    if (event.event === "on_chat_model_stream") {
                        const content = event.data.chunk?.content;
                        if (content && typeof content === 'string') {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ type: 'token', content })}\n\n`)
                            );
                        }
                    } else if (event.event === "on_chain_end" && event.name === "LangGraph") {
                        const state = event.data.output;
                        if (state) {
                            // Check for scope violations
                            if (state.ncertScopeValid === false && state.scopeViolationResponse) {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'scope_violation',
                                        message: state.scopeViolationResponse
                                    })}\n\n`)
                                );
                                controller.close();
                                return;
                            }
                            
                            // Send citations block
                            if (state.citations && state.citations.length > 0) {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        type: 'citations',
                                        citations: state.citations,
                                        confidenceScore: state.confidenceScore || 0,
                                        scopeValid: state.ncertScopeValid !== false,
                                        agentName: state.agentName || menuIntent
                                    })}\n\n`)
                                );
                            }
                        }
                    }
                }
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', tier, downgraded })}\n\n`));
                controller.close();
                // What every OpenAI call of this answer cost, for the token window.
                subscriptionValidationService
                    .recordTutorTokens(userId, tier, tutorRequestTokens())
                    .catch((e) => console.error('[tutor] failed to record tokens:', e));
                if (tutorTiersEnabled() || tutorTokenQuotaEnabled()) {
                    subscriptionValidationService
                        .incrementQuestionCount(userId, userId, {
                            subject: String(inputForTier.subject || 'general'),
                            board: 'CBSE',
                            class: String(inputForTier.grade || ''),
                            menu_type: String(menuIntent),
                            timestamp: new Date().toISOString(),
                        } as any, tier)
                        .catch((e) => console.error('[tutor] failed to count the question:', e));
                }
            } catch (err) {
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({
                            type: 'error',
                            message: (err as Error).message,
                            recoverable: false,
                        })}\n\n`
                    )
                );
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable Nginx buffering
        },
    });
}
