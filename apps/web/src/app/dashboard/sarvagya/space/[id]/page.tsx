'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api as trpc } from '@/lib/trpc/client';
import { CreditBadge } from '@/components/ai/sarvagya/CreditBadge';
import {
    ArrowLeft, Send, Loader2, Bot, User, ShieldAlert,
    Settings, Link as LinkIcon, FileText, CheckCircle, Globe, Headphones, PlayCircle, LibraryBig, BookOpen, Sparkles, GraduationCap, Search
} from 'lucide-react';
import Link from 'next/link';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    sources?: Array<{
        title: string;
        url?: string;
        content_snippet: string;
        relevance_score: number;
    }>;
    tokens?: number;
}

import { DocumentUploader } from '@/components/ai/sarvagya/DocumentUploader';

export default function SpaceChatPage() {
    const params = useParams();
    const router = useRouter();
    const spaceId = params.id as string;

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [useWebSearch, setUseWebSearch] = useState(false);
    const [showSources, setShowSources] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch space details
    const { data: spacesData, isLoading: isLoadingSpaces } = trpc.sarvagya.listSpaces.useQuery();
    const spaces = Array.isArray(spacesData) ? spacesData : [];
    const space = spaces.find(s => s.id === spaceId);

    // Audio Generation State
    const [audioJobId, setAudioJobId] = useState<string | null>(null);
    const audioMutation = trpc.sarvagya.generateAudioOverview.useMutation({
        onSuccess: (data) => setAudioJobId(data.jobId || null),
        onError: (err) => alert(`Failed to request audio: ${err.message}`)
    });

    const { data: audioStatus } = trpc.sarvagya.getAudioOverviewStatus.useQuery(
        { jobId: audioJobId! },
        {
            enabled: !!audioJobId,
            refetchInterval: (query) => (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') ? false : 3000
        }
    );

    // Fetch documents for space
    const { data: documentsData, refetch: refetchDocuments } = trpc.sarvagya.listDocuments.useQuery(
        { spaceId },
        { refetchInterval: 3000 } // Poll every 3s to track processing status
    );
    const documents = documentsData || [];

    // Mutations
    const queryMutation = trpc.sarvagya.query.useMutation({
        onSuccess: (data) => {
            const assistantMessage: Message = {
                id: `ast-${Date.now()}`,
                role: 'assistant',
                content: data.answer || data.content || '',
                sources: data.citations,
                tokens: 0
            };
            setMessages(prev => [...prev, assistantMessage]);
        },
        onError: (error) => {
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'system',
                content: `Error: ${error.message}`
            }]);
        }
    });

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || queryMutation.isPending) return;

        const userMessage: Message = {
            id: `usr-${Date.now()}`,
            role: 'user',
            content: input.trim()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');

        // Send to tRPC
        // Convert current messages to required format for history
        const chatHistory = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }));

        queryMutation.mutate({
            spaceId: spaceId,
            message: userMessage.content,
            useWebSearch: useWebSearch,
        });
    };

    if (isLoadingSpaces) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!space && !isLoadingSpaces) {
        return (
            <div className="flex h-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-center px-4">
                <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold mb-2">Space Not Found</h2>
                <p className="text-slate-500 mb-6">The search space you are looking for does not exist or you don't have access.</p>
                <button onClick={() => router.push('/dashboard/sarvagya')} className="text-blue-600 hover:underline">
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-3rem)] bg-slate-50 dark:bg-slate-950 rounded-xl border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex-none bg-white dark:bg-slate-900 border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/sarvagya"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                            {space?.name || 'Loading Space...'}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {messages.filter(m => m.role === 'user').length} queries • {space?.description || 'No description'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <CreditBadge />

                    {/* Audio Overview Player / Generator */}
                    {audioStatus?.url ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <Headphones className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <audio src={audioStatus.url} controls className="h-6 w-48" />
                        </div>
                    ) : audioStatus?.status === 'active' || audioStatus?.status === 'waiting' ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating Audio...
                        </div>
                    ) : (
                        <button
                            onClick={() => audioMutation.mutate({ spaceId })}
                            disabled={audioMutation.isPending || documents.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                        >
                            {audioMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4 text-indigo-500" />}
                            Audio Overview
                        </button>
                    )}

                    <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowSources(!showSources)}
                        className={`flex items-center gap-2 px-4 py-2 border shadow-sm rounded-lg text-sm font-medium transition-colors ${showSources ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <LibraryBig className={`w-4 h-4 ${showSources ? 'text-blue-500' : 'text-emerald-500'}`} />
                        Study Library ({documents.length})
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Main Chat Area Column */}
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/50">
                        {messages.length === 0 ? (
                            <div className="flex h-full items-center justify-center py-12">
                                <div className="max-w-3xl w-full mx-auto px-4">
                                    <div className="text-center mb-10">
                                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20 text-white">
                                            <GraduationCap className="w-8 h-8" />
                                        </div>
                                        <h2 className="text-3xl font-bold mb-3 text-slate-800 dark:text-slate-100">Welcome to your Study Space</h2>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-lg">
                                            I am Sarvagya, your personal AI tutor. Add your study materials to the library and let's start learning together.
                                        </p>
                                    </div>

                                    <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg flex items-center justify-center mb-3">
                                                <LibraryBig className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">1. Upload Materials</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Add your PDFs, notes, or web links to the Study Library to give me context.</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center mb-3">
                                                <Search className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">2. Deep Dive</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Ask complex questions. I'll read through your library and provide cited answers.</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center mb-3">
                                                <Headphones className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">3. Audio Lessons</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Generate a custom podcast overview from your documents to listen on the go.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`flex-none w-8 h-8 rounded-full flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-700' :
                                            msg.role === 'assistant' ? 'bg-blue-600 text-white' : 'bg-red-100 text-red-600'
                                            }`}>
                                            {msg.role === 'user' ? <User className="w-5 h-5" /> :
                                                msg.role === 'assistant' ? <Bot className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                                        </div>

                                        <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`px-5 py-3.5 rounded-2xl ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-tr-sm'
                                                : msg.role === 'assistant'
                                                    ? 'bg-white dark:bg-slate-900 border shadow-sm rounded-tl-sm'
                                                    : 'bg-red-50 text-red-700 border border-red-200 mt-2'
                                                }`}>
                                                <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 break-words whitespace-pre-wrap">
                                                    {msg.content}
                                                </div>
                                            </div>

                                            {/* Sources Widget */}
                                            {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                                                <div className="mt-2 w-full max-w-full overflow-x-auto pb-2">
                                                    <div className="flex gap-2">
                                                        {msg.sources.map((source, i) => (
                                                            <div key={i} className="flex-none max-w-[250px] bg-white dark:bg-slate-900 border rounded-lg p-3 shadow-sm text-xs group cursor-default hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                                                <div className="font-semibold text-slate-700 dark:text-slate-300 truncate mb-1.5 flex items-center gap-2">
                                                                    {source.url ? <LinkIcon className="w-3.5 h-3.5 text-blue-500 flex-none" /> : <FileText className="w-3.5 h-3.5 text-emerald-500 flex-none" />}
                                                                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">{source.title}</a>
                                                                </div>
                                                                <div className="text-slate-500 dark:text-slate-400 line-clamp-3 text-[11px] leading-relaxed">
                                                                    {source.content_snippet}
                                                                </div>
                                                                {source.relevance_score && (
                                                                    <div className="mt-2 text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full w-fit flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/50">
                                                                        <CheckCircle className="w-3 h-3" />
                                                                        {Math.round(source.relevance_score * 100)}% match
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {queryMutation.isPending && (
                                    <div className="flex gap-4">
                                        <div className="flex-none w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mt-1">
                                            <Bot className="w-5 h-5" />
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                            <span className="text-sm text-slate-500">Researching via Sarvagya AI{useWebSearch ? ' & Web Search' : ''}...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="flex-none bg-white dark:bg-slate-900 border-t p-4 sm:px-6">
                        <div className="max-w-4xl mx-auto relative">
                            <form onSubmit={handleSubmit} className="relative flex flex-col gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl p-2 shadow-sm border focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                    placeholder="Ask anything about this space..."
                                    className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2 px-3 text-sm"
                                    rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
                                    disabled={queryMutation.isPending}
                                />
                                <div className="flex items-center justify-between px-2 pb-1">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setUseWebSearch(!useWebSearch)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${useWebSearch ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                                        >
                                            <Globe className={`w-3.5 h-3.5 ${useWebSearch ? 'text-blue-500' : ''}`} />
                                            {useWebSearch ? 'Web Search On' : 'Web Search'}
                                        </button>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || queryMutation.isPending}
                                        className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white flex items-center justify-center transition-colors shadow-sm"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </form>
                            <div className="text-center mt-2 pb-1">
                                <span className="text-[10px] text-slate-400">Powered by Sarvagya AI — Costs 1 Research Credit per query</span>
                            </div>
                        </div>
                    </div>
                </div> {/* End Main Chat Area Column */}

                {/* Right Sidebar: Sources */}
                {showSources && (
                    <div className="w-80 flex-none bg-white dark:bg-slate-900 border-l flex flex-col hidden md:flex relative z-10 transition-all shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
                        <div className="p-4 border-b flex-none bg-slate-50 dark:bg-slate-800/50">
                            <h2 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <LibraryBig className="w-4 h-4 text-emerald-500" />
                                Study Library
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Upload documents or link websites to build your knowledge base.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                            <DocumentUploader spaceId={spaceId} onUploadStarted={() => refetchDocuments()} />

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Processed Sources ({documents.length})</h3>
                                    <button onClick={() => refetchDocuments()} className="text-[10px] text-blue-600 hover:underline">Refresh</button>
                                </div>
                                {documents.length === 0 ? (
                                    <div className="text-sm text-slate-500 text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed">
                                        No sources added yet.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {documents.map(doc => {
                                            const fileType = doc.fileType || '';
                                            const size = doc.size || 0;
                                            return (
                                                <div key={doc.id} className="bg-white dark:bg-slate-900 border rounded-lg p-3 shadow-sm text-sm flex items-start gap-3">
                                                    <div className={`mt-0.5 rounded flex items-center justify-center ${fileType.includes('pdf') || fileType.includes('text') ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {fileType.includes('pdf') || fileType.includes('text') ? <FileText className="w-4 h-4 m-1.5" /> : <LinkIcon className="w-4 h-4 m-1.5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {doc.status === 'pending' && <span className="flex items-center gap-1.5 text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full"><Loader2 className="w-3 h-3 animate-spin" /> Processing...</span>}
                                                            {doc.status === 'processed' && <span className="flex items-center gap-1.5 text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Active</span>}
                                                            {doc.status === 'failed' && <span className="flex items-center gap-1.5 text-[10px] bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full"><ShieldAlert className="w-3 h-3" /> Failed</span>}

                                                            {size > 0 && <span className="text-[10px] text-slate-400">{(size / 1024).toFixed(0)} KB</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
