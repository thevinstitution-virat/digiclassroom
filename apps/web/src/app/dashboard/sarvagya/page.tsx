'use client';

import { useState } from 'react';
import { api as trpc } from '@/lib/trpc/client';
import { CreditBadge } from '@/components/ai/sarvagya/CreditBadge';
import {
    Plus, Search, SearchCode, Database,
    MessageSquareShare, Clock, ArrowRight, Loader2,
    Sparkles, ChevronRight, Coins, Globe, FileText,
    PanelRightOpen, PanelRightClose, ExternalLink,
    RefreshCw,
    X,
    Brain
} from 'lucide-react';
import Link from 'next/link';

export default function SarvagyaDashboard() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);

    // Create Space State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState('');
    const [newSpaceDesc, setNewSpaceDesc] = useState('');

    // Fetch spaces using tRPC
    const utils = trpc.useUtils();
    const { data: spacesData, isLoading } = trpc.sarvagya.listSpaces.useQuery();
    const spaces = Array.isArray(spacesData) ? spacesData : [];

    // Create space mutation
    const createSpaceMutation = trpc.sarvagya.createSpace.useMutation({
        onSuccess: () => {
            utils.sarvagya.listSpaces.invalidate();
            setIsCreateModalOpen(false);
            setNewSpaceName('');
            setNewSpaceDesc('');
        }
    });

    const handleCreateSpace = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSpaceName.trim()) return;
        createSpaceMutation.mutate({
            name: newSpaceName.trim(),
            ...(newSpaceDesc.trim() ? { description: newSpaceDesc.trim() } : {})
        });
    };

    const filteredSpaces = searchQuery.trim()
        ? spaces.filter(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : spaces;

    const totalThreads = spaces.reduce((sum: number, s: any) => sum + (s.totalConversations || 0), 0);

    const capabilities = [
        {
            title: 'Deep Web Research',
            description: 'Search and synthesize information across the entire web with AI-powered analysis',
            icon: Globe,
            gradient: 'from-primary to-cyan-500'
        },
        {
            title: 'Document Intelligence',
            description: 'Upload PDFs, URLs, and files — ask questions grounded in your own sources',
            icon: FileText,
            gradient: 'from-green-500 to-emerald-500'
        },
        {
            title: 'Cited Answers',
            description: 'Every response comes with inline citations you can click to verify',
            icon: SearchCode,
            gradient: 'from-primary to-primary/80'
        },
    ];

    const statItems = [
        { label: 'Spaces', value: spaces.length, icon: Database, gradient: 'from-primary to-cyan-500' },
        { label: 'Threads', value: totalThreads, icon: MessageSquareShare, gradient: 'from-primary to-primary/80' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-primary/10 to-primary/15 dark:from-[var(--night-ink)] dark:via-[var(--indigo-deep)] dark:to-[var(--indigo-ink)]">
            <div className="container mx-auto px-4 py-4 max-w-6xl">

                {/* ── Header Card (matching TutorHeader pattern) ── */}
                <div className="mb-4 bg-white/90 backdrop-blur-md border-0 shadow-lg rounded-2xl overflow-hidden">
                    <div className="pb-4 pt-5 px-6 bg-gradient-to-r from-orange-500/5 to-primary/80 dark:from-orange-500/10 dark:to-primary/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-primary/80 flex items-center justify-center shadow-lg">
                                    <Brain className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-primary/80 bg-clip-text text-transparent">
                                        Sarvagya AI Search
                                    </h1>
                                    <p className="text-muted-foreground text-sm">
                                        Deep, context-aware research engine for education
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                {/* Credit Badge */}
                                <CreditBadge showAddButton={true} className="hidden sm:flex" />

                                {/* Stats Panel Toggle */}
                                <button
                                    onClick={() => setIsStatsPanelOpen(!isStatsPanelOpen)}
                                    className="p-2.5 bg-muted rounded-xl hover:bg-muted dark:hover:bg-muted transition-all duration-200 group"
                                    title={isStatsPanelOpen ? 'Close stats panel' : 'Open stats panel'}
                                >
                                    {isStatsPanelOpen
                                        ? <PanelRightClose className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        : <PanelRightOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Main Content Layout ── */}
                <div className="flex gap-4">
                    {/* ── Left: Main Content ── */}
                    <div className={`flex-1 min-w-0 space-y-6 transition-all duration-300 ease-in-out ${isStatsPanelOpen ? 'mr-0' : ''}`}>

                        {/* Search + New Space bar */}
                        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border-0 p-4 flex items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Find a search space..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-muted/40 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-medium text-sm"
                                />
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-primary/80 hover:from-orange-600 hover:to-primary/80 text-white rounded-xl font-bold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4" />
                                New Space
                            </button>
                        </div>

                        {/* Spaces Grid */}
                        <div>
                            <div className="flex items-center mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-primary/100 to-primary/80 rounded-xl flex items-center justify-center mr-3 shadow-md">
                                    <Database className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Your Search Spaces</h2>
                                    <p className="text-sm text-muted-foreground">Organize your research by topic</p>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center p-16 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border-0">
                                    <div className="text-center">
                                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                                        <p className="text-muted-foreground font-medium">Loading your spaces...</p>
                                    </div>
                                </div>
                            ) : filteredSpaces.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-16 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border-0 text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-5 shadow-lg">
                                        <SearchCode className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-3">No Search Spaces Yet</h3>
                                    <p className="text-muted-foreground max-w-md mb-6 leading-relaxed text-sm">
                                        Create a space to start organizing your web searches, uploaded documents, and deep research tasks.
                                    </p>
                                    <button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-primary/80 hover:from-orange-600 hover:to-primary/80 text-white rounded-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md shadow-primary/20 text-sm"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Create Your First Space
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {filteredSpaces.map((space) => (
                                        <Link
                                            href={`/dashboard/sarvagya/space/${space.id}`}
                                            key={space.id}
                                            className="relative p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] border-0 group overflow-hidden cursor-pointer"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                            <div className="relative z-10">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="w-11 h-11 bg-gradient-to-br from-primary/100 to-primary/80 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200">
                                                        <MessageSquareShare className="w-5 h-5 text-white" />
                                                    </div>

                                                    <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 bg-muted rounded-lg text-muted-foreground">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(space.updatedAt || space.createdAt || Date.now()).toLocaleDateString()}
                                                    </div>
                                                </div>

                                                <div className="mb-3">
                                                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full mb-1.5">
                                                        Research Space
                                                    </span>
                                                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                                        {space.name}
                                                    </h3>
                                                </div>

                                                {space.description && (
                                                    <p className="text-muted-foreground line-clamp-2 mb-3 leading-relaxed text-sm h-10">
                                                        {space.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between pt-3 border-t border-border">
                                                    <div className="text-xs text-muted-foreground font-medium">
                                                        0 threads
                                                    </div>
                                                    <div className="flex items-center text-xs font-medium text-muted-foreground group-hover:text-orange-500 transition-colors duration-300">
                                                        <span>Enter Space</span>
                                                        <ChevronRight className="h-3 w-3 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Research Capabilities (bottom) ── */}
                        <div className="pt-4">
                            <div className="flex items-center mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Research Capabilities</h2>
                                    <p className="text-sm text-muted-foreground">Powered by Surfsense AI engine</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {capabilities.map((cap, index) => (
                                    <div key={index} className="relative p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] border-0 group overflow-hidden">
                                        <div className={`absolute inset-0 bg-gradient-to-br ${cap.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                                        <div className="relative z-10">
                                            <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br ${cap.gradient} rounded-xl mb-4 shadow-md`}>
                                                <cap.icon className="h-6 w-6 text-white" />
                                            </div>
                                            <h3 className="text-lg font-bold text-foreground mb-1.5">{cap.title}</h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Collapsible Stats Sidebar ── */}
                    <div
                        className={`flex-shrink-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isStatsPanelOpen ? 'w-72 opacity-100' : 'w-0 opacity-0'
                            }`}
                    >
                        <div className="w-72 space-y-4">
                            {/* Stats Cards */}
                            {statItems.map((stat, index) => (
                                <div
                                    key={stat.label}
                                    className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border-0 p-5 transform transition-all duration-500 ease-out"
                                    style={{
                                        transitionDelay: isStatsPanelOpen ? `${index * 80}ms` : '0ms',
                                        transform: isStatsPanelOpen ? 'translateX(0)' : 'translateX(20px)',
                                        opacity: isStatsPanelOpen ? 1 : 0,
                                    }}
                                >
                                    <div className="flex items-center space-x-3 mb-3">
                                        <div className={`w-10 h-10 bg-gradient-to-r ${stat.gradient} rounded-xl flex items-center justify-center shadow-md`}>
                                            <stat.icon className="h-5 w-5 text-white" />
                                        </div>
                                        <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                                    </div>
                                    <p className="text-3xl font-bold bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                                        {stat.value}
                                    </p>
                                </div>
                            ))}

                            {/* Credits Card */}
                            <div
                                className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border-0 p-5 transform transition-all duration-500 ease-out"
                                style={{
                                    transitionDelay: isStatsPanelOpen ? `${statItems.length * 80}ms` : '0ms',
                                    transform: isStatsPanelOpen ? 'translateX(0)' : 'translateX(20px)',
                                    opacity: isStatsPanelOpen ? 1 : 0,
                                }}
                            >
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                                        <Coins className="h-5 w-5 text-white" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">Credits</span>
                                </div>
                                <CreditBadge showAddButton={false} className="border-0 bg-transparent p-0 text-lg" />
                            </div>

                            {/* Top Up Button */}
                            <div
                                className="transform transition-all duration-500 ease-out"
                                style={{
                                    transitionDelay: isStatsPanelOpen ? `${(statItems.length + 1) * 80}ms` : '0ms',
                                    transform: isStatsPanelOpen ? 'translateX(0)' : 'translateX(20px)',
                                    opacity: isStatsPanelOpen ? 1 : 0,
                                }}
                            >
                                <Link
                                    href="/dashboard/sarvagya/store"
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-orange-500 to-primary/80 hover:from-orange-600 hover:to-primary/80 text-white rounded-xl font-bold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                >
                                    <Plus className="w-4 h-4" />
                                    Top Up Credits
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Create Space Modal ── */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setIsCreateModalOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-primary/80 rounded-xl flex items-center justify-center shadow-md">
                                <Brain className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Create New Space</h2>
                                <p className="text-sm text-muted-foreground">Initialize a new research environment</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateSpace} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Space Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newSpaceName}
                                    onChange={(e) => setNewSpaceName(e.target.value)}
                                    placeholder="e.g. Quantum Physics Research"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={newSpaceDesc}
                                    onChange={(e) => setNewSpaceDesc(e.target.value)}
                                    placeholder="What is this space for?"
                                    rows={3}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none text-foreground"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted dark:hover:bg-muted text-foreground rounded-xl font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createSpaceMutation.isPending || !newSpaceName.trim()}
                                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-primary/80 hover:from-orange-600 hover:to-primary/80 text-white rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center"
                                >
                                    {createSpaceMutation.isPending ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Create Space'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
