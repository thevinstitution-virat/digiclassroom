'use client'

import React from 'react'
import { Coins, Plus } from 'lucide-react'

interface CreditBadgeProps {
    showAddButton?: boolean
    className?: string
}

export function CreditBadge({ showAddButton = true, className = '' }: CreditBadgeProps) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-200 dark:border-blue-800 ${className}`}>
            <Coins className="w-4 h-4 text-yellow-500" />
            <span>1,000 Credits</span>
            {showAddButton && (
                <button className="ml-1 p-0.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <Plus className="w-3 h-3" />
                </button>
            )}
        </div>
    )
}
