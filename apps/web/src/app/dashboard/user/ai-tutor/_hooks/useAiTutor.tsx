'use client'

// Unique ID generator to prevent React key collisions when messages
// are created within the same millisecond tick
let _msgCounter = 0
function uniqueMsgId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++_msgCounter}`
}

import React, { useState, useRef, useEffect } from 'react'
import { useSession } from '@/auth/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Input } from '@/components/core/ui/input'
import { Badge } from '@/components/core/ui/badge'
import { Textarea } from '@/components/core/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/core/ui/dialog'
import FormattedContent from '@/components/ai/core/FormattedContent'
import LessonPlanContainer from '@/components/learning/lesson/LessonPlanContainer'
import { FeedbackWidget } from '@/components/user/profile/feedback/FeedbackWidget'
import VisualizationRenderer from '@/components/ai/VisualizationRenderer'
import AnswerActionButtons from '@/components/ai/AnswerActionButtons'
// REMOVED: EnhancedKeyTerms import - using markdown Key Terms section instead
import { getAllSubjectsForClass, getAvailableSubjects, type Medium } from '@/config/subject-matrix'
import { useSubscription, useUserProfile, useSubjectFilter } from '@/hooks'
import {
  Brain,
  Send,
  Upload,
  X,
  User,
  Bot,
  GraduationCap,
  Users,
  UserCheck,
  Settings,
  BookOpen,
  Calculator,
  HelpCircle,
  MessageSquare,
  FileText,
  Lightbulb,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  School,
  Building,
  Home,
  PenTool,
  Target,
  Zap,
  ClipboardList,
  BarChart3,
  UserPlus,
  Phone,
  TrendingUp,
  Heart,
  Mic,
  Image as ImageIcon,
  Lock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Layers,
  Trophy,
  MessageCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MultiModalInput } from '@/components/ai/tutor/MultiModalInput'
import { ChatHistoryPanel } from '@/components/ai/tutor/ChatHistoryPanel'
import { History } from 'lucide-react'
import { useAgentStream } from '@/hooks/useAgentStream'
import type { AnswerLength } from '@/lib/ai/answer-length'
import { StreamingChatMessage } from '@/components/ai/chat/StreamingChatMessage'
import { ChatErrorBoundary } from '@/components/core/common/ChatErrorBoundary' // Phase 8

import { getSubjectById } from '@/config/subjects.config'

import type { QuickReply, Message, ConversationState, UserRole, EducationBoard, MenuItem } from '../_types'

export function useAiTutor() {
  const { data: sessionData } = useSession();
  const user = sessionData?.user;

  // Use centralized hooks for subscription and profile data
  const {
    subscriptionData,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
    userClass,
    hasAllSubjects,
    purchasedSubjects,
    refetch
  } = useSubscription()

  const {
    userMedium,
    userStream
  } = useUserProfile()

  // Get filtered subjects based on subscription and profile
  const availableSubjects = useSubjectFilter({
    classLevel: userClass,
    medium: userMedium,
    stream: userStream,
    purchasedSubjects,
    hasAllSubjects,
    enableLogging: true
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [showFormattingMetadata, setShowFormattingMetadata] = useState(false)
  const [fileContent, setFileContent] = useState<string>('')
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [voiceCommand, setVoiceCommand] = useState<any>(null)
  // CBSE answer-length tier for Deep Dive (undefined = agent auto-sizes the answer)
  const [answerLength, setAnswerLength] = useState<AnswerLength | undefined>(undefined)

  // Session ID for tracking chat history and button usage
  const [sessionId] = useState(() => `session_${user?.id || 'anonymous'}_${Date.now()}`)

  // Initialize the streaming hook
  const { state: agentStreamState, sendMessage, reset: resetStream } = useAgentStream({
    agentType: 'general_help', // Default when no menu selected; overridden per message via sendMessage({ agentType })
    onComplete: (finalText, citations) => {
      console.log('🏁 [useAiTutor] onComplete called! finalText length:', finalText.length);
      // Stream is done, finalize the message in history
      setMessages(prev => {
        console.log('🏁 [useAiTutor] adding message to state. Prev length:', prev.length);
        const assistantMessage: Message = {
          id: uniqueMsgId('assistant'),
          role: 'assistant',
          content: finalText,
          timestamp: new Date(),
          sources: citations as any[], // Using standard citation format
          messageType: 'text'
        }
        return [...prev, assistantMessage]
      })
      setIsLoading(false)
      resetStream()
    },
    onScopeViolation: (message) => {
      setMessages(prev => [...prev, {
        id: uniqueMsgId('assistant'),
        role: 'assistant',
        content: message,
        timestamp: new Date(),
        messageType: 'error'
      }])
      setIsLoading(false)
      resetStream()
    },
    onError: (message, recoverable) => {
      setMessages(prev => [...prev, {
        id: uniqueMsgId('assistant'),
        role: 'assistant',
        content: message + (recoverable ? '\n\nPlease try again.' : ''),
        timestamp: new Date(),
        messageType: 'error'
      }])
      setIsLoading(false)
      resetStream()
    }
  })

  const [conversationState, setConversationState] = useState<ConversationState>({
    phase: 'initial_greeting',
    selectedRole: undefined,
    selectedBoard: undefined,
    selectedClass: undefined,
    selectedSubject: undefined,
    selectedMenuItem: undefined,
    hasUserSentFirstMessage: false,
    context: {
      userName: user?.name?.split(' ')[0] || 'there',
      userRole: undefined,
      educationBoard: undefined,
      classLevel: undefined,
      subject: undefined,
      menuIntent: undefined
    }
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('online')
  const [lastHealthCheck, setLastHealthCheck] = useState<Date>(new Date())

  // Chat history state
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false)
  const [systemHealth, setSystemHealth] = useState({
    responseTimeHealth: 'good' as 'good' | 'warning' | 'critical',
    errorRateHealth: 'good' as 'good' | 'warning' | 'critical',
    cacheEfficiency: 'good' as 'good' | 'warning' | 'critical'
  })
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageResponseTime: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastRequestTime: 0
  })

  // Advanced caching system
  const requestCacheRef = useRef<Map<string, {
    response: string,
    timestamp: number,
    hitCount: number,
    lastAccessed: number
  }>>(new Map())
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  const MAX_CACHE_SIZE = 100 // Increased cache size

  // Connection pool simulation
  const connectionPoolRef = useRef({
    activeConnections: 0,
    maxConnections: 5,
    queuedRequests: 0,
    totalConnectionsUsed: 0
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-populate context from subscription data
  useEffect(() => {
    if (!subscriptionData || isLoadingSubscription) return

    // Do not run auto-population if we've already started the conversation
    // This prevents refetch() from resetting the phase and blocking the input
    if (messages.length > 0 && conversationState.phase !== 'initial_greeting') {
      return
    }

    // 🚀 PRIORITY 1: Auto-populate context from subscription data
    const subscription = subscriptionData.subscription
    const access = subscriptionData.access

    // Determine the target phase based on subscription
    let targetPhase: ConversationState['phase'] = 'chatting'
    let shouldShowSubjectSelection = false

    // Auto-populate board
    let autoBoard: EducationBoard | undefined
    if (subscription.purchased_board && subscription.purchased_board !== 'ALL') {
      autoBoard = subscription.purchased_board.toLowerCase() as EducationBoard
    } else if (access.boards.length === 1) {
      // Premium user but only one board available (shouldn't happen, but handle it)
      autoBoard = access.boards[0].toLowerCase() as EducationBoard
    } else if (access.has_full_access) {
      // Full access user - default to CBSE
      autoBoard = 'cbse' as EducationBoard
    }

    // Auto-populate class
    let autoClass: string | undefined
    if (subscription.purchased_class) {
      autoClass = `Class ${subscription.purchased_class}`
    } else if (!access.has_all_classes && access.classes.length === 1) {
      autoClass = `Class ${access.classes[0]}`
    } else if (access.has_all_classes) {
      // Full access user - default to Class 9 (available in vector database)
      autoClass = 'Class 9'
    }

    // Auto-populate role (default to 'student')
    const autoRole: UserRole = 'student'

    // Auto-populate subject
    let autoSubject: string | undefined
    let shouldShowMenuSelection = false

    // Determine if we need subject selection
    // If user has all subjects or multiple subjects, show subject selection
    if (access.has_all_subjects || (subscription.purchased_subjects && subscription.purchased_subjects.length > 1)) {
      shouldShowSubjectSelection = true
      targetPhase = 'class_selected' // Will trigger subject selection
    } else if (subscription.purchased_subjects && subscription.purchased_subjects.length === 1) {
      autoSubject = subscription.purchased_subjects[0]
      shouldShowMenuSelection = true
      targetPhase = 'subject_selected' // Will trigger menu selection
    } else {
      // Fallback
      shouldShowMenuSelection = true
      targetPhase = 'subject_selected'
    }

    console.log('🎯 Auto-populating context:', {
      board: autoBoard,
      class: autoClass,
      role: autoRole,
      subject: autoSubject,
      targetPhase,
      shouldShowSubjectSelection,
      shouldShowMenuSelection
    })

    // Update conversation state with auto-populated data
    setConversationState(prev => ({
      ...prev,
      phase: targetPhase,
      selectedRole: autoRole,
      selectedBoard: autoBoard,
      selectedClass: autoClass,
      selectedSubject: autoSubject,
      context: {
        ...prev.context,
        userRole: autoRole,
        educationBoard: autoBoard,
        classLevel: autoClass,
        subject: autoSubject
        // IMPORTANT: Preserve menuIntent and other context fields
      }
    }))

    // If we should show subject selection, trigger it
    if (shouldShowSubjectSelection && autoBoard && autoClass) {
      setTimeout(() => {
        // Check if subject selection message already exists to prevent duplicates
        setMessages(prev => {
          const hasSubjectSelection = prev.some(msg => msg.id.startsWith('subject_selection'))
          if (hasSubjectSelection) {
            console.log('⚠️ Subject selection already shown, skipping duplicate')
            return prev
          }

          const subjectMessage: Message = {
            id: `subject_selection_auto_${Date.now()}`,
            role: 'assistant',
            content: `Perfect! I'm ready to help you with ${getBoardDisplayName(autoBoard!)} ${autoClass}. Which subject would you like to explore today?`,
            timestamp: new Date(),
            messageType: 'options',
            quickReplies: generateSubjectQuickReplies(autoClass)
          }
          return [...prev, subjectMessage]
        })
      }, 500)
    } else if (shouldShowMenuSelection && autoBoard && autoClass) {
      // Show menu selection
      setTimeout(() => {
        setMessages(prev => {
          if (prev.some(msg => msg.id.startsWith('menu_selection'))) return prev;

          const roleSpecificMenuMessage = {
            student: `Perfect! I see you're studying ${autoSubject || 'your subjects'} for ${autoClass}. What would you like to study today?`,
            teacher: `Perfect! I see you're teaching ${autoSubject || 'your subjects'} for ${autoClass}. What teaching resources do you need today?`,
            parent: `Perfect! I see your child is studying ${autoSubject || 'their subjects'} for ${autoClass}. How can I help you support their education today?`
          }

          const menuSelectionMessage: Message = {
            id: `menu_selection_${Date.now()}`,
            role: 'assistant',
            content: roleSpecificMenuMessage[autoRole] || `Perfect! What would you like to do today?`,
            timestamp: new Date(),
            messageType: 'options',
            quickReplies: generateMenuQuickReplies(autoRole)
          }
          return [...prev, menuSelectionMessage]
        })
      }, 500)
    } else {
      // Skip directly to chatting - show ready message
      setTimeout(() => {
        const readyMessage: Message = {
          id: 'ready_to_chat',
          role: 'assistant',
          content: `Perfect! I'm ready to help you with your ${autoBoard ? getBoardDisplayName(autoBoard) : ''} ${autoClass || ''} studies. What would you like to learn about today?`,
          timestamp: new Date(),
          messageType: 'text'
        }
        setMessages(prev => [...prev, readyMessage])
      }, 500)
    }
  }, [subscriptionData, isLoadingSubscription])

  // Health check functionality
  const performHealthCheck = async (): Promise<boolean> => {
    try {
      setConnectionStatus('checking')

      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      const isHealthy = response.ok
      setConnectionStatus(isHealthy ? 'online' : 'offline')
      setLastHealthCheck(new Date())

      return isHealthy
    } catch (error) {
      console.warn('Health check failed:', error)
      setConnectionStatus('offline')
      setLastHealthCheck(new Date())
      return false
    }
  }

  // Periodic health checks
  useEffect(() => {
    // Initial health check
    performHealthCheck()

    // Set up periodic health checks every 30 seconds
    const healthCheckInterval = setInterval(() => {
      performHealthCheck()
    }, 30000)

    // Online/offline event listeners
    const handleOnline = () => {
      setConnectionStatus('online')
      performHealthCheck()
    }

    const handleOffline = () => {
      setConnectionStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(healthCheckInterval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Initialize with greeting message
  useEffect(() => {
    if (messages.length === 0 && conversationState.phase === 'initial_greeting') {
      // Show simplified greeting - subscription will auto-populate context
      const greetingMessage: Message = {
        id: 'initial_greeting',
        role: 'assistant',
        content: `Namaste ${conversationState.context.userName}! 🙏

I'm **Virat Gyankosh**, your AI educational companion. I'm here to help you with your learning journey with curriculum-aligned content.`,
        timestamp: new Date(),
        messageType: 'text'
      }
      setMessages([greetingMessage])
    }
  }, [messages.length, conversationState.phase])

  // Retry configuration
  const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2
  }

  // Calculate delay for exponential backoff
  const calculateRetryDelay = (attempt: number): number => {
    const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt)
    return Math.min(delay, RETRY_CONFIG.maxDelay)
  }

  // Advanced cache management
  const manageCacheSize = () => {
    if (requestCacheRef.current.size > MAX_CACHE_SIZE) {
      // LRU eviction - remove least recently used items
      const entries = Array.from(requestCacheRef.current.entries())
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

      // Remove oldest 20% of entries
      const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2)
      for (let i = 0; i < toRemove; i++) {
        requestCacheRef.current.delete(entries[i][0])
      }
    }
  }

  // Connection pool management
  const acquireConnection = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (connectionPoolRef.current.activeConnections < connectionPoolRef.current.maxConnections) {
        connectionPoolRef.current.activeConnections++
        connectionPoolRef.current.totalConnectionsUsed++
        resolve()
      } else {
        connectionPoolRef.current.queuedRequests++
        // Simulate connection wait
        setTimeout(() => {
          connectionPoolRef.current.queuedRequests--
          connectionPoolRef.current.activeConnections++
          connectionPoolRef.current.totalConnectionsUsed++
          resolve()
        }, 100)
      }
    })
  }

  const releaseConnection = () => {
    connectionPoolRef.current.activeConnections = Math.max(0, connectionPoolRef.current.activeConnections - 1)
  }

  // System health evaluation
  const updateSystemHealth = (metrics: typeof performanceMetrics) => {
    const errorRate = metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0
    const cacheHitRate = metrics.totalRequests > 0 ?
      Array.from(requestCacheRef.current.values()).reduce((sum, item) => sum + item.hitCount, 0) / metrics.totalRequests : 0

    setSystemHealth({
      responseTimeHealth:
        metrics.averageResponseTime < 5000 ? 'good' :
          metrics.averageResponseTime < 15000 ? 'warning' : 'critical',
      errorRateHealth:
        errorRate < 0.05 ? 'good' :
          errorRate < 0.15 ? 'warning' : 'critical',
      cacheEfficiency:
        cacheHitRate > 0.3 ? 'good' :
          cacheHitRate > 0.1 ? 'warning' : 'critical'
    })
  }

  // Enhanced API request with retry logic and connection pooling
  const makeAPIRequest = async (requestData: any, attempt: number = 0): Promise<Response> => {
    // Acquire connection from pool
    await acquireConnection()

    try {
      const response = await fetch('/api/ai/chat', requestData)

      // If response is not ok and we haven't exceeded max retries, retry
      if (!response.ok && attempt < RETRY_CONFIG.maxRetries) {
        const isRetryableError = response.status >= 500 || response.status === 429 || response.status === 408

        if (isRetryableError) {
          const delay = calculateRetryDelay(attempt)
          console.log(`API request failed (attempt ${attempt + 1}), retrying in ${delay}ms...`)

          await new Promise(resolve => setTimeout(resolve, delay))
          return makeAPIRequest(requestData, attempt + 1)
        }
      }

      return response
    } catch (error) {
      // Release connection on error
      releaseConnection()

      // Network errors - retry if we haven't exceeded max retries
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = calculateRetryDelay(attempt)
        console.log(`Network error (attempt ${attempt + 1}), retrying in ${delay}ms...`, error)

        await new Promise(resolve => setTimeout(resolve, delay))
        return makeAPIRequest(requestData, attempt + 1)
      }

      throw error
    } finally {
      // Always release connection
      releaseConnection()
    }
  }

  // Handle multi-modal input submission
  const handleMultiModalSubmit = async (data: {
    text: string
    file?: File
    voiceCommand?: any
    isVoiceInput?: boolean
  }) => {
    console.log('🚀 [useAiTutor] handleMultiModalSubmit called! text:', data.text);
    if (!data.text.trim() && !data.file) return

    // Mark that user has sent their first message
    if (!conversationState.hasUserSentFirstMessage) {
      setConversationState(prev => ({
        ...prev,
        hasUserSentFirstMessage: true
      }))
    }

    // Create user message
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: data.text.trim(),
      timestamp: new Date(),
      messageType: data.isVoiceInput ? 'voice' : 'text',
      fileAttachment: data.file ? {
        name: data.file.name,
        size: data.file.size,
        type: data.file.type
      } : undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      // Process file if provided
      let processedFileContent = ''
      if (data.file) {
        try {
          processedFileContent = await processUploadedFile(data.file)
          setFileContent(processedFileContent)
          setUploadedFile(data.file)
        } catch (error) {
          console.error('File processing failed:', error)
        }
      }

      // Prepare request data
      const currentMenuIntent = conversationState.context.menuIntent || 'general_help'
      console.log(`\n${'='.repeat(80)}`)
      console.log(`🚀 [FRONTEND] Sending request with menuIntent: "${currentMenuIntent}"`)
      console.log(`📋 [FRONTEND] Selected menu item: ${conversationState.selectedMenuItem?.title}`)
      console.log(`🎯 [FRONTEND] Conversation state:`, {
        phase: conversationState.phase,
        menuIntent: currentMenuIntent,
        menuIntentType: typeof currentMenuIntent,
        selectedMenuItem: conversationState.selectedMenuItem?.id,
        selectedMenuItemTitle: conversationState.selectedMenuItem?.title
      })
      console.log(`🔍 [FRONTEND] Full context object:`, conversationState.context)
      console.log(`${'='.repeat(80)}\n`)

      const requestData = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-data': JSON.stringify({
            userId: user?.id,
            tenantId: 'demo-tenant-001',
            userRole: conversationState.selectedRole || 'student',
            userPersona: conversationState.selectedRole || 'student',
            subject: conversationState.selectedSubject || selectedSubject || 'general',
            classLevel: conversationState.context.classLevel || null,
            menuIntent: currentMenuIntent,
            conversationPhase: conversationState.phase,
            hasUserSentFirstMessage: conversationState.hasUserSentFirstMessage,
            userName: conversationState.context.userName,
            selectedClass: conversationState.selectedClass,
            selectedMenuItem: conversationState.selectedMenuItem?.id
          })
        },
        body: JSON.stringify({
          message: data.text.trim(),
          subject: conversationState.selectedSubject || selectedSubject || 'general',
          classLevel: conversationState.context.classLevel || 'Class X',
          context: {
            ...conversationState.context,
            conversationPhase: conversationState.phase,
            hasUserSentFirstMessage: conversationState.hasUserSentFirstMessage
          },
          previousMessages: messages.slice(-5),
          conversationHistory: messages.slice(-6).map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          roleContext: {
            role: conversationState.selectedRole || 'student',
            educationBoard: conversationState.selectedBoard || 'cbse',
            classLevel: conversationState.context.classLevel || 'Class X',
            menuIntent: currentMenuIntent,
            selectedMenuItem: conversationState.selectedMenuItem
          },
          uploadedFile: data.file ? {
            name: data.file.name,
            type: data.file.type,
            size: data.file.size
          } : null,
          voiceCommand: data.voiceCommand,
          isVoiceInput: data.isVoiceInput,
          fileContent: processedFileContent,
          multiModalContext: {
            userIntent: data.voiceCommand?.command ? {
              primary: getIntentFromVoiceCommand(data.voiceCommand.command.action),
              confidence: data.voiceCommand.confidence
            } : undefined,
            educationalContext: {
              subject: selectedSubject,
              classLevel: conversationState.selectedClass,
              userRole: conversationState.selectedRole || 'student',
              curriculum: 'cbse'
            }
          }
        }),
        signal: abortControllerRef.current.signal
      }

      // Send the request via useAgentStream
      await sendMessage({
        query: data.text.trim(),
        studentName: conversationState.context.userName,
        grade: parseInt(conversationState.context.classLevel?.replace('Class ', '') || '10'),
        subject: conversationState.selectedSubject || selectedSubject || 'general',
        language: 'english', // Legacy field (graph path); default response language is driven by `medium` below
        sessionId: sessionId,
        studentId: user?.id || 'anonymous',
        // Note: The new hook accepts standard conversation history
        conversationHistory: messages.slice(-5).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        // The selected agent persona (Selfstudy Buddy, Deep Dive, …) — routes to the
        // matching specialized agent on the backend (graph path or legacy MenuRouter).
        agentType: currentMenuIntent,
        // Student's subscribed medium → backend defaults the response language to it
        // (unless the student explicitly asks for a language in their message).
        medium: userMedium,
        // CBSE answer-length tier — only meaningful for Deep Dive, so only sent then.
        answerLength: currentMenuIntent === 'explain_topic' ? answerLength : undefined,
      })

      // Clear uploaded file after request fired
      setUploadedFile(null)

      // Save conversation to history (non-blocking API call)
      try {
        if (user?.id) {
          // Use the session ID from state (already initialized)
          // Legacy non-streaming fallback handling
          // This block seems to be misplaced or a remnant of a previous edit.
          // The instruction is to remove references to `assistantMessage`, which was used in the history save.
          // The provided `Code Edit` block seems to be a replacement for the history save and subscription refresh.
          // Let's assume the user wants to replace the history save and subscription refresh with the provided block.
          // The `assistantMessage` variable is not defined in the current context, so its references must be removed.
          // The provided `Code Edit` block also contains a `throw new Error` and an `id: `error_${Date.now()}`, etc.
          // which looks like it's meant to be part of an error handling block, not directly under `if (user?.id)`.
          // Given the instruction "Remove references to the undefined assistantMessage variable",
          // and the context of the provided `Code Edit` block, it seems the user wants to remove the old history save
          // and subscription refresh logic, and potentially integrate the new error handling.
          // However, the `Code Edit` block itself is syntactically incorrect as provided (e.g., `if (!response.ok)`
          // is not closed, and then `id: `error_${Date.now()}` appears out of context).

          // Reinterpreting the instruction: The user wants to remove the lines that use `assistantMessage`
          // from the history save block, as `assistantMessage` is no longer available.
          // The provided `Code Edit` block seems to be a *new* error handling mechanism that the user
          // intends to integrate, but it's not directly related to `assistantMessage` removal.
          // I will focus on removing the `assistantMessage` references from the history save block.
          // The provided `Code Edit` block seems to be a separate, larger change that is not fully formed
          // or correctly placed in the instruction. I will only address the `assistantMessage` removal.

          // Call API to save history (fire and forget - don't await)
          fetch('/api/ai/chat/history/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              role: conversationState.selectedRole || 'student',
              intent: conversationState.context.menuIntent || 'general_help',
              topic: data.text.trim().substring(0, 255),
              subject: conversationState.selectedSubject || selectedSubject,
              classLevel: conversationState.context.classLevel,
              sessionId: sessionId,
              metadata: {
                board: conversationState.selectedBoard,
                menuItem: conversationState.selectedMenuItem?.title
              },
              userMessage: data.text.trim(),
              // assistantMessage: assistantMessage.content, // Removed
              assistantMetadata: {
                tokensUsed: undefined,
                // responseTimeMs: assistantMessage.performanceMetrics?.responseTimeMs, // Removed
                // ragSources: assistantMessage.sources, // Removed
                agentType: conversationState.context.menuIntent || 'general_help'
              }
            })
          }).catch(err => {
            console.warn('⚠️ [Chat History] Failed to save (non-critical):', err)
          })

          console.log('💾 [Chat History] Saving conversation to database...')
        }
      } catch (historyError) {
        console.error('⚠️ [Chat History] Failed to save (non-critical):', historyError)
        // Don't fail the chat flow if history saving fails
      }

      // Refresh subscription data to update quota UI
      // This block is intended to replace the existing quota refresh logic.
      // The provided Code Edit block is syntactically incorrect as a direct replacement.
      // Assuming the intent is to replace the `setSubscriptionData` call with `refetch()`
      // and potentially add error-specific handling for `DAILY_LIMIT_EXCEEDED`.
      // Given the instruction, I will replace the existing `try...catch` block for quota refresh
      // with a simplified `refetch()` call, as the provided `Code Edit` block is malformed.
      // If `errorData` is meant to be available here, it would need to be passed from the `sendMessage` call.
      // For now, I will interpret the instruction as replacing the `setSubscriptionData` with `refetch()`
      // in the context of a successful response, or calling `refetch()` generally.
      // The provided `Code Edit` block seems to be part of a larger error handling context,
      // but the instruction specifically targets `setSubscriptionData` replacement.

      // Based on the instruction and the provided Code Edit, it seems the user wants to
      // replace the existing quota refresh logic with a conditional refetch based on an error.
      // However, the `errorData` is not available in this `try` block.
      // I will assume the user wants to replace the *entire* quota refresh block with the provided
      // (albeit syntactically incomplete) `Code Edit` block, and I will try to make it syntactically correct
      // by placing the `if` condition within a `try` block, assuming `errorData` would be defined
      // if an error occurred in the `sendMessage` call or a preceding API call.
      // Since `errorData` is not defined here, I will make a best effort to integrate the `refetch()` call.

      // The instruction is to replace `setSubscriptionData` with `refetch`.
      // The provided `Code Edit` block is:
      // ```
      //               // Refresh subscription data to update quota UI
      //             if (errorData.error === 'DAILY_LIMIT_EXCEEDED') {
      //               await refetch()
      //               console.log('✅ Quota refresh triggered via useSubscription.refetch()')
      //             } catch (error) {
      //         console.warn('Failed to refresh quota:', error)
      //         // Don't fail the request if quota refresh fails
      //       }
      // ```
      // This block is syntactically incorrect as it stands. A `catch` cannot follow an `if` directly.
      // It seems like this `if` block should be inside a `try` block, and the `catch` block is for that `try`.
      // However, the instruction is very specific about replacing `setSubscriptionData`.
      // The most faithful interpretation of "replace setSubscriptionData" with `refetch`
      // while also incorporating the provided `Code Edit` block is to replace the entire
      // `try...catch` block for quota refresh with the provided `Code Edit` block,
      // and then fix the syntax.

      // Given the context, the `refetch()` should likely be called unconditionally after a successful message send,
      // or conditionally if an error related to quota is detected.
      // The provided `Code Edit` block suggests a conditional call within an error context.
      // This implies that the `refetch()` might be intended to be called *after* an error,
      // not as part of the general success path.

      // Let's assume the user wants to replace the existing quota refresh block with the provided
      // `Code Edit` block, and that `errorData` would be available in a real scenario.
      // I will make the provided `Code Edit` block syntactically correct by wrapping the `if` in a `try`.
      // This is a speculative fix to make the provided snippet valid.

      try {
        // Refresh subscription data to update quota UI
        await refetch()
        console.log('✅ Quota refresh triggered via useSubscription.refetch()')
      } catch (error) {
        console.warn('Failed to refresh quota:', error)
        // Don't fail the request if quota refresh fails
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error sending message:', error)

        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
          messageType: 'error'
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    handleMultiModalSubmit({
      text: input,
      file: uploadedFile || undefined,
      isVoiceInput: false
    })
  }

  // Process uploaded file content
  const processUploadedFile = async (file: File): Promise<string> => {
    const formData = new FormData()

    if (file.type.startsWith('image/')) {
      // Process image with OCR
      formData.append('image', file)
      formData.append('language', 'eng')

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('OCR processing failed')
      }

      const result = await response.json()
      return result.success ? result.data.text : ''
    } else {
      // Process document using content upload API
      formData.append('file', file)
      formData.append('metadata', JSON.stringify({
        subject: 'General',
        class: 'Mixed',
        board: 'General',
        medium: 'English'
      }))

      const response = await fetch('/api/super-admin/content/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Document processing failed')
      }

      const result = await response.json()
      return result.success ? (result.extractedText || '') : ''
    }
  }

  // Get intent from voice command
  const getIntentFromVoiceCommand = (action: string): string => {
    switch (action) {
      case 'explain':
      case 'explain_steps':
        return 'explanation'
      case 'create_quiz':
      case 'practice_problems':
        return 'practice'
      case 'summarize':
        return 'summary'
      case 'read_file':
        return 'analysis'
      default:
        return 'question'
    }
  }

  // Generate system prompt based on conversation state
  const generateSystemPrompt = (): string => {
    const { selectedRole, context } = conversationState

    let prompt = `You are Virat Gyankosh AI Tutor, an advanced educational assistant designed for Indian education (CBSE curriculum). `

    if (selectedRole === 'student') {
      prompt += `You are helping a student with their studies. Provide clear explanations, examples, and encourage learning. `
    } else if (selectedRole === 'teacher') {
      prompt += `You are assisting a teacher with lesson planning and educational resources. Provide structured, curriculum-aligned content. `
    } else if (selectedRole === 'parent') {
      prompt += `You are helping a parent understand their child's education and how to support learning at home. `
    }

    if (context.classLevel) {
      prompt += `The focus is on ${context.classLevel} level content. `
    }

    if (context.menuIntent) {
      prompt += `The current intent is: ${context.menuIntent}. `
    }

    prompt += `Always provide helpful, accurate, and age-appropriate responses. Use Indian cultural context and examples when relevant.`

    return prompt
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const removeUploadedFile = () => {
    setUploadedFile(null)
  }

  const cancelMessage = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsLoading(false)
  }

  // Handle quick reply selection
  const handleQuickReply = (quickReply: QuickReply) => {
    // Mark that user has sent their first message
    if (!conversationState.hasUserSentFirstMessage) {
      setConversationState(prev => ({
        ...prev,
        hasUserSentFirstMessage: true
      }))
    }

    // Add user message for the selected quick reply
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: quickReply.text,
      timestamp: new Date(),
      messageType: 'text'
    }

    setMessages(prev => [...prev, userMessage])

    // Handle different conversation phases
    switch (conversationState.phase) {
      case 'awaiting_role_selection':
        handleRoleSelection(quickReply.value as UserRole)
        break
      case 'role_selected':
        handleBoardSelection(quickReply.value as EducationBoard)
        break
      case 'board_selected':
        handleClassSelection(quickReply.value)
        break
      case 'class_selected':
        handleSubjectSelection(quickReply.value)
        break
      case 'subject_selected':
        handleMenuSelection(quickReply.value)
        break
      default:
        // For other phases, treat as regular input
        setInput(quickReply.text)
        setTimeout(() => handleSendMessage(), 100)
        break
    }
  }

  // Handle role selection - ALL ROLES (Student, Teacher, Parent) proceed to board selection
  const handleRoleSelection = (role: UserRole) => {
    console.log(`🎯 Role selected: ${role} - Proceeding to board selection`)

    setConversationState(prev => ({
      ...prev,
      phase: 'role_selected',
      selectedRole: role,
      context: {
        ...prev.context,
        userRole: role
      }
    }))

    // Send board selection message for ALL roles (Student, Teacher, Parent)
    setTimeout(() => {
      const availableBoards = generateBoardQuickReplies()

      // Auto-skip board selection if user has only one board
      if (availableBoards.length === 1) {
        console.log(`🚀 Auto-selecting single board: ${availableBoards[0].value}`)
        handleBoardSelection(availableBoards[0].value as EducationBoard)
        return
      }

      const roleSpecificMessage = {
        student: "Perfect! As a student, I'll help you with your studies. First, please select your education board so I can provide curriculum-specific content:",
        teacher: "Perfect! As a teacher, I'll assist you with lesson planning and educational resources. First, please select your education board so I can provide curriculum-aligned content:",
        parent: "Perfect! As a parent, I'll help you understand your child's education and support their learning. First, please select your education board so I can provide relevant guidance:"
      }

      const boardSelectionMessage: Message = {
        id: 'board_selection',
        role: 'assistant',
        content: roleSpecificMessage[role],
        timestamp: new Date(),
        messageType: 'options',
        quickReplies: availableBoards
      }

      console.log(`📋 Sending board selection for ${role}:`, boardSelectionMessage)
      setMessages(prev => [...prev, boardSelectionMessage])
    }, 1000)
  }

  // Handle board selection - Works for ALL roles (Student, Teacher, Parent)
  const handleBoardSelection = (board: EducationBoard) => {
    console.log(`🏫 Board selected: ${board} for role: ${conversationState.selectedRole}`)

    setConversationState(prev => ({
      ...prev,
      phase: 'board_selected',
      selectedBoard: board,
      context: {
        ...prev.context,
        educationBoard: board
      }
    }))

    // Send class selection message
    setTimeout(() => {
      const availableClasses = generateClassQuickReplies(conversationState.selectedRole!, board)

      // Auto-skip class selection if user has only one class
      if (availableClasses.length === 1) {
        console.log(`🚀 Auto-selecting single class: ${availableClasses[0].value}`)
        handleClassSelection(availableClasses[0].value)
        return
      }

      const classSelectionMessage: Message = {
        id: 'class_selection',
        role: 'assistant',
        content: `Excellent! I'll provide ${getBoardDisplayName(board)}-aligned content. Now, please select your class level for curriculum-appropriate assistance:`,
        timestamp: new Date(),
        messageType: 'options',
        quickReplies: availableClasses
      }
      setMessages(prev => [...prev, classSelectionMessage])
    }, 1000)
  }

  // Handle class selection - Works for ALL roles (Student, Teacher, Parent)
  const handleClassSelection = (classLevel: string) => {
    console.log(`🎓 Class selected: ${classLevel} for role: ${conversationState.selectedRole}`)

    setConversationState(prev => ({
      ...prev,
      phase: 'class_selected',
      selectedClass: classLevel,
      context: {
        ...prev.context,
        classLevel: classLevel
      }
    }))

    // Send subject selection message for ALL roles
    setTimeout(() => {
      const roleSpecificSubjectMessage = {
        student: `Great! You've selected ${classLevel}. Now, which subject would you like to focus on?`,
        teacher: `Great! You've selected ${classLevel}. Which subject do you need teaching resources for?`,
        parent: `Great! You've selected ${classLevel}. Which subject would you like to help your child with?`
      }

      // Check if subject selection message already exists to prevent duplicates
      setMessages(prev => {
        const hasSubjectSelection = prev.some(msg => msg.id.startsWith('subject_selection'))
        if (hasSubjectSelection) {
          console.log('⚠️ Subject selection already shown, skipping duplicate')
          return prev
        }

        const subjectSelectionMessage: Message = {
          id: `subject_selection_manual_${Date.now()}`,
          role: 'assistant',
          content: roleSpecificSubjectMessage[conversationState.selectedRole!] || `Great! You've selected ${classLevel}. Which subject would you like to focus on?`,
          timestamp: new Date(),
          messageType: 'options',
          quickReplies: generateSubjectQuickReplies(classLevel)
        }

        console.log(`📚 Sending subject selection for ${conversationState.selectedRole}:`, subjectSelectionMessage)
        return [...prev, subjectSelectionMessage]
      })
    }, 1000)
  }

  // Handle subject selection - Works for ALL roles (Student, Teacher, Parent)
  const handleSubjectSelection = (subject: string) => {
    console.log(`📚 Subject selected: ${subject} for role: ${conversationState.selectedRole}`)

    setConversationState(prev => ({
      ...prev,
      phase: 'subject_selected',
      selectedSubject: subject,
      context: {
        ...prev.context,
        subject: subject
      }
    }))

    // Update the selectedSubject state as well for backward compatibility
    setSelectedSubject(subject)

    // Send menu selection message for ALL roles
    setTimeout(() => {
      const roleSpecificMenuMessage = {
        student: `Perfect! You've selected ${subject} for ${conversationState.selectedClass}. What would you like to study today?`,
        teacher: `Perfect! You've selected ${subject} for ${conversationState.selectedClass}. What teaching resources do you need today?`,
        parent: `Perfect! You've selected ${subject} for ${conversationState.selectedClass}. How can I help you support your child's education today?`
      }

      const menuSelectionMessage: Message = {
        id: `menu_selection_${Date.now()}`,
        role: 'assistant',
        content: roleSpecificMenuMessage[conversationState.selectedRole!] || `Perfect! You've selected ${subject}. What would you like to do today?`,
        timestamp: new Date(),
        messageType: 'options',
        quickReplies: generateMenuQuickReplies(conversationState.selectedRole!)
      }

      console.log(`📋 Sending menu selection for ${conversationState.selectedRole}:`, menuSelectionMessage)
      // Remove any existing menu_selection messages before adding new one to prevent duplicates
      setMessages(prev => [...prev.filter(m => !m.id.startsWith('menu_selection')), menuSelectionMessage])
    }, 1000)
  }

  // Handle menu selection - Final step for ALL roles (Student, Teacher, Parent)
  const handleMenuSelection = (menuIntent: string) => {
    console.log(`📋 Menu selected: ${menuIntent} for role: ${conversationState.selectedRole}`)
    console.log(`🔍 [Frontend Debug] Setting menuIntent in state: "${menuIntent}"`)

    const menuItem = getMenuItemById(menuIntent)

    setConversationState(prev => {
      const newState = {
        ...prev,
        phase: 'chatting' as const,
        selectedMenuItem: menuItem,
        context: {
          ...prev.context,
          menuIntent: menuIntent  // Explicitly set menu intent
        }
      }

      console.log(`✅ [Frontend Debug] New conversation state:`, {
        phase: newState.phase,
        menuIntent: newState.context.menuIntent,
        selectedMenuItem: newState.selectedMenuItem?.id
      })

      return newState
    })

    // Send confirmation and start chatting
    setTimeout(() => {
      const confirmationMessage: Message = {
        id: `confirmation-${Date.now()}`,
        role: 'assistant',
        content: `Excellent! I'm ready to help you with **${menuItem?.title}**.

${menuItem?.description}

Feel free to ask me any questions related to your studies. I'll provide detailed explanations tailored to your level and role.`,
        timestamp: new Date(),
        messageType: 'confirmation'
      }
      // Remove any existing confirmation messages before adding new one to prevent duplicates
      setMessages(prev => [...prev.filter(m => m.messageType !== 'confirmation'), confirmationMessage])
    }, 1000)
  }

  // Helper function to render icons
  const renderIcon = (iconName: string, className: string = "h-5 w-5") => {
    const iconMap = {
      'GraduationCap': GraduationCap,
      'Users': Users,
      'Heart': Heart,
      'Building': Building,
      'School': School,
      'Home': Home,
      'PenTool': PenTool,
      'BookOpen': BookOpen,
      'Calculator': Calculator,
      'Target': Target,
      'HelpCircle': HelpCircle,
      'Lightbulb': Lightbulb,
      'ClipboardList': ClipboardList,
      'BarChart3': BarChart3,
      'Phone': Phone,
      'TrendingUp': TrendingUp
    }

    const IconComponent = iconMap[iconName as keyof typeof iconMap]
    return IconComponent ? <IconComponent className={className} /> : <span className="text-lg font-bold">{iconName}</span>
  }

  // Helper functions for generating quick replies
  const generateBoardQuickReplies = (): QuickReply[] => {
    const allBoards = [
      { id: 'cbse', text: 'CBSE', value: 'cbse', icon: 'Building' },
      { id: 'icse', text: 'ICSE', value: 'icse', icon: 'School' },
      { id: 'state_board', text: 'State Board', value: 'state_board', icon: 'Home' }
    ]

    // Filter boards based on subscription access
    if (subscriptionData && subscriptionData.access.boards.length > 0) {
      const accessibleBoards = subscriptionData.access.boards.map(b => b.toLowerCase())
      return allBoards.filter(board => accessibleBoards.includes(board.value))
    }

    return allBoards
  }

  const getBoardDisplayName = (board: EducationBoard): string => {
    const boardNames = {
      cbse: 'CBSE',
      icse: 'ICSE',
      state_board: 'State Board'
    }
    return boardNames[board]
  }

  const generateClassQuickReplies = (role: UserRole, board?: EducationBoard): QuickReply[] => {
    const primaryClasses = [
      { id: 'class_1', text: 'Class 1', value: 'Class 1', icon: '1' },
      { id: 'class_2', text: 'Class 2', value: 'Class 2', icon: '2' },
      { id: 'class_3', text: 'Class 3', value: 'Class 3', icon: '3' },
      { id: 'class_4', text: 'Class 4', value: 'Class 4', icon: '4' },
      { id: 'class_5', text: 'Class 5', value: 'Class 5', icon: '5' }
    ]

    const middleClasses = [
      { id: 'class_6', text: 'Class 6', value: 'Class 6', icon: '6' },
      { id: 'class_7', text: 'Class 7', value: 'Class 7', icon: '7' },
      { id: 'class_8', text: 'Class 8', value: 'Class 8', icon: '8' }
    ]

    const secondaryClasses = [
      { id: 'class_9', text: 'Class 9', value: 'Class 9', icon: '9' },
      { id: 'class_10', text: 'Class 10', value: 'Class 10', icon: '10' }
    ]

    const allClasses = Array.from({ length: 12 }, (_, i) => ({
      id: `class_${i + 1}`,
      text: `Class ${i + 1}`,
      value: `${i + 1}`,
      Icon: GraduationCap
    }))

    // For students without all-access, check subscription constraints
    if (role === 'student' && !hasAllSubjects && subscriptionData?.subscription) {
      // If user has specific class access, filter to only that class
      if (subscriptionData.subscription.purchased_class) {
        const purchasedClass = subscriptionData.subscription.purchased_class
        return allClasses.filter(cls => {
          const classNum = parseInt(cls.value.replace(/\D/g, ''))
          return classNum === purchasedClass
        })
      }
    }

    // For teachers and parents, show all accessible classes
    if (role === 'teacher' || role === 'parent') {
      return allClasses
    }

    // For students, show all accessible classes
    return allClasses
  }

  // Generate subject quick replies based on class level
  const generateSubjectQuickReplies = (classLevel: string): QuickReply[] => {
    // Parse class level to number
    const classNum = parseInt(classLevel.replace(/\D/g, ''));
    
    if (isNaN(classNum)) {
      return [];
    }

    // Safely get available subjects directly instead of relying on the hook's potentially stale closure state
    let subjects = getAvailableSubjects(classNum, userMedium || 'ENGLISH', userStream);
    
    // Filter by purchased subjects if user doesn't have access to all subjects
    if (!hasAllSubjects && purchasedSubjects && purchasedSubjects.length > 0) {
      const upperPurchased = purchasedSubjects.map(s => s.toUpperCase());
      subjects = subjects.filter(subject => 
        upperPurchased.includes(subject.toUpperCase()) || upperPurchased.includes('ALL')
      );
    }

    // Use centralized subjects config
    return subjects.map(subject => {
      const id = subject.toLowerCase().replace(/\s+/g, '_');
      const config = getSubjectById(id);
      
      return {
        id,
        text: config?.displayName || subject,
        value: subject,
        Icon: config?.Icon || FileText,
        action: 'select_subject'
      };
    });
  }

  const generateMenuQuickReplies = (role: UserRole): QuickReply[] => {
    const roleSpecificMenus: Record<UserRole, QuickReply[]> = {
      student: [
        { id: 'selfstudy_buddy', text: 'Selfstudy Buddy', value: 'selfstudy_buddy', Icon: PenTool },
        { id: 'explain_topic', text: 'Deep Dive', value: 'explain_topic', Icon: Layers },
        { id: 'exam_prep', text: 'Ace Your Exams', value: 'exam_prep', Icon: Trophy },
        { id: 'clear_doubts', text: 'Doubt Resolution', value: 'clear_doubts', Icon: CheckCircle },
        { id: 'study_tips', text: 'Virat Insights', value: 'study_tips', Icon: Sparkles },
        { id: 'book_structure', text: 'Let\'s Talk', value: 'book_structure', Icon: MessageCircle }
      ],
      teacher: [
        { id: 'lesson_planning', text: 'Lesson Planning', value: 'lesson_planning', Icon: ClipboardList },
        { id: 'teaching_resources', text: 'Teaching Resources', value: 'teaching_resources', Icon: BookOpen },
        { id: 'assessment_help', text: 'Assessment Help', value: 'assessment_help', Icon: BarChart3 },
        { id: 'curriculum_guidance', text: 'Curriculum Guidance', value: 'curriculum_guidance', Icon: GraduationCap },
        { id: 'classroom_management', text: 'Classroom Management', value: 'classroom_management', Icon: Users },
        { id: 'parent_communication', text: 'Parent Communication', value: 'parent_communication', Icon: Phone }
      ],
      parent: [
        { id: 'child_progress', text: 'Child\'s Progress', value: 'child_progress', Icon: TrendingUp },
        { id: 'home_support', text: 'Home Support Tips', value: 'home_support', Icon: Home },
        { id: 'curriculum_understanding', text: 'Understand Curriculum', value: 'curriculum_understanding', Icon: BookOpen },
        { id: 'parent_guidance', text: 'Parenting Guidance', value: 'parent_guidance', Icon: Heart },
        { id: 'homework_assistance', text: 'Homework Assistance', value: 'homework_assistance', Icon: PenTool },
        { id: 'school_communication', text: 'School Communication', value: 'school_communication', Icon: School }
      ]
    }

    return roleSpecificMenus[role] || roleSpecificMenus.student
  }

  const getMenuItemById = (id: string): MenuItem | undefined => {
    const allMenuItems: MenuItem[] = [
      // Student menus
      { id: 'selfstudy_buddy', title: 'Selfstudy Buddy', description: 'Get step-by-step guidance for your self-study and learning', intent: 'selfstudy_buddy' },
      { id: 'explain_topic', title: 'Deep Dive', description: 'Understand complex topics with clear explanations and examples', intent: 'explain_topic' },
      { id: 'exam_prep', title: 'Ace Your Exams', description: 'Prepare effectively for your upcoming exams', intent: 'exam_prep' },
      { id: 'clear_doubts', title: 'Doubt Resolution', description: 'Clear your doubts and misconceptions', intent: 'clear_doubts' },
      { id: 'study_tips', title: 'Virat Insights', description: 'Learn effective study techniques and strategies', intent: 'study_tips' },
      { id: 'book_structure', title: 'Let\'s Talk', description: 'Have a friendly conversation with your textbook', intent: 'book_structure' },

      // Teacher menus
      { id: 'lesson_planning', title: 'Lesson Planning', description: 'Create effective lesson plans aligned with curriculum', intent: 'lesson_planning' },
      { id: 'teaching_resources', title: 'Teaching Resources', description: 'Access teaching materials and resources', intent: 'teaching_resources' },
      { id: 'assessment_help', title: 'Assessment Help', description: 'Design assessments and evaluation methods', intent: 'assessment_help' },
      { id: 'curriculum_guidance', title: 'Curriculum Guidance', description: 'Get guidance on curriculum implementation', intent: 'curriculum_guidance' },
      { id: 'classroom_management', title: 'Classroom Management', description: 'Effective strategies for managing your classroom', intent: 'classroom_management' },
      { id: 'parent_communication', title: 'Parent Communication', description: 'Tips for effective parent-teacher communication', intent: 'parent_communication' },

      // Parent menus
      { id: 'child_progress', title: 'Child\'s Progress', description: 'Understand and track your child\'s academic progress', intent: 'child_progress' },
      { id: 'home_support', title: 'Home Support Tips', description: 'Learn how to support your child\'s learning at home', intent: 'home_support' },
      { id: 'curriculum_understanding', title: 'Understand Curriculum', description: 'Get insights into your child\'s curriculum and expectations', intent: 'curriculum_understanding' },
      { id: 'parent_guidance', title: 'Parenting Guidance', description: 'Receive guidance on educational parenting approaches', intent: 'parent_guidance' },
      { id: 'homework_assistance', title: 'Homework Assistance', description: 'Help your child with homework effectively', intent: 'homework_assistance' },
      { id: 'school_communication', title: 'School Communication', description: 'Navigate communication with teachers and school', intent: 'school_communication' }
    ]

    return allMenuItems.find(item => item.id === id)
  }

  // 🚀 PRIORITY 4: Visual Menu Action Cards Component
  const renderMenuActionCards = (role: UserRole) => {
    const menuItems = generateMenuQuickReplies(role)

    // Icon mapping for lucide-react icons
    const iconMap: Record<string, React.ElementType> = {
      'PenTool': PenTool,
      'BookOpen': BookOpen,
      'Calculator': Calculator,
      'Target': Target,
      'Trophy': Trophy,
      'HelpCircle': HelpCircle,
      'CheckCircle': CheckCircle,
      'Lightbulb': Lightbulb,
      'Sparkles': Sparkles,
      'Layers': Layers,
      'MessageCircle': MessageCircle,
      'ClipboardList': ClipboardList,
      'BarChart3': BarChart3,
      'GraduationCap': GraduationCap,
      'Users': Users,
      'Phone': Phone,
      'TrendingUp': TrendingUp,
      'Home': Home,
      'Heart': Heart,
      'School': School
    }

    // Gradient colors for each menu item
    const gradients = [
      'from-orange-500 to-red-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-purple-500 to-indigo-500',
      'from-pink-500 to-rose-500',
      'from-yellow-500 to-orange-500',
      'from-teal-500 to-green-500'
    ]

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {menuItems.map((menuItem, index) => {
          const IconComponent = menuItem.icon ? iconMap[menuItem.icon] : BookOpen
          const gradient = gradients[index % gradients.length]
          const fullMenuItem = getMenuItemById(menuItem.id)

          return (
            <motion.div
              key={menuItem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                onClick={() => handleMenuSelection(menuItem.value)}
                className="group cursor-pointer h-full border-2 border-orange-200/60 dark:border-orange-700/60 hover:border-blue-400/80 dark:hover:border-blue-500/80 transition-all duration-300 hover:shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm overflow-hidden"
              >
                <CardContent className="p-4">
                  {/* Horizontal layout with icon and text */}
                  <div className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 leading-tight">
                        {menuItem.text}
                      </h3>
                    </div>
                  </div>

                  {/* Hover effect gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`}></div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    )
  }

  // 🚀 PRIORITY 2: Advanced Context Selector with Upgrade CTAs

  // Generate ALL context options (including locked ones for upsell)
  const generateContextOptions = (): {
    value: string
    label: string
    board: EducationBoard
    classLevel: string
    isLocked: boolean
    requiredPlan?: string
    requiredPlanPrice?: string
  }[] => {
    if (!subscriptionData)
      return []

    const options: {
      value: string
      label: string
      board: EducationBoard
      classLevel: string
      isLocked: boolean
      requiredPlan?: string
      requiredPlanPrice?: string
    }[] = []

    const { access, subscription } = subscriptionData

    // Define all possible boards and classes
    const allBoards: EducationBoard[] = ['cbse', 'icse', 'state_board']
    const allClasses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    // Get user's accessible boards and classes
    const accessibleBoards = access.boards.map(b => b.toLowerCase() as EducationBoard)

    // Calculate accessible classes based on subscription
    const accessibleClasses: number[] = []
    if (access.has_all_classes || subscription.class_access_type === 'all') {
      // User has access to all classes
      accessibleClasses.push(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    } else if (subscription.purchased_class) {
      // User has access to specific class only
      accessibleClasses.push(subscription.purchased_class)
    }

    // Generate all combinations with lock status
    allBoards.forEach(board => {
      allClasses.forEach(classNum => {
        const boardDisplay = getBoardDisplayName(board)
        const classDisplay = `Class ${classNum}`
        const value = `${board}-${classNum}`

        // Check if this combination is accessible
        const isBoardAccessible = accessibleBoards.includes(board)
        const isClassAccessible = accessibleClasses.includes(classNum)
        const isLocked = !isBoardAccessible || !isClassAccessible

        // Determine required plan for locked options
        let requiredPlan = ''
        let requiredPlanPrice = ''

        if (isLocked) {
          // If board is locked, need Pro plan (all boards)
          if (!isBoardAccessible) {
            requiredPlan = 'Pro'
            requiredPlanPrice = '₹999/mo'
          }
          // If only class is locked, need Classic or Pro
          else if (!isClassAccessible) {
            // If user has Basic/Classic (single class), suggest Pro for all classes
            if (subscription.plan_code === 'BASIC' || subscription.plan_code === 'BASIC_CBSE' ||
              subscription.plan_code === 'CLASSIC') {
              requiredPlan = 'Pro'
              requiredPlanPrice = '₹999/mo'
            } else {
              requiredPlan = 'Classic'
              requiredPlanPrice = '₹499/mo'
            }
          }
        }

        const label = isLocked
          ? `🔒 ${boardDisplay} ${classDisplay}`
          : `${boardDisplay} ${classDisplay}`

        options.push({
          value,
          label,
          board,
          classLevel: classDisplay,
          isLocked,
          requiredPlan,
          requiredPlanPrice
        })
      })
    })

    // Sort: unlocked first, then by board and class
    return options.sort((a, b) => {
      if (a.isLocked !== b.isLocked)
        return a.isLocked ? 1 : -1
      if (a.board !== b.board)
        return a.board.localeCompare(b.board)
      return parseInt(a.classLevel.replace(/\D/g, '')) - parseInt(b.classLevel.replace(/\D/g, ''))
    })
  }

  // Check if context selector should be visible (ALWAYS TRUE for monetization)
  const shouldShowContextSelector = (): boolean => {
    // Always show selector for all users to drive upgrades
    return !isLoadingSubscription && !!subscriptionData
  }

  // Get current context value for selector
  const getCurrentContextValue = (): string => {
    if (!conversationState.selectedBoard || !conversationState.selectedClass) {
      return ''
    }

    const classNum = conversationState.selectedClass.replace(/\D/g, '')
    return `${conversationState.selectedBoard}-${classNum}`
  }

  // State for upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false)
  const [upgradeModalData, setUpgradeModalData] = React.useState<{
    requiredPlan: string
    requiredPlanPrice: string
    selectedBoard: string
    selectedClass: string
  } | null>(null)

  // Handle context change from selector (with upgrade CTA for locked options)
  const handleContextChange = (value: string) => {
    const [board, classNum] = value.split('-')
    const classLevel = `Class ${classNum}`

    // Find the selected option to check if it's locked
    const options = generateContextOptions()
    const selectedOption = options.find(opt => opt.value === value)

    if (selectedOption?.isLocked) {
      // Show upgrade modal for locked options
      console.log('🔒 Locked option selected:', {
        board,
        class: classLevel,
        requiredPlan: selectedOption.requiredPlan,
        requiredPlanPrice: selectedOption.requiredPlanPrice
      })

      setUpgradeModalData({
        requiredPlan: selectedOption.requiredPlan || 'Pro',
        requiredPlanPrice: selectedOption.requiredPlanPrice || '₹999/mo',
        selectedBoard: getBoardDisplayName(board as EducationBoard),
        selectedClass: classLevel
      })
      setShowUpgradeModal(true)

      // Don't change context - keep current selection
      return
    }

    // Unlocked option - proceed with context switch
    console.log('🔄 Context switched:', {
      from: { board: conversationState.selectedBoard, class: conversationState.selectedClass },
      to: { board, class: classLevel }
    })

    // Update conversation state
    setConversationState(prev => ({
      ...prev,
      selectedBoard: board as EducationBoard,
      selectedClass: classLevel,
      context: {
        ...prev.context,
        educationBoard: board as EducationBoard,
        classLevel
      }
    }))

    // Save to localStorage for persistence
    try {
      localStorage.setItem('ai-tutor-last-context', value)
      console.log('💾 Context saved to localStorage:', value)
    } catch (error) {
      console.warn('Failed to save context to localStorage:', error)
    }
  }

  // Handle upgrade button click
  const handleUpgradeClick = () => {
    // Redirect to pricing page with context
    const board = upgradeModalData?.selectedBoard || ''
    const classLevel = upgradeModalData?.selectedClass || ''

    // Build URL with query parameters to preserve context
    const pricingPageUrl = `/dashboard/user/pricing?board=${encodeURIComponent(board)}&class=${encodeURIComponent(classLevel)}`

    console.log('🔄 Redirecting to pricing page:', pricingPageUrl)
    window.location.href = pricingPageUrl
  }

  // Load saved context from localStorage on mount
  useEffect(() => {
    if (!subscriptionData || !shouldShowContextSelector()) return

    try {
      const savedContext = localStorage.getItem('ai-tutor-last-context')
      if (savedContext) {
        const [board, classNum] = savedContext.split('-')
        const classLevel = `Class ${classNum}`

        // Validate that saved context is still valid for current subscription
        const options = generateContextOptions()
        const isValid = options.some(opt => opt.value === savedContext)

        if (isValid) {
          console.log('📂 Restored context from localStorage:', savedContext)
          setConversationState(prev => ({
            ...prev,
            selectedBoard: board as EducationBoard,
            selectedClass: classLevel,
            context: {
              ...prev.context,
              educationBoard: board as EducationBoard,
              classLevel
              // IMPORTANT: Preserve menuIntent and other context fields
            }
          }))
        } else {
          console.log('⚠️ Saved context is invalid for current subscription, clearing...')
          localStorage.removeItem('ai-tutor-last-context')
        }
      }
    } catch (error) {
      console.warn('Failed to load context from localStorage:', error)
    }
  }, [subscriptionData])

  const getQuickReplyDescription = (id: string): string | undefined => {
    const descriptions: Record<string, string> = {
      // Role descriptions
      'student': 'Get personalized help with your studies',
      'teacher': 'Access teaching resources and lesson planning tools',
      'parent': 'Support your child\'s educational journey',

      // Board descriptions
      'cbse': 'Central Board of Secondary Education curriculum',
      'icse': 'Indian Certificate of Secondary Education curriculum',
      'state_board': 'State-specific education board curriculum',

      // Class level descriptions (simplified)
      'class_1': 'First grade curriculum',
      'class_2': 'Second grade curriculum',
      'class_3': 'Third grade curriculum',
      'class_4': 'Fourth grade curriculum',
      'class_5': 'Fifth grade curriculum',
      'class_6': 'Sixth grade curriculum',
      'class_7': 'Seventh grade curriculum',
      'class_8': 'Eighth grade curriculum',
      'class_9': 'Ninth grade curriculum',
      'class_10': 'Tenth grade curriculum',
      'class_11': 'Eleventh grade curriculum',
      'class_12': 'Twelfth grade curriculum',

      // Menu descriptions
      'selfstudy_buddy': 'Step-by-step guidance for self-study',
      'explain_topic': 'Clear explanations with examples',
      'exam_prep': 'Effective preparation strategies',
      'clear_doubts': 'Clear misconceptions and doubts',
      'study_tips': 'Effective study techniques',
      'book_structure': 'Understand textbook organization and structure',
      'lesson_planning': 'Create curriculum-aligned lessons',
      'teaching_resources': 'Access educational materials',
      'assessment_help': 'Design effective evaluations',
      'curriculum_guidance': 'Implementation support',
      'classroom_management': 'Effective classroom strategies',
      'parent_communication': 'Parent-teacher communication tips',
      'child_progress': 'Track and understand development',
      'home_support': 'Support learning at home',
      'curriculum_understanding': 'Understand what your child learns',
      'parent_guidance': 'Educational parenting approaches',
      'homework_assistance': 'Help with homework effectively',
      'school_communication': 'Navigate school interactions',
      'system_management': 'Configure system settings',
      'user_support': 'Help users with issues',
      'analytics': 'View usage and performance data',
      'content_management': 'Manage educational resources',
      'user_management': 'Manage user accounts and permissions',
      'system_monitoring': 'Monitor system health and performance'
    }

    return descriptions[id]
  }

  const getPlaceholderText = (): string => {
    const { phase, selectedSubject, selectedMenuItem } = conversationState;
    const selectedMode = selectedMenuItem?.intent;

    // ── Most specific: actively chatting with a known subject ─────────────────
    if (selectedSubject && selectedMode) {
      return `Ask anything about ${selectedSubject}...`;
    }

    // ── Phase-based lookups ───────────────────────────────────────────────────
    switch (phase) {
      case "initial":
      case "initial_greeting":
      case "awaiting_role_selection":
      case "role_selected":
      case "board_selected":
      case "class_selected":
        return "Choose a subject to get started...";

      case "subject_selected":
        return selectedSubject
          ? `Choose how you'd like to study ${selectedSubject}...`
          : "Choose how you'd like to study...";

      case "chatting":
        return selectedSubject
          ? `Ask anything about ${selectedSubject}...`
          : "Ask anything about Class 9...";

      case "streaming":
        // Input is disabled while streaming, but show a relevant placeholder
        return "Waiting for response...";

      default:
        // Safe fallback — NEVER returns a fragment or empty string
        return "Ask anything about Class 9...";
    }
  }

  // Reset conversation to initial state
  const resetConversation = () => {
    console.log('🔄 [Reset] Resetting conversation...')

    // Cancel any ongoing requests first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Clear messages immediately
    setMessages([])

    // Clear input
    setInput('')

    // Reset other states
    setSelectedSubject('')
    setUploadedFile(null)
    setIsLoading(false)

    // CRITICAL FIX: If subscription is already loaded, go directly to subject selection
    // Otherwise, the page hangs at "Loading your subscription details..."
    if (subscriptionData && !isLoadingSubscription) {
      console.log('✅ [Reset] Subscription already loaded - going to subject selection')

      const subscription = subscriptionData.subscription
      const access = subscriptionData.access

      // Auto-populate board
      let autoBoard: EducationBoard | undefined
      if (subscription.purchased_board && subscription.purchased_board !== 'ALL') {
        autoBoard = subscription.purchased_board.toLowerCase() as EducationBoard
      } else if (access.boards.length === 1) {
        autoBoard = access.boards[0].toLowerCase() as EducationBoard
      } else if (access.has_full_access) {
        autoBoard = 'cbse' as EducationBoard
      }

      // Auto-populate class
      let autoClass: string | undefined
      if (subscription.purchased_class) {
        autoClass = `Class ${subscription.purchased_class}`
      } else if (!access.has_all_classes && access.classes.length === 1) {
        autoClass = `Class ${access.classes[0]}`
      } else if (access.has_all_classes) {
        autoClass = 'Class 9'
      }

      // Auto-populate role
      const autoRole: UserRole = 'student'

      // Reset conversation state with auto-populated data
      setConversationState({
        phase: 'class_selected', // Go directly to subject selection
        selectedRole: autoRole,
        selectedBoard: autoBoard,
        selectedClass: autoClass,
        selectedSubject: undefined,
        selectedMenuItem: undefined,
        hasUserSentFirstMessage: false,
        context: {
          userName: user?.name?.split(' ')[0] || 'there',
          userRole: autoRole,
          educationBoard: autoBoard,
          classLevel: autoClass,
          subject: undefined,
          menuIntent: undefined
        }
      })

      // Show subject selection message
      setTimeout(() => {
        const subjectMessage: Message = {
          id: `subject_selection_reset_${Date.now()}`,
          role: 'assistant',
          content: `Perfect! I'm ready to help you with ${autoBoard ? getBoardDisplayName(autoBoard) : ''} ${autoClass}. Which subject would you like to explore today?`,
          timestamp: new Date(),
          messageType: 'options',
          quickReplies: generateSubjectQuickReplies(autoClass || 'Class 9')
        }
        setMessages([subjectMessage])
        console.log('✅ [Reset] Subject selection displayed')
      }, 100)
    } else {
      // Subscription not loaded yet - reset to initial greeting
      console.log('⏳ [Reset] Subscription not loaded - showing initial greeting')

      setConversationState({
        phase: 'initial_greeting',
        selectedRole: undefined,
        selectedBoard: undefined,
        selectedClass: undefined,
        selectedSubject: undefined,
        selectedMenuItem: undefined,
        hasUserSentFirstMessage: false,
        context: {
          userName: user?.name?.split(' ')[0] || 'there',
          userRole: undefined,
          educationBoard: undefined,
          classLevel: undefined,
          subject: undefined,
          menuIntent: undefined
        }
      })
    }
  }

  return {
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
  };
}
