'use client'

import React from 'react'
import { X, History } from 'lucide-react'

interface ChatHistoryPanelProps {
    isOpen: boolean
    onClose: () => void
    onSelectSession?: (id: string) => void
    currentSessionId?: string
    /** Optional loader wired by the page; the stub does not fetch history itself. */
    onLoadConversation?: (conversationId: string) => void | Promise<void>
    children?: React.ReactNode
}

/**
 * Slide-in chat-history drawer — a faithful port of the drawer in
 * design_handoff_digiclassroom_ui/designs/DigiClassroom Student App.dc.html:
 * a dimmed backdrop and a right-anchored panel. History fetching is not yet
 * wired (this has always been a stub); the shell is what the redesign specifies.
 */
export function ChatHistoryPanel({ isOpen, onClose }: ChatHistoryPanelProps) {
    if (!isOpen) return null
    return (
        <div className="dcs">
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgb(10 15 30 / 0.5)', backdropFilter: 'blur(3px)' }}
            />
            <div
                className="card"
                style={{
                    position: 'fixed', top: 0, right: 0, zIndex: 71, height: '100vh',
                    width: 'min(360px,90vw)', borderRadius: 0, display: 'flex', flexDirection: 'column',
                    boxShadow: '0 0 60px rgba(0,0,0,.4)',
                }}
            >
                <div style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line-soft)' }}>
                    <h3 className="sech" style={{ fontSize: 17 }}>Chat history</h3>
                    <button className="iconbtn" onClick={onClose} aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center' }}>
                    <span className="plinth" style={{ width: 44, height: 44, background: 'linear-gradient(135deg,var(--turmeric),var(--gold))' }}>
                        <History className="h-[22px] w-[22px]" />
                    </span>
                    <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: '24ch' }}>
                        Your past conversations will appear here.
                    </div>
                </div>
            </div>
        </div>
    )
}
