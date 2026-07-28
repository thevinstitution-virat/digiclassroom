'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditBadge } from '@/components/ai/sarvagya/CreditBadge';
import {
    Coins, Zap, CheckCircle2, ShieldCheck,
    ArrowLeft, CreditCard, Loader2, Sparkles,
    ChevronRight
} from 'lucide-react';
import Link from 'next/link';

const CREDIT_PACKAGES = [
    {
        id: 'pack_50',
        title: 'Starter Pack',
        credits: 50,
        price: 99,
        originalPrice: 149,
        save: 33,
        popular: false,
        gradient: 'from-blue-500 to-cyan-500'
    },
    {
        id: 'pack_200',
        title: 'Researcher Pro',
        credits: 200,
        price: 299,
        originalPrice: 596,
        save: 50,
        popular: true,
        gradient: 'from-purple-500 to-indigo-600'
    },
    {
        id: 'pack_1000',
        title: 'Power User',
        credits: 1000,
        price: 999,
        originalPrice: 2980,
        save: 66,
        popular: false,
        gradient: 'from-orange-500 to-red-500'
    }
];

export default function CreditStorePage() {
    const { data: balanceData, isLoading } = useQuery({
        queryKey: ['sarvagya-credits'],
        queryFn: async () => {
            const res = await fetch('/api/user/subscription');
            if (!res.ok)
                throw new Error('Failed to fetch balance');
            const json = await res.json();
            return json.data;
        }
    });

    const sarvagyaCredits = balanceData?.quota?.sarvagya_credits || 0;
    const isPremium = balanceData?.is_active || false;

    const handlePurchase = async (packId: string) => {
        alert(`This would trigger Razorpay checkout for package: ${packId}\n\nTesting Mode: Credits will be added automatically via webhook mock.`);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>

            {/* Hero Header Section */}
            <section className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 py-16">
                <div className="absolute inset-0 bg-white/30 dark:bg-black/20 backdrop-blur-sm" />

                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-8">
                        <Link href="/dashboard/sarvagya" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Sarvagya
                        </Link>

                        <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-full border border-amber-200/50 dark:border-amber-200/20 mb-6 backdrop-blur-sm mx-auto block">
                            <Coins className="h-4 w-4 text-amber-500 mr-2" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Credit Store</span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Top Up Your <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Research Balance</span>
                        </h1>

                        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                            1 Credit = 1 deep research query with full document processing and LLM synthesis
                        </p>
                    </div>

                    {/* Balance Card inside hero */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden max-w-3xl mx-auto">
                        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl" />

                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-indigo-100 font-medium mb-1">Available Balance</h2>
                                {isLoading ? (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                                    </div>
                                ) : (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-bold tracking-tight">{sarvagyaCredits.toLocaleString()}</span>
                                        <span className="text-xl font-medium text-indigo-200">Credits</span>
                                    </div>
                                )}
                            </div>

                            {!isPremium && (
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl max-w-xs">
                                    <div className="flex gap-2 items-start mb-2">
                                        <Zap className="w-5 h-5 text-amber-400 mt-0.5" />
                                        <h3 className="font-bold">Pro Subscribers get +100 Credits Monthly</h3>
                                    </div>
                                    <button className="mt-3 w-full py-2 bg-white text-indigo-700 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm">
                                        Upgrade to Pro
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Packages */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        Top Up <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Packages</span>
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Choose the research power that fits your needs
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {CREDIT_PACKAGES.map((pkg) => (
                        <div
                            key={pkg.id}
                            className={`relative bg-white dark:bg-gray-900 rounded-2xl border-2 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-2xl transform hover:scale-105 group ${pkg.popular
                                ? 'border-indigo-500 shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20 scale-100 md:scale-105 z-10'
                                : 'border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${pkg.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                            {pkg.popular && (
                                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider text-center py-2 w-full">
                                    ✨ Most Popular
                                </div>
                            )}

                            <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10">
                                <div className="mb-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${pkg.gradient} text-white mb-3`}>
                                        {pkg.save}% OFF
                                    </span>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{pkg.title}</h3>
                                </div>

                                <div className="flex items-baseline mb-2">
                                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">₹{pkg.price}</span>
                                    <span className="text-gray-400 line-through ml-2 text-sm">₹{pkg.originalPrice}</span>
                                </div>

                                <div className="py-6 my-auto">
                                    <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                        <div className="text-center">
                                            <span className="block text-3xl font-black text-gray-800 dark:text-gray-100 mb-1">
                                                +{pkg.credits}
                                            </span>
                                            <span className="text-sm font-medium text-gray-500 flex items-center justify-center gap-1">
                                                <Coins className="w-4 h-4 text-amber-500" />
                                                Credits
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handlePurchase(pkg.id)}
                                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 transform active:scale-95 ${pkg.popular
                                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                                        : 'bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white shadow-md'
                                        }`}
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Buy Now
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Info footer */}
                <div className="mt-12 bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">Secure Payments via Razorpay</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                            Top-up credits never expire. Payments are processed securely and credits are instantly added to your account upon completion.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
