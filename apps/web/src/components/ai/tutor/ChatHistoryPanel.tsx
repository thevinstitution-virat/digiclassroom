'use client'

import React from 'react'

interface ChatHistoryPanelProps {
    isOpen: boolean
    onClose: () => void
    onSelectSession: (id: string) => void
    currentSessionId: string
    children?: React.ReactNode
}

export function ChatHistoryPanel({ isOpen, onClose }: ChatHistoryPanelProps) {
    if (!isOpen)
  return null
    return (
        <div className="p-4 bg-white dark:bg-gray-800 border-l">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Chat History</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
            </div>
            <div className="text-sm text-gray-500">History panel stub</div>
        </div>
    )
}
