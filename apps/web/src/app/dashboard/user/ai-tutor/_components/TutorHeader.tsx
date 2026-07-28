'use client'

import React from 'react'
import { Card, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Brain, Settings, History } from 'lucide-react'

interface TutorHeaderProps {
    isLoadingSubscription: boolean
    subscriptionData: any
    connectionStatus: 'online' | 'offline' | 'checking'
    conversationPhase: string
    onOpenHistory: () => void
    onReset: () => void
    userName?: string
}

export function TutorHeader({
    isLoadingSubscription,
    subscriptionData,
    connectionStatus,
    conversationPhase,
    onOpenHistory,
    onReset,
    userName,
}: TutorHeaderProps) {
    return (
        <Card className="mb-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-orange-500/5 to-blue-500/5 dark:from-orange-500/10 dark:to-blue-500/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 flex items-center justify-center shadow-lg">
                            <Brain className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                                Virat Gyankosh
                            </CardTitle>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                {userName ? `Hi ${userName}! ` : ''}Your intelligent educational companion
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Quota Display */}
                        {!isLoadingSubscription && subscriptionData && (
                            <div className="flex flex-col items-end">
                                <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Questions Today:
                                    </span>
                                    <span className={`text-sm font-semibold ${subscriptionData.quota.percentage_used >= 80
                                        ? 'text-red-600'
                                        : subscriptionData.quota.percentage_used >= 50
                                            ? 'text-yellow-600'
                                            : 'text-green-600'
                                        }`}>
                                        {subscriptionData.quota.questions_remaining}/{subscriptionData.quota.daily_limit}
                                    </span>
                                </div>
                                {/* Progress bar */}
                                <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ${subscriptionData.quota.percentage_used >= 80
                                            ? 'bg-red-500'
                                            : subscriptionData.quota.percentage_used >= 50
                                                ? 'bg-yellow-500'
                                                : 'bg-green-500'
                                            }`}
                                        style={{ width: `${Math.min(100, subscriptionData.quota.percentage_used)}%` }}
                                    />
                                </div>
                                {subscriptionData.quota.percentage_used >= 80 && (
                                    <a
                                        href="/dashboard/user/upgrade"
                                        className="text-xs text-blue-600 hover:underline mt-1"
                                    >
                                        Upgrade
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Connection Status Indicator */}
                        <div className="flex items-center space-x-1 text-xs">
                            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-green-500' :
                                connectionStatus === 'offline' ? 'bg-red-500' :
                                    'bg-yellow-500 animate-pulse'
                                }`}></div>
                            <span className={`${connectionStatus === 'online' ? 'text-green-600' :
                                connectionStatus === 'offline' ? 'text-red-600' :
                                    'text-yellow-600'
                                }`}>
                                {connectionStatus === 'online' ? 'Online' :
                                    connectionStatus === 'offline' ? 'Offline' :
                                        'Checking...'}
                            </span>
                        </div>

                        {/* History Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenHistory}
                            className="text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                            title="View chat history"
                        >
                            <History className="h-3 w-3 mr-1" />
                            History
                        </Button>

                        {/* Reset Conversation Button */}
                        {conversationPhase === 'chatting' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onReset}
                                className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                            >
                                <Settings className="h-3 w-3 mr-1" />
                                Reset
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
        </Card>
    )
}
