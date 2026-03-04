'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Input } from '@/components/core/ui/input'
import { Badge } from '@/components/core/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/core/ui/dialog'
import FormattedContent from '@/components/ai/core/FormattedContent'
import LessonPlanContainer from '@/components/learning/lesson/LessonPlanContainer'
import { FeedbackWidget } from '@/components/user/profile/feedback/FeedbackWidget'
import AnswerActionButtons from '@/components/ai/core/AnswerActionButtons'
import {
  Brain,
  Upload,
  X,
  User,
  Bot,
  Settings,
  BookOpen,
  FileText,
  Loader2,
  CheckCircle,
  Zap,
  Lock,
  Sparkles,
  ArrowRight,
  History,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MultiModalInput } from '@/components/ai/tutor/MultiModalInput'
import { ChatHistoryPanel } from '@/components/ai/tutor/ChatHistoryPanel'
import { StreamingChatMessage } from '@/components/ai/chat/StreamingChatMessage'
import { ChatErrorBoundary } from '@/components/core/common/ChatErrorBoundary'
import { useAiTutor } from './_hooks/useAiTutor'
import type { Message } from './_types'

export default function AITutorPage() {
  const {
    messages, setMessages,
    input, setInput,
    isLoading, setIsLoading,
    selectedSubject, setSelectedSubject,
    uploadedFile, setUploadedFile,
    showFormattingMetadata, setShowFormattingMetadata,
    fileContent, setFileContent,
    isProcessingFile, setIsProcessingFile,
    voiceCommand, setVoiceCommand,
    sessionId,
    agentStreamState, sendMessage, resetStream,
    conversationState, setConversationState,
    connectionStatus, setConnectionStatus,
    lastHealthCheck, setLastHealthCheck,
    isHistoryPanelOpen, setIsHistoryPanelOpen,
    systemHealth, setSystemHealth,
    performanceMetrics, setPerformanceMetrics,
    showUpgradeModal, setShowUpgradeModal,
    upgradeModalData, setUpgradeModalData,
    handleMultiModalSubmit,
    handleSendMessage,
    getIntentFromVoiceCommand,
    generateSystemPrompt,
    handleKeyPress,
    handleFileUpload,
    removeUploadedFile,
    cancelMessage,
    handleQuickReply,
    handleRoleSelection,
    handleBoardSelection,
    handleClassSelection,
    handleSubjectSelection,
    handleMenuSelection,
    getMenuItemById,
    generateContextOptions,
    shouldShowContextSelector,
    getCurrentContextValue,
    handleContextChange,
    handleUpgradeClick,
    getQuickReplyDescription,
    getPlaceholderText,
    resetConversation,
    user,
    subscriptionData,
    isLoadingSubscription,
    subscriptionError,
    userClass,
    hasAllSubjects,
    purchasedSubjects,
    refetch,
    userMedium,
    userStream,
    availableSubjects,
    renderIcon,
    generateMenuQuickReplies,
    getBoardDisplayName,
    renderMenuActionCards,
    messagesEndRef,
    abortControllerRef
  } = useAiTutor();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        {/* Header */}
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
                    Your intelligent educational companion with curriculum-aligned content
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
                  onClick={() => setIsHistoryPanelOpen(true)}
                  className="text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                  title="View chat history"
                >
                  <History className="h-3 w-3 mr-1" />
                  History
                </Button>

                {/* Reset Conversation Button */}
                {conversationState.phase === 'chatting' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetConversation}
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

        {/* Subscription Loading/Error Display */}
        {isLoadingSubscription && (
          <Card className="mb-3 bg-blue-50/90 dark:bg-blue-900/20 backdrop-blur-md border-blue-200 dark:border-blue-800 shadow-lg rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
                <span className="text-blue-800 dark:text-blue-200 text-sm">Loading subscription details...</span>
              </div>
            </CardContent>
          </Card>
        )}



        {subscriptionError && subscriptionError !== 'NO_SUBSCRIPTION' && (
          <Card className="mb-3 bg-red-50/90 dark:bg-red-900/20 backdrop-blur-md border-red-200 dark:border-red-800 shadow-lg rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-200">Error Loading Subscription</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">Please refresh the page or contact support if the issue persists.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat Interface */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {/* Messages Area */}
            <div className="h-[calc(100vh-280px)] min-h-[400px] max-h-[600px] overflow-y-auto overflow-x-hidden p-6 space-y-6 bg-gradient-to-b from-gray-50/30 to-white/50 dark:from-gray-800/30 dark:to-gray-900/50">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-[90%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md ${message.role === 'user'
                        ? 'bg-gradient-to-r from-orange-500 to-blue-600'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        }`}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4 text-white" />
                        ) : (
                          <Bot className="h-4 w-4 text-white" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`rounded-2xl px-4 py-3 shadow-sm backdrop-blur-sm overflow-hidden ${message.role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-2'
                        : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 mr-2'
                        }`}>
                        <div className="flex-1">
                          {message.role === 'assistant' ? (
                            <div>
                              {message.isAgentResponse ? (
                                // Agent responses are already well-formatted, display directly
                                <div className="prose prose-sm max-w-none">
                                  <div className="whitespace-pre-wrap">{message.content}</div>
                                  {message.agentType && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center">
                                      <Bot className="h-3 w-3 mr-1" />
                                      Agent System Response: {message.agentType} with cultural context
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {/* Auto-detect teacher lesson plans and switch renderer; else fall back to FormattedContent */}
                                  {(() => {
                                    const role = conversationState.selectedRole || 'student'
                                    const isTeacher = role === 'teacher'
                                    const looksLikeLessonPlan = /lesson\s*plan/i.test(message.content) ||
                                      /(objectives|learning objectives|key points|activities|assessment)/i.test(message.content)
                                    if (isTeacher && looksLikeLessonPlan) {
                                      return <LessonPlanContainer markdown={message.content} />
                                    }
                                    return (
                                      <FormattedContent
                                        content={message.content}
                                        options={{
                                          classLevel: conversationState.context.classLevel || undefined,
                                          subject: conversationState.selectedSubject || selectedSubject || 'general',
                                          userRole: conversationState.selectedRole || 'student',
                                          enableAdvancedFormatting: true,
                                          enableAccessibilityFeatures: true,
                                          enableDiagramGeneration: true
                                        }}
                                        showMetadata={showFormattingMetadata}
                                        enableInteractiveFeatures={typeof window !== 'undefined'
                                          ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                                          : process.env.NODE_ENV === 'development'}
                                        className="text-sm"
                                      />
                                    )
                                  })()}
                                </>
                              )}

                              {/* Source Citations - Compact Display (Max 20 words) */}
                              {message.sources && message.sources.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    <span className="font-medium">Sources:</span>
                                    <span>
                                      {message.sources.slice(0, 3).map((source, index) => (
                                        <span key={source.id}>
                                          {index > 0 && ', '}
                                          {source.title}
                                        </span>
                                      ))}
                                      {message.sources.length > 3 && ` +${message.sources.length - 3} more`}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Visualizations - REMOVED: Now on-demand only via AnswerActionButtons */}
                              {/* Visual aids are generated and displayed ONLY when user clicks the "Toggle Visual Aid" button */}

                              {/* REMOVED: Enhanced Key Terms component - using markdown Key Terms section instead */}

                              {/* REMOVED: Detailed sources section - too long and annoying for users */}
                              {false && message.sources && message.sources.length > 0 && (
                                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center">
                                      <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sources & References</h4>
                                    </div>
                                    {message.metadata && (
                                      <Badge variant="outline" className="text-xs">
                                        {message.metadata.total_results} sources • {message.metadata.confidence} confidence
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="space-y-3 overflow-hidden">
                                    {message.sources.map((source, index) => (
                                      <div key={source.id} className={`p-3 rounded-lg border transition-colors hover:border-blue-300 overflow-hidden ${source.display_format === 'student_friendly' ? 'bg-blue-50/90 border-blue-200' :
                                        source.display_format === 'academic' ? 'bg-green-50/90 border-green-200' :
                                          source.display_format === 'accessible' ? 'bg-purple-50/90 border-purple-200' :
                                            'bg-white border-gray-200'
                                        }`}>
                                        <div className="flex items-start gap-2">
                                          <Badge className="shrink-0 mt-0.5 text-xs">{index + 1}</Badge>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{source.title}</h5>
                                              {source.trust_indicator && (
                                                <span className="text-base" title={source.trust_indicator.description}>
                                                  {source.trust_indicator.visual}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                              <span className="font-medium">{source.chapter}</span>
                                              {source.page !== 'Unknown Page' && (
                                                <span> • Page {source.page}</span>
                                              )}
                                              <span> • {source.subject} {source.class}</span>
                                            </p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 italic line-clamp-2 break-words overflow-hidden">
                                              "{source.content_preview}"
                                            </p>

                                            {/* Role-specific explanation */}
                                            {source.role_explanation && (
                                              <div className="mt-2 p-2 bg-white/60 dark:bg-gray-700/60 rounded text-gray-700 dark:text-gray-300">
                                                <div className="font-medium text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                  {source.display_format === 'student_friendly' ? '📚 For Students:' :
                                                    source.display_format === 'academic' ? '👩‍🏫 For Teachers:' :
                                                      '👨‍👩‍👧‍👦 For Parents:'}
                                                </div>
                                                <div className="text-xs">{source.role_explanation}</div>
                                              </div>
                                            )}

                                            {/* Trust indicator explanation */}
                                            {source.trust_indicator && (
                                              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                                <span className="font-medium">Reliability:</span> {source.trust_indicator.userFriendlyExplanation}
                                              </div>
                                            )}

                                            {/* Language adaptation */}
                                            {source.language_adaptation?.hindiTranslation && (
                                              <div className="mt-2 p-2 bg-orange-50/60 dark:bg-orange-900/20 rounded">
                                                <div className="font-medium text-xs text-orange-700 dark:text-orange-400 mb-1">🇮🇳 हिंदी में:</div>
                                                <div className="text-xs text-orange-800 dark:text-orange-300">{source.language_adaptation.hindiTranslation}</div>
                                                {source.language_adaptation.culturalContext && (
                                                  <div className="text-xs text-orange-700 dark:text-orange-400 mt-1 italic">
                                                    {source.language_adaptation.culturalContext}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-2">
                                              <Badge
                                                variant={source.confidence > 0.8 ? "default" : "secondary"}
                                                className="text-xs"
                                              >
                                                {Math.round(source.confidence * 100)}%
                                              </Badge>
                                              {source.citation_validated !== undefined && (
                                                <Badge
                                                  variant={source.citation_validated ? "default" : "destructive"}
                                                  className="text-xs"
                                                >
                                                  {source.citation_validated ? "✓ Verified" : "⚠ Check"}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {message.metadata && message.metadata.search_time && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Search completed in {message.metadata.search_time}ms using {message.metadata.search_strategies?.join(', ') || 'enhanced search'}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Quick Replies */}
                              {message.quickReplies && message.quickReplies.length > 0 && (
                                <div className="mt-4">
                                  {/* 🚀 PRIORITY 4: Visual Menu Action Cards for menu_selection */}
                                  {message.id === 'menu_selection' && conversationState.selectedRole ? (
                                    renderMenuActionCards(conversationState.selectedRole)
                                  ) : (
                                    <>
                                      {message.messageType === 'options' && (
                                        <div className={`grid gap-3 ${message.quickReplies.length <= 3
                                          ? 'grid-cols-1 sm:grid-cols-3' // Single row for role/board selection (3 buttons)
                                          : message.quickReplies.length === 12
                                            ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' // 6×2 grid for class selection (12 buttons)
                                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' // Default grid layout
                                          }`}>
                                          {message.quickReplies.map((quickReply) => (
                                            <Button
                                              key={quickReply.id}
                                              variant="outline"
                                              size="lg"
                                              onClick={() => handleQuickReply(quickReply)}
                                              className={`group relative h-auto w-full mx-auto transition-all duration-300 shadow-sm hover:shadow-lg
                                            bg-white/90 backdrop-blur-sm border-2 border-orange-200/60
                                            hover:border-blue-400/80 text-gray-700 hover:text-blue-800
                                            rounded-xl hover:rounded-2xl transform hover:scale-[1.02]
                                            hover:bg-gradient-to-r hover:from-orange-50/80 hover:to-blue-50/80
                                            active:scale-[0.98] active:shadow-sm
                                            focus:ring-2 focus:ring-blue-500/20 focus:outline-none ${message.quickReplies.length === 12
                                                  ? 'min-h-[44px] p-2 text-xs' // Compact size for class selection (6×2 grid)
                                                  : 'min-h-[36px] max-w-[200px] p-3' // Standard size for role/board selection
                                                }`}
                                              disabled={isLoading}
                                            >
                                              {message.quickReplies.length === 12 ? (
                                                // Simplified layout for class selection (6×2 grid)
                                                <div className="flex items-center justify-center w-full">
                                                  <div className="font-semibold text-center leading-tight dark:text-gray-100">
                                                    {quickReply.text}
                                                  </div>
                                                </div>
                                              ) : (
                                                // Standard layout for role/board selection
                                                <div className="flex items-center justify-start w-full space-x-3">
                                                  {quickReply.icon && (
                                                    <div className="flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                                                      {renderIcon(quickReply.icon, "h-5 w-5")}
                                                    </div>
                                                  )}
                                                  <div className="text-left flex-1 min-w-0">
                                                    <div className="font-semibold text-sm leading-tight truncate dark:text-gray-100">
                                                      {quickReply.text}
                                                    </div>
                                                    {getQuickReplyDescription(quickReply.id) && (
                                                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 opacity-80 leading-tight line-clamp-2">
                                                        {getQuickReplyDescription(quickReply.id)}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </Button>
                                          ))}
                                        </div>
                                      )}

                                      {message.messageType !== 'options' && (
                                        <div className="flex flex-wrap gap-2">
                                          {message.quickReplies.map((quickReply) => (
                                            <Button
                                              key={quickReply.id}
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleQuickReply(quickReply)}
                                              className="group min-h-[32px] px-2 py-1.5
                                            bg-white/90 backdrop-blur-sm border border-orange-200/60
                                            hover:border-blue-400/80 text-gray-700 hover:text-blue-800
                                            transition-all duration-200 shadow-sm hover:shadow-md
                                            rounded-xl hover:rounded-2xl transform hover:scale-105
                                            hover:bg-gradient-to-r hover:from-orange-50/60 hover:to-blue-50/60
                                            active:scale-95 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                              disabled={isLoading}
                                            >
                                              {quickReply.icon && (
                                                <div className="mr-2 group-hover:scale-110 transition-transform duration-200">
                                                  {renderIcon(quickReply.icon, "h-4 w-4")}
                                                </div>
                                              )}
                                              <span className="text-sm font-medium">{quickReply.text}</span>
                                            </Button>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Feedback Widget - Show for all AI-generated educational answers (including specialized agents) */}
                              {message.role === 'assistant' &&
                                message.content &&
                                !message.isAgentResponse &&
                                !message.quickReplies &&
                                conversationState.phase === 'chatting' &&
                                // Exclude system/greeting messages by ID
                                message.id !== 'initial_greeting' &&
                                message.id !== 'board_selection' &&
                                message.id !== 'class_selection' &&
                                !message.id.startsWith('subject_selection') &&
                                message.id !== 'menu_selection' &&
                                message.id !== 'confirmation' && !message.id.startsWith('confirmation-') &&
                                message.id !== 'ready_to_chat' &&
                                // Exclude messages with messageType 'options' or 'confirmation'
                                message.messageType !== 'options' &&
                                message.messageType !== 'confirmation' &&
                                message.messageType !== 'error' && (
                                  // ✅ REMOVED: Sources requirement to enable feedback for all specialized agents
                                  // Old condition: message.sources && message.sources.length > 0
                                  <div className="mt-3">
                                    <FeedbackWidget
                                      questionText={(() => {
                                        // Find the previous user message
                                        const messageIndex = messages.findIndex(m => m.id === message.id)
                                        if (messageIndex > 0) {
                                          for (let i = messageIndex - 1; i >= 0; i--) {
                                            if (messages[i].role === 'user') {
                                              return messages[i].content
                                            }
                                          }
                                        }
                                        return 'Question not found'
                                      })()}
                                      answerText={message.content}
                                      board={(() => {
                                        // FIX 1 (P0): Convert board from lowercase to uppercase to match API schema
                                        const board = conversationState.selectedBoard || 'cbse'
                                        return board.toUpperCase().replace(/-/g, '_') as 'CBSE' | 'ICSE' | 'STATE_BOARD'
                                      })()}
                                      classLevel={(() => {
                                        // FIX 2 (P0): Parse class level string to number (1-12)
                                        const classStr = conversationState.context.classLevel || conversationState.selectedClass || '10'
                                        const classNum = parseInt(classStr.replace(/\D/g, ''), 10)
                                        return isNaN(classNum) ? 10 : classNum
                                      })()}
                                      subject={conversationState.selectedSubject || selectedSubject || 'General'}
                                      answerId={message.id}
                                      responseTimeMs={message.performanceMetrics?.responseTimeMs}
                                      cacheHit={message.performanceMetrics?.cacheHit}
                                      cacheType={message.performanceMetrics?.cacheType}
                                      routeType={message.performanceMetrics?.routeType}
                                      complexity={message.performanceMetrics?.complexity}
                                      intentType={message.performanceMetrics?.intentType}
                                      faithfulnessScore={message.performanceMetrics?.faithfulnessScore}
                                      relevanceScore={message.performanceMetrics?.relevanceScore}
                                      contextPrecisionScore={message.performanceMetrics?.contextPrecisionScore}
                                      contextRecallScore={message.performanceMetrics?.contextRecallScore}
                                      sessionId={message.id.split('_')[0]}
                                    />
                                  </div>
                                )}

                              {/* Answer Action Buttons - Show ONLY for genuine AI-generated educational answers */}
                              {message.role === 'assistant' &&
                                message.content &&
                                !message.isAgentResponse &&
                                !message.quickReplies &&
                                conversationState.phase === 'chatting' &&
                                // Exclude system/greeting messages by ID
                                message.id !== 'initial_greeting' &&
                                message.id !== 'board_selection' &&
                                message.id !== 'class_selection' &&
                                !message.id.startsWith('subject_selection') &&
                                message.id !== 'menu_selection' &&
                                message.id !== 'confirmation' && !message.id.startsWith('confirmation-') &&
                                message.id !== 'ready_to_chat' &&
                                // Exclude messages with messageType 'options' or 'confirmation'
                                message.messageType !== 'options' &&
                                message.messageType !== 'confirmation' &&
                                message.messageType !== 'error' && (
                                  <AnswerActionButtons
                                    answer={message.content}
                                    query={messages.find(m => m.role === 'user' && m.timestamp < message.timestamp)?.content || ''}
                                    currentMedium={userMedium || 'ENGLISH'}
                                    subject={conversationState.selectedSubject || selectedSubject || 'general'}
                                    classLevel={conversationState.context.classLevel || `Class ${userClass}` || 'Class 10'}
                                    onVisualizationGenerated={(viz) => {
                                      // Add new visualization to the message
                                      setMessages(prev => prev.map(msg =>
                                        msg.id === message.id
                                          ? { ...msg, visualizations: [...(msg.visualizations || []), viz] }
                                          : msg
                                      ))
                                    }}
                                    onButtonUsage={(buttonType, metadata) => {
                                      // Track button usage for analytics (fire and forget)
                                      console.log(`📊 [Button Usage] ${buttonType}:`, metadata)

                                      // Save to chat history with metadata
                                      if (user?.id) {
                                        fetch('/api/ai/chat/history/save', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            userId: user.id,
                                            role: conversationState.selectedRole || 'student',
                                            intent: conversationState.context.menuIntent || 'general_help',
                                            topic: `Button Action: ${buttonType}`,
                                            subject: conversationState.selectedSubject || selectedSubject,
                                            classLevel: conversationState.context.classLevel,
                                            sessionId: sessionId,
                                            metadata: {
                                              board: conversationState.selectedBoard,
                                              buttonType,
                                              buttonMetadata: metadata,
                                              answerId: message.id
                                            },
                                            userMessage: `[Button: ${buttonType}] ${metadata?.query || ''}`,
                                            assistantMessage: `Button action tracked: ${buttonType}`,
                                            assistantMetadata: {
                                              buttonType,
                                              agentType: 'button_action'
                                            }
                                          })
                                        }).catch(err => {
                                          console.warn('⚠️ [Button Usage] Failed to save (non-critical):', err)
                                        })
                                      }
                                    }}
                                  />
                                )}
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Active Stream / Loading Indicator */}
              <ChatErrorBoundary onReset={cancelMessage}>
                {(agentStreamState.status !== 'idle' && agentStreamState.status !== 'complete') ? (
                  <div className="flex justify-start my-4">
                    <StreamingChatMessage
                      streamState={agentStreamState}
                      studentName={conversationState.context.userName}
                    />
                    {agentStreamState.status === 'connecting' && (
                      <div className="ml-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            cancelMessage(); // Custom cleanup
                            resetStream();
                          }}
                          className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : isLoading ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3 mr-3">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-600 dark:text-gray-300" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">Thinking...</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelMessage}
                            className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </ChatErrorBoundary>

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-orange-50/20 to-blue-50/20 dark:from-gray-800/20 dark:to-gray-900/20 p-4">
              {/* File Upload Display */}
              {uploadedFile && (
                <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 border border-orange-200/30 dark:border-orange-700/30 rounded-xl flex items-center justify-between backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{uploadedFile.name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      ({(uploadedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeUploadedFile}
                    className="h-6 w-6 p-0 text-orange-600 dark:text-orange-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* 🚀 PRIORITY 2: Advanced Context Selector with Upgrade CTAs */}
              {shouldShowContextSelector() && (
                <div className="mb-3">
                  <div className="flex items-center space-x-2">
                    <Select
                      value={getCurrentContextValue()}
                      onValueChange={handleContextChange}
                    >
                      <SelectTrigger className="w-56 h-11 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-2 border-orange-200/60 dark:border-orange-700/60 hover:border-blue-400/80 dark:hover:border-blue-500/80 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 focus:ring-2 focus:ring-blue-500/20">
                        <SelectValue placeholder="Select board & class" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-2 border-orange-200/60 dark:border-orange-700/60 rounded-xl shadow-lg max-h-[400px]">
                        {/* Unlocked Options Section */}
                        {generateContextOptions().filter(opt => !opt.isLocked).length > 0 && (
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Your Access
                          </div>
                        )}
                        {generateContextOptions().filter(opt => !opt.isLocked).map(option => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="cursor-pointer hover:bg-gradient-to-r hover:from-orange-50/60 hover:to-blue-50/60 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20 rounded-lg transition-colors duration-150 my-0.5"
                          >
                            <span className="font-medium text-gray-800 dark:text-gray-200">{option.label}</span>
                          </SelectItem>
                        ))}

                        {/* Locked Options Section - Upgrade CTA */}
                        {generateContextOptions().filter(opt => opt.isLocked).length > 0 && (
                          <>
                            <div className="px-2 py-1.5 mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide flex items-center">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Upgrade to Unlock
                            </div>
                            {generateContextOptions().filter(opt => opt.isLocked).slice(0, 8).map(option => (
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
                            {generateContextOptions().filter(opt => opt.isLocked).length > 8 && (
                              <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 text-center italic">
                                +{generateContextOptions().filter(opt => opt.isLocked).length - 8} more options available
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
              )}

              {/* Multi-Modal Input Component */}
              <MultiModalInput
                value={input}
                onChange={setInput}
                onSubmit={handleMultiModalSubmit}
                disabled={isLoading || conversationState.phase !== 'chatting'}
                placeholder={getPlaceholderText()}
                context={{
                  hasUploadedFile: !!uploadedFile,
                  currentTopic: selectedSubject,
                  classLevel: conversationState.selectedClass,
                  subject: conversationState.selectedSubject || selectedSubject
                }}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🚀 Upgrade Modal - ChatGPT-style monetization */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
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
              Upgrade to {upgradeModalData?.requiredPlan} Plan
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600 dark:text-gray-400 mt-2">
              Unlock access to <span className="font-semibold text-gray-800 dark:text-gray-200">{upgradeModalData?.selectedBoard} {upgradeModalData?.selectedClass}</span> and more!
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
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">You're trying to access:</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{upgradeModalData?.selectedBoard} {upgradeModalData?.selectedClass}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Plan Benefits */}
            <div className="bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 border-2 border-orange-200/40 dark:border-orange-700/40 rounded-xl p-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                <Sparkles className="h-4 w-4 mr-2 text-orange-600 dark:text-orange-400" />
                {upgradeModalData?.requiredPlan} Plan Benefits:
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {upgradeModalData?.requiredPlan === 'Pro' ? (
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
                  {upgradeModalData?.requiredPlanPrice}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cancel anytime • No hidden fees</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="w-full sm:w-auto border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 dark:text-gray-200"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleUpgradeClick}
              className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Upgrade Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat History Panel */}
      <ChatHistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        onLoadConversation={async (conversationId) => {
          console.log('🔄 Loading conversation:', conversationId)

          // Don't close panel immediately - let the async operation complete
          setIsLoading(true)

          try {
            // Fetch messages for the conversation
            const response = await fetch('/api/ai/chat/history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId })
            })

            const data = await response.json()
            console.log('📥 API Response:', data)

            if (!response.ok) {
              console.error('API error:', data)
              throw new Error(data.error || data.message || 'Failed to load conversation')
            }

            if (data.success && data.messages && data.messages.length > 0) {
              // Convert API messages to UI Message format
              // DB stores: 'user', 'assistant', 'system' in message_type column
              const loadedMessages: Message[] = data.messages.map((msg: any, index: number) => ({
                id: msg.id?.toString() || `loaded-${index}-${Date.now()}`,
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content || '',
                sources: msg.sources || [],
                metadata: msg.metadata || {},
                timestamp: msg.timestamp
              }))

              console.log(`✅ Converted ${loadedMessages.length} messages`)

              // Set the messages
              setMessages(loadedMessages)

              // Update conversation state to chatting mode
              setConversationState(prev => ({
                ...prev,
                phase: 'chatting',
                hasUserSentFirstMessage: true
              }))

              // Close the history panel after successful load
              setIsHistoryPanelOpen(false)

              console.log(`✅ Loaded ${loadedMessages.length} messages from conversation ${conversationId}`)
            } else {
              console.warn('⚠️ No messages in response:', data)
              // Still close panel but show empty chat
              setIsHistoryPanelOpen(false)
            }
          } catch (error) {
            console.error('❌ Failed to load conversation:', error)
          } finally {
            setIsLoading(false)
          }
        }}
      />
    </div>
  )
}
