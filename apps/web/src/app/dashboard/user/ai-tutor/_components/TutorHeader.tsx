'use client'

import React from 'react'
import { Brain, History, RotateCcw } from 'lucide-react'

interface TutorHeaderProps {
    isLoadingSubscription: boolean
    subscriptionData: any
    connectionStatus: 'online' | 'offline' | 'checking'
    conversationPhase: string
    onOpenHistory: () => void
    onReset: () => void
    userName?: string
}

/**
 * Faithful port of the AI-Tutor header card in
 * design_handoff_digiclassroom_ui/designs/DigiClassroom Student App.dc.html:
 * a plinth "neurology" mark, the gradient "Virat Gyankosh" wordmark, the live
 * daily-quota bar, an online/offline pill, and History / Reset ghost buttons.
 * All data stays real — the quota reads from the live subscription payload.
 */
export function TutorHeader({
    isLoadingSubscription,
    subscriptionData,
    connectionStatus,
    conversationPhase,
    onOpenHistory,
    onReset,
    userName,
}: TutorHeaderProps) {
    const quota = subscriptionData?.quota
    const used = typeof quota?.percentage_used === 'number' ? quota.percentage_used : 0
    // The bar fills with what's LEFT (mock: emerald grows as remaining grows).
    const remainingPct = Math.max(0, Math.min(100, 100 - used))
    const numColor = used >= 80 ? 'var(--kumkum)' : used >= 50 ? 'var(--turmeric)' : 'var(--emerald)'
    const online = connectionStatus === 'online'
    const statusColor = online ? 'var(--emerald)' : connectionStatus === 'offline' ? 'var(--kumkum)' : 'var(--turmeric)'
    const statusLabel = online ? 'Online' : connectionStatus === 'offline' ? 'Offline' : 'Checking…'

    return (
        <div
            className="card"
            style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
        >
            <span
                className="plinth"
                style={{ width: 48, height: 48, flex: 'none', background: 'linear-gradient(135deg,var(--kumkum),var(--indigo-ink))' }}
            >
                <Brain className="h-[25px] w-[25px]" />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div className="grad" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>
                    Virat Gyankosh
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {userName ? `Hi ${userName}! ` : 'Hi! '}Your intelligent educational companion
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {!isLoadingSubscription && quota && (
                    <div style={{ minWidth: 150 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Questions today</span>
                            <strong style={{ fontSize: 12, color: numColor, whiteSpace: 'nowrap' }}>
                                {quota.questions_remaining}/{quota.daily_limit}
                            </strong>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
                            <div
                                style={{
                                    height: '100%', width: `${remainingPct}%`, borderRadius: 999,
                                    background: 'linear-gradient(90deg,var(--emerald),var(--teal-light))',
                                    transition: 'width .3s',
                                }}
                            />
                        </div>
                    </div>
                )}

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: statusColor }}>
                    <span
                        className={online ? '' : 'dotpulse'}
                        style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }}
                    />
                    {statusLabel}
                </span>

                <button className="btn btn-ghost" onClick={onOpenHistory} style={{ padding: '8px 14px', fontSize: 13 }} title="View chat history">
                    <History className="h-[17px] w-[17px]" /> History
                </button>

                {conversationPhase === 'chatting' && (
                    <button className="btn btn-ghost" onClick={onReset} style={{ padding: '8px 14px', fontSize: 13 }}>
                        <RotateCcw className="h-[17px] w-[17px]" /> Reset
                    </button>
                )}
            </div>
        </div>
    )
}
