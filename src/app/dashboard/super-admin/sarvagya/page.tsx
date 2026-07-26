'use client'

import { useEffect, useState } from 'react'
import {
    Brain,
    Activity,
    CheckCircle,
    AlertTriangle,
    Coins,
    Users,
    BarChart3,
    Settings,
    Globe,
    Shield,
    Zap,
    Database,
    ExternalLink,
    RefreshCw
} from 'lucide-react'

interface SarvagyaStatus {
    isOnline: boolean
    url: string
    tokenConfigured: boolean
}

export default function AdminSarvagyaPage() {
    const [status, setStatus] = useState<SarvagyaStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        checkServiceStatus()
    }, [])

    const checkServiceStatus = async () => {
        setRefreshing(true)
        try {
            // Attempt to ping the Sarvagya service health endpoint
            const res = await fetch('/api/super-admin/sarvagya/health')
            if (res.ok) {
                const data = await res.json()
                setStatus({
                    isOnline: data.online ?? false,
                    url: data.url ?? 'Not Configured',
                    tokenConfigured: data.tokenConfigured ?? false,
                })
            } else {
                setStatus({
                    isOnline: false,
                    url: 'Checking...',
                    tokenConfigured: false,
                })
            }
        } catch {
            setStatus({
                isOnline: false,
                url: 'Connection Error',
                tokenConfigured: false,
            })
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const configItems = [
        {
            label: 'LLM Provider',
            value: status?.url || '—',
            icon: Globe,
            gradient: 'from-blue-500 to-cyan-500',
            bgColor: 'from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200/30'
        },
        {
            label: 'API Key',
            value: status?.tokenConfigured ? 'Configured ✓' : 'Not Set ✗',
            icon: Shield,
            gradient: 'from-green-500 to-emerald-500',
            bgColor: status?.tokenConfigured
                ? 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200/30'
                : 'from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200/30'
        },
        {
            label: 'Connection Status',
            value: status?.isOnline ? 'Online' : 'Offline',
            icon: Activity,
            gradient: status?.isOnline ? 'from-green-500 to-emerald-500' : 'from-red-500 to-orange-500',
            bgColor: status?.isOnline
                ? 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200/30'
                : 'from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200/30'
        }
    ]

    const quickActions = [
        {
            name: 'Manage User Subscriptions & Credits',
            href: '/dashboard/super-admin/users',
            description: 'Navigate to user management to view and adjust individual user access and credits',
            gradient: 'from-blue-500 to-cyan-500',
            icon: Users
        },
        {
            name: 'Preview Credit Store',
            href: '/dashboard/sarvagya/store',
            description: 'Preview the credit store packages exactly as users see them',
            gradient: 'from-amber-500 to-orange-500',
            icon: BarChart3
        }
    ]

    const creditStats = [
        { label: 'Default Monthly Quota', value: '100', icon: Coins, gradient: 'from-amber-500 to-orange-500', bgColor: 'from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200/30' },
        { label: 'Credit Cost per Query', value: '1', icon: Zap, gradient: 'from-purple-500 to-indigo-500', bgColor: 'from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200/30' },
        { label: 'Microservice Backend', value: 'FastAPI', icon: Database, gradient: 'from-green-500 to-emerald-500', bgColor: 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200/30' },
        { label: 'AI Engine', value: 'Surfsense', icon: Brain, gradient: 'from-blue-500 to-cyan-500', bgColor: 'from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200/30' },
    ]

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="container mx-auto px-4 py-8 max-w-7xl">
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                                <Brain className="h-10 w-10 text-white" />
                            </div>
                            <h3 className="text-3xl font-bold mb-4">
                                <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                                    Loading Sarvagya Config...
                                </span>
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-md mx-auto">
                                Checking microservice connectivity and configuration
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-sm border border-amber-200/30 rounded-2xl px-6 py-3 mb-6">
                        <Brain className="h-5 w-5 text-amber-500" />
                        <span className="text-sm font-medium bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                            AI Microservice Configuration
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-4">
                            <Brain className="h-12 w-12 text-amber-500" />
                            Sarvagya AI Config
                        </span>
                    </h1>

                    <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
                        Manage the Sarvagya (Surfsense) AI research microservice, credit policies, and service connectivity
                    </p>
                </div>

                {/* Service Status Banner */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 bg-gradient-to-r ${status?.isOnline ? 'from-green-500 to-emerald-500' : 'from-red-500 to-orange-500'} rounded-2xl flex items-center justify-center shadow-lg`}>
                                <Activity className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sarvagya Service Status</h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Internal LLM provider connectivity and health
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={checkServiceStatus}
                                disabled={refreshing}
                                className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>

                            <div className={`flex items-center gap-3 px-6 py-3 border rounded-xl ${status?.isOnline
                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200/50'
                                : 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200/50'
                                }`}>
                                {status?.isOnline
                                    ? <CheckCircle className="h-5 w-5 text-green-500" />
                                    : <AlertTriangle className="h-5 w-5 text-red-500" />
                                }
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                                    {status?.isOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuration Cards */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
                    <div className="mb-8">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Settings className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                                    Service Configuration
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Current microservice connection parameters
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {configItems.map((item, index) => (
                            <div
                                key={index}
                                className={`p-6 bg-gradient-to-r ${item.bgColor} rounded-2xl border hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]`}
                            >
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className={`w-10 h-10 bg-gradient-to-r ${item.gradient} rounded-xl flex items-center justify-center shadow-md`}>
                                        <item.icon className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200">{item.label}</h3>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 font-medium text-lg truncate">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Credit System Stats */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
                    <div className="mb-8">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Coins className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                                    System Architecture & Defaults
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Current platform-wide architecture and static credit policies
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {creditStats.map((stat, index) => (
                            <div
                                key={index}
                                className={`p-6 bg-gradient-to-r ${stat.bgColor} rounded-2xl border hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`w-12 h-12 bg-gradient-to-r ${stat.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                                        <stat.icon className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        {stat.label}
                                    </p>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                                        {stat.value}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
                    <div className="mb-8">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Zap className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                                    Quick Actions
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Manage Sarvagya resources and settings
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {quickActions.map((action, index) => (
                            <a
                                key={action.name}
                                href={action.href}
                                className="block p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-2xl hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-12 h-12 bg-gradient-to-r ${action.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                                            <action.icon className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                                                {action.name}
                                            </h3>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                {action.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`px-4 py-2 bg-gradient-to-r ${action.gradient} text-white text-sm font-bold rounded-xl shadow-md group-hover:shadow-lg transition-all duration-200 transform group-hover:scale-105`}>
                                        Go →
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}
