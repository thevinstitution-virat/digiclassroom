'use client'

import React from 'react'
import { Badge } from '@/components/core/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/ui/select'
import { Sparkles } from 'lucide-react'

interface ContextOption {
    value: string
    label: string
    board: string
    classLevel: string
    isLocked: boolean
    requiredPlan?: string
    requiredPlanPrice?: string
}

interface ContextSelectorProps {
    visible: boolean
    currentValue: string
    options: ContextOption[]
    subscriptionData: any
    onValueChange: (value: string) => void
}

export function ContextSelector({
    visible,
    currentValue,
    options,
    subscriptionData,
    onValueChange,
}: ContextSelectorProps) {
    if (!visible)
  return null

    const unlockedOptions = options.filter(opt => !opt.isLocked)
    const lockedOptions = options.filter(opt => opt.isLocked)

    return (
        <div className="mb-3">
            <div className="flex items-center space-x-2">
                <Select value={currentValue} onValueChange={onValueChange}>
                    <SelectTrigger className="w-56 h-11 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 border-orange-200/60 dark:border-orange-700/60 hover:border-blue-400/80 dark:hover:border-blue-500/80 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 focus:ring-2 focus:ring-blue-500/20">
                        <SelectValue placeholder="Select board & class" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-2 border-orange-200/60 dark:border-orange-700/60 rounded-xl shadow-lg max-h-[400px]">
                        {/* Unlocked Options Section */}
                        {unlockedOptions.length > 0 && (
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Your Access
                            </div>
                        )}
                        {unlockedOptions.map(option => (
                            <SelectItem
                                key={option.value}
                                value={option.value}
                                className="cursor-pointer hover:bg-gradient-to-r hover:from-orange-50/60 hover:to-blue-50/60 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20 rounded-lg transition-colors duration-150 my-0.5"
                            >
                                <span className="font-medium text-gray-800 dark:text-gray-200">{option.label}</span>
                            </SelectItem>
                        ))}

                        {/* Locked Options Section - Upgrade CTA */}
                        {lockedOptions.length > 0 && (
                            <>
                                <div className="px-2 py-1.5 mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide flex items-center">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Upgrade to Unlock
                                </div>
                                {lockedOptions.slice(0, 8).map(option => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        className="cursor-pointer hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20 rounded-lg transition-colors duration-150 my-0.5 opacity-75"
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-medium text-gray-600 dark:text-gray-400">{option.label}</span>
                                            <Badge variant="outline" className="ml-2 text-xs bg-gradient-to-r from-orange-100 to-blue-100 dark:from-orange-900/30 dark:to-blue-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400">
                                                {option.requiredPlan}
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                                {lockedOptions.length > 8 && (
                                    <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 text-center italic">
                                        +{lockedOptions.length - 8} more options available
                                    </div>
                                )}
                            </>
                        )}
                    </SelectContent>
                </Select>
                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="hidden sm:inline">Switch anytime</span>
                    {subscriptionData && (
                        <Badge variant="outline" className="ml-1 bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/30 dark:to-blue-900/30 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400 font-semibold">
                            {subscriptionData.subscription.plan_code === 'FREE_TRIAL' ? 'Free Trial' :
                                subscriptionData.subscription.plan_code === 'BASIC' || subscriptionData.subscription.plan_code === 'BASIC_CBSE' ? 'Basic' :
                                    subscriptionData.subscription.plan_code === 'CLASSIC' ? 'Classic' :
                                        subscriptionData.subscription.plan_code === 'PRO' || subscriptionData.subscription.plan_code === 'PRO_CBSE' ? 'Pro' : 'Premium'}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    )
}
