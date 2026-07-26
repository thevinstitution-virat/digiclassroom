'use client'

import React from 'react'
import { Card, CardContent } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import FormattedContent from '@/components/ai/core/FormattedContent'
import LessonPlanContainer from '@/components/learning/lesson/LessonPlanContainer'
import { FeedbackWidget } from '@/components/user/profile/feedback/FeedbackWidget'
import AnswerActionButtons from '@/components/ai/AnswerActionButtons'
import { User, Bot, BookOpen, FileText, Loader2, X, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MultiModalInput } from '@/components/ai/tutor/MultiModalInput'
import { AgentSelector } from '@/components/ai/tutor/AgentSelector'
import { SubjectSelector } from '@/components/ai/tutor/SubjectSelector'
import { LengthSelector } from '@/components/ai/tutor/LengthSelector'
import { ChatHistoryPanel } from '@/components/ai/tutor/ChatHistoryPanel'
import { StreamingChatMessage } from '@/components/ai/chat/StreamingChatMessage'
import { ChatErrorBoundary } from '@/components/core/common/ChatErrorBoundary'
import { useAiTutor } from './_hooks/useAiTutor'
import { TutorHeader, UpgradeModal, ContextSelector } from './_components'
import { formatContextHeader } from '@/lib/context-labels'
import QuickReplies from '@/components/ai/tutor/QuickReplyCard'
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
    answerLength, setAnswerLength,
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

  // Stable options identity for FormattedContent. Without this, a fresh object
  // literal on every keystroke re-fired FormattedContent's format effect and
  // flashed every message to its loading spinner → whole-screen flicker.
  const formattedContentOptions = React.useMemo(() => ({
    classLevel: conversationState.context.classLevel || undefined,
    subject: conversationState.selectedSubject || selectedSubject || 'general',
    userRole: conversationState.selectedRole || 'student',
    enableAdvancedFormatting: true,
    enableAccessibilityFeatures: true,
    enableDiagramGeneration: true
  }), [
    conversationState.context.classLevel,
    conversationState.selectedSubject,
    conversationState.selectedRole,
    selectedSubject
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        {/* Header */}
        <TutorHeader
          isLoadingSubscription={isLoadingSubscription}
          subscriptionData={subscriptionData}
          connectionStatus={connectionStatus}
          conversationPhase={conversationState.phase}
          onOpenHistory={() => setIsHistoryPanelOpen(true)}
          onReset={resetConversation}
        />

        {/* Global Context Selector */}
        <div className="mb-4">
          <ContextSelector
            visible={shouldShowContextSelector()}
            currentValue={getCurrentContextValue()}
            options={generateContextOptions()}
            subscriptionData={subscriptionData}
            onValueChange={handleContextChange}
          />
        </div>

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
                {messages.filter(msg => msg.role === 'user' || msg.content?.trim() || (msg.messageType && msg.messageType !== 'text')).map((message) => (
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
                                      Agent System Response: {formatContextHeader(message.agentType)}
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
                                        options={formattedContentOptions}
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
                                        <span key={source.id || index}>
                                          {index > 0 && ', '}
                                          {source.title}
                                          {source.page && source.page !== 'Unknown Page' && ` (Pg. ${source.page})`}
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
                                  <QuickReplies
                                    replies={message.quickReplies}
                                    onSelect={(val) => {
                                      const q = message.quickReplies!.find(r => r.value === val || r.text === val)
                                      if (q) handleQuickReply(q)
                                    }}
                                    disabled={isLoading}
                                  />
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

                              {/* Feedback Widget - Show for all assistant messages that have an ID */}
                              {message.role === 'assistant' && message.id && message.id !== 'initial_greeting' && (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                  <FeedbackWidget 
                                    messageId={message.id}
                                    sessionId={sessionId}
                                  />
                                </div>
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
                {(agentStreamState.status !== 'idle' && agentStreamState.status !== 'complete') && (
                  <div className="flex justify-start my-4">
                    <StreamingChatMessage
                      streamState={agentStreamState}
                      studentName={conversationState.context.userName}
                      onStop={() => {
                        cancelMessage();
                        resetStream();
                      }}
                    />
                  </div>
                )}
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
                // Tutor + subject switchers live inside the input box once a chat
                // is active, letting the student change either mid-conversation
                // without resetting the chat (history is preserved).
                headerSlot={
                  conversationState.phase === 'chatting' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <AgentSelector
                        value={conversationState.context.menuIntent}
                        onChange={handleMenuSelection}
                        disabled={isLoading}
                      />
                      {availableSubjects.length > 0 && (
                        <SubjectSelector
                          value={conversationState.selectedSubject || selectedSubject}
                          options={availableSubjects}
                          disabled={isLoading}
                          onChange={(subject) => {
                            // Switch subject but stay in the chat with the same tutor.
                            setSelectedSubject(subject)
                            setConversationState(prev => ({
                              ...prev,
                              selectedSubject: subject,
                              context: { ...prev.context, subject }
                            }))
                          }}
                        />
                      )}
                      {/* Answer-length sizing — Deep Dive only. */}
                      {conversationState.context.menuIntent === 'explain_topic' && (
                        <LengthSelector
                          value={answerLength}
                          onChange={setAnswerLength}
                          disabled={isLoading}
                        />
                      )}
                    </div>
                  ) : undefined
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        data={upgradeModalData}
        onUpgradeClick={handleUpgradeClick}
      />

      {/* Chat History Panel */}
      <ChatHistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        onLoadConversation={async (conversationId: string) => {
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
