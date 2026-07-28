'use client'

import React from 'react'
import { Button } from '@/components/core/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle
} from '@/components/core/ui/dialog'
import { Lock, Sparkles, CheckCircle, ArrowRight } from 'lucide-react'

interface UpgradeModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    data: {
        requiredPlan: string
        requiredPlanPrice: string
        selectedBoard: string
        selectedClass: string
    } | null
    onUpgradeClick: () => void
}

export function UpgradeModal({ open, onOpenChange, data, onUpgradeClick }: UpgradeModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-2 border-orange-200/60 dark:border-orange-700/60">
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            <div className="relative bg-gradient-to-r from-orange-500 to-blue-600 p-4 rounded-full">
                                <Lock className="h-8 w-8 text-white" />
                            </div>
                        </div>
                    </div>
                    <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                        Upgrade to {data?.requiredPlan} Plan
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-600 dark:text-gray-400 mt-2">
                        Unlock access to <span className="font-semibold text-gray-800 dark:text-gray-200">{data?.selectedBoard} {data?.selectedClass}</span> and more!
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Current Selection Info */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-orange-200/60 dark:border-orange-700/60 rounded-xl p-4">
                        <div className="flex items-start space-x-3">
                            <div className="bg-gradient-to-r from-orange-100 to-blue-100 dark:from-orange-900/40 dark:to-blue-900/40 p-2 rounded-lg">
                                <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">You&apos;re trying to access:</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">{data?.selectedBoard} {data?.selectedClass}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Plan Benefits */}
                    <div className="bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 border-2 border-orange-200/40 dark:border-orange-700/40 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                            <Sparkles className="h-4 w-4 mr-2 text-orange-600 dark:text-orange-400" />
                            {data?.requiredPlan} Plan Benefits:
                        </h4>
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                            {data?.requiredPlan === 'Pro' ? (
                                <>
                                    <li className="flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span><strong>All boards</strong> (CBSE, ICSE, State Board)</span>
                                    </li>
                                    <li className="flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span><strong>All classes</strong> (1-12)</span>
                                    </li>
                                    <li className="flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span><strong>150 questions/day</strong> (5x more than Basic)</span>
                                    </li>
                                    <li className="flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span>All subjects included</span>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className="flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span><strong>60 questions/day</strong> (2x more than Basic)</span>
                                    </li>
                                    <li className="flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span>Access to more classes</span>
                                    </li>
                                    <li className="flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span>All subjects included</span>
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>

                    {/* Pricing */}
                    <div className="text-center">
                        <div className="inline-flex items-baseline space-x-2">
                            <span className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                                {data?.requiredPlanPrice}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cancel anytime • No hidden fees</p>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 dark:text-gray-200"
                    >
                        Maybe Later
                    </Button>
                    <Button
                        onClick={onUpgradeClick}
                        className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                        Upgrade Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
