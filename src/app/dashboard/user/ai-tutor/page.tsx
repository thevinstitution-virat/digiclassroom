'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import FormattedContent from '@/components/ai/FormattedContent'
import LessonPlanContainer from '@/components/lesson/LessonPlanContainer'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
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
import { MultiModalInput } from '@/components/ai-tutor/MultiModalInput'
import { voiceCommandsService } from '@/lib/services/voice-commands-service'

// Types
interface QuickReply {
  id: string
  text: string
  value: string
  icon?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  quickReplies?: QuickReply[]
  messageType?: 'text' | 'options' | 'confirmation' | 'voice' | 'error'
  fileAttachment?: {
    name: string
    size: number
    type: string
  }
  voiceCommand?: any
  isAgentResponse?: boolean
  agentType?: string
  sources?: Array<{
    id: string
    title: string
    chapter: string
    page: string | number
    subject: string
    class: string
    content_preview: string
    confidence: number
    content_type: string
    citation_validated?: boolean
    validation_errors?: string[]
    // Role-aware citation enhancements
    display_format?: 'student_friendly' | 'academic' | 'accessible'
    trust_indicator?: {
      level: 'high' | 'medium' | 'low'
      visual: string
      description: string
      userFriendlyExplanation: string
    }
    role_explanation?: string
    verification_level?: 'simplified' | 'detailed' | 'clear'
    language_adaptation?: {
      hindiTranslation?: string
      culturalContext?: string
      simplifiedExplanation?: string
    }
  }>
  metadata?: {
    total_results: number
    confidence: string
    search_time: number
    search_strategies: string[]
  }
  // Performance and routing metadata for feedback
  performanceMetrics?: {
    responseTimeMs?: number
    cacheHit?: boolean
    cacheType?: 'semantic' | 'openai' | 'pre-generated' | 'none'
    routeType?: string
    complexity?: string
    intentType?: string
    // RAGAS quality scores
    faithfulnessScore?: number
    relevanceScore?: number
    contextPrecisionScore?: number
    contextRecallScore?: number
  }
}

interface ConversationState {
  phase: 'initial_greeting' | 'awaiting_role_selection' | 'role_selected' | 'board_selected' | 'class_selected' | 'subject_selected' | 'menu_selected' | 'chatting'
  selectedRole?: UserRole
  selectedBoard?: EducationBoard
  selectedClass?: string
  selectedSubject?: string
  selectedMenuItem?: MenuItem
  hasUserSentFirstMessage: boolean
  context: {
    userName: string
    userRole?: UserRole
    educationBoard?: EducationBoard
    classLevel?: string
    subject?: string
    menuIntent?: string
  }
}

type UserRole = 'student' | 'teacher' | 'parent'
type EducationBoard = 'cbse' | 'icse' | 'state_board'

interface MenuItem {
  id: string
  title: string
  description: string
  intent: string
}

// Subscription types
interface SubscriptionData {
  subscription: {
    plan_name: string
    plan_code: string
    subscription_status: string
    purchased_board: string | null
    purchased_class: number | null
    class_access_type: string
    purchased_subjects: string[] | null
    daily_question_limit: number
    expiry_date: string
    monthly_price: number
  }
  quota: {
    daily_limit: number
    questions_asked: number
    questions_remaining: number
    can_ask_question: boolean
    message?: string
    percentage_used: number
  }
  access: {
    boards: string[]
    has_full_access: boolean
    has_all_classes: boolean
    has_all_subjects: boolean
  }
  is_trial: boolean
  is_active: boolean
  needs_upgrade: boolean
}

export default function AITutorPage() {
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [showFormattingMetadata, setShowFormattingMetadata] = useState(false)
  const [fileContent, setFileContent] = useState<string>('')
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [voiceCommand, setVoiceCommand] = useState<any>(null)

  // Subscription state
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  const [conversationState, setConversationState] = useState<ConversationState>({
    phase: 'initial_greeting',
    selectedRole: undefined,
    selectedBoard: undefined,
    selectedClass: undefined,
    selectedSubject: undefined,
    selectedMenuItem: undefined,
    hasUserSentFirstMessage: false,
    context: {
      userName: user?.firstName || 'there',
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

  // Fetch subscription data on page load
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) return

      try {
        setIsLoadingSubscription(true)
        setSubscriptionError(null)

        const response = await fetch('/api/user/subscription')

        if (!response.ok) {
          const errorData = await response.json()

          if (response.status === 404) {
            // No subscription found - show trial signup prompt
            setSubscriptionError('NO_SUBSCRIPTION')
          } else {
            setSubscriptionError(errorData.error || 'Failed to load subscription')
          }
          return
        }

        const data = await response.json()

        if (data.success && data.data) {
          setSubscriptionData(data.data)
          console.log('✅ Subscription loaded:', data.data.subscription.plan_name)

          // 🚀 PRIORITY 1: Auto-populate context from subscription data
          const subscription = data.data.subscription
          const access = data.data.access

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

          // Determine if we need subject selection
          // If user has all subjects or multiple subjects, show subject selection
          if (access.has_all_subjects || (subscription.purchased_subjects && subscription.purchased_subjects.length > 1)) {
            shouldShowSubjectSelection = true
            targetPhase = 'class_selected' // Will trigger subject selection
          }

          console.log('🎯 Auto-populating context:', {
            board: autoBoard,
            class: autoClass,
            role: autoRole,
            targetPhase,
            shouldShowSubjectSelection
          })

          // Update conversation state with auto-populated data
          setConversationState(prev => ({
            ...prev,
            phase: targetPhase,
            selectedRole: autoRole,
            selectedBoard: autoBoard,
            selectedClass: autoClass,
            context: {
              ...prev.context,
              userRole: autoRole,
              educationBoard: autoBoard,
              classLevel: autoClass
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
        }
      } catch (error) {
        console.error('❌ Error fetching subscription:', error)
        setSubscriptionError('FETCH_ERROR')
      } finally {
        setIsLoadingSubscription(false)
      }
    }

    fetchSubscription()
  }, [user])

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

I'm **Virat Gyankosh**, your AI educational companion. I'm here to help you with your learning journey with curriculum-aligned content.

Loading your subscription details...`,
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
            tenantId: user?.publicMetadata?.tenantId || 'demo-tenant-001',
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

      // Make API request
      const response = await makeAPIRequest(requestData)

      if (!response.ok) {
        // Handle subscription-related errors
        if (response.status === 429 || response.status === 403 || response.status === 401) {
          const errorData = await response.json().catch(() => ({}))

          let errorMessage = 'An error occurred. Please try again.'
          let showUpgradeButton = false

          switch (errorData.error) {
            case 'DAILY_LIMIT_EXCEEDED':
              errorMessage = errorData.message || 'You have reached your daily question limit. Please upgrade to continue.'
              showUpgradeButton = true
              break
            case 'BOARD_ACCESS_DENIED':
              errorMessage = errorData.message || `You don't have access to ${errorData.board} board. Please upgrade your subscription.`
              showUpgradeButton = true
              break
            case 'CLASS_ACCESS_DENIED':
              errorMessage = errorData.message || `You don't have access to Class ${errorData.class}. Please upgrade your subscription.`
              showUpgradeButton = true
              break
            case 'SUBJECT_ACCESS_DENIED':
              errorMessage = errorData.message || `You don't have access to ${errorData.subject}. Please upgrade your subscription.`
              showUpgradeButton = true
              break
            case 'AUTHENTICATION_REQUIRED':
              errorMessage = 'Please sign in to use the AI Tutor.'
              break
            default:
              errorMessage = errorData.message || 'An error occurred. Please try again.'
          }

          const errorMsg: Message = {
            id: `error_${Date.now()}`,
            role: 'assistant',
            content: errorMessage + (showUpgradeButton ? '\n\n[Click here to upgrade your subscription](/dashboard/user/upgrade)' : ''),
            timestamp: new Date(),
            messageType: 'error'
          }
          setMessages(prev => [...prev, errorMsg])

          // Refresh subscription data
          if (errorData.error === 'DAILY_LIMIT_EXCEEDED') {
            const refreshResponse = await fetch('/api/user/subscription')
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              if (refreshData.success) {
                setSubscriptionData(refreshData.data)
              }
            }
          }

          setIsLoading(false)
          return
        }

        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      // Capture response headers to identify agent responses
      const agentType = response.headers.get('X-Agent-Type')
      const isAgentResponse = !!agentType

      const requestStartTime = Date.now() // Track request start time for performance metrics

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isAgentResponse: isAgentResponse,
        agentType: agentType || undefined,
        sources: [], // Initialize sources array for citations
        metadata: undefined, // Initialize metadata for search information
        performanceMetrics: undefined // Initialize performance metrics for feedback
      }

      setMessages(prev => [...prev, assistantMessage])

      const decoder = new TextDecoder()
      let buffer = ''
      let lastUpdateTime = Date.now()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)

              // Handle streaming chunks (new format)
              if (parsed.type === 'chunk') {
                assistantMessage.content += parsed.content

                // Throttle UI updates to avoid excessive re-renders (max 60fps)
                const now = Date.now()
                if (now - lastUpdateTime > 16) { // ~60fps
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessage.id
                        ? { ...msg, content: assistantMessage.content }
                        : msg
                    )
                  )
                  lastUpdateTime = now
                }
              }
              // Handle complete message with sources (new format)
              else if (parsed.type === 'complete') {
                assistantMessage.content = parsed.answer
                assistantMessage.sources = parsed.sources?.sources || []
                assistantMessage.metadata = parsed.sources?.metadata || {}

                // Capture performance metrics for feedback widget
                const responseTimeMs = Date.now() - requestStartTime
                let cacheType: 'semantic' | 'openai' | 'pre-generated' | 'none' = 'none'
                if (parsed.semanticCached) cacheType = 'semantic'
                else if (parsed.preGenerated) cacheType = 'pre-generated'
                else if (parsed.cached) cacheType = 'openai'

                assistantMessage.performanceMetrics = {
                  responseTimeMs,
                  cacheHit: parsed.cached || parsed.preGenerated || parsed.semanticCached || false,
                  cacheType,
                  routeType: parsed.routing?.route,
                  complexity: parsed.routing?.complexity,
                  intentType: parsed.routing?.intent
                }

                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? {
                          ...msg,
                          content: assistantMessage.content,
                          sources: assistantMessage.sources,
                          metadata: assistantMessage.metadata,
                          performanceMetrics: assistantMessage.performanceMetrics
                        }
                      : msg
                  )
                )
                console.log('✅ Streaming complete (cached:', parsed.cached, ')')
                console.log('📚 Received sources:', assistantMessage.sources?.length || 0, 'citations')
                console.log('⚡ Performance:', responseTimeMs, 'ms, cache:', cacheType)
              }
              // Legacy format support (backward compatibility)
              else if (parsed.content) {
                assistantMessage.content += parsed.content
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: assistantMessage.content }
                      : msg
                  )
                )
              } else if (parsed.type === 'sources') {
                // Handle source citations (legacy format)
                assistantMessage.sources = parsed.sources || []
                assistantMessage.metadata = parsed.metadata || {}
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? { ...msg, sources: assistantMessage.sources, metadata: assistantMessage.metadata }
                      : msg
                  )
                )
                console.log('📚 Received sources:', parsed.sources?.length || 0, 'citations')
              }
            } catch (e) {
              // Ignore parsing errors for partial chunks
              console.debug('Failed to parse streaming data:', e)
            }
          }
        }
      }

      // Final update to ensure all content is displayed
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: assistantMessage.content,
                sources: assistantMessage.sources,
                metadata: assistantMessage.metadata
              }
            : msg
        )
      )

      // Clear uploaded file after successful send
      setUploadedFile(null)

      // Refresh subscription data to update quota
      try {
        const refreshResponse = await fetch('/api/user/subscription')
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          if (refreshData.success) {
            setSubscriptionData(refreshData.data)
            console.log('✅ Quota refreshed:', refreshData.data.quota)
          }
        }
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

      const response = await fetch('/api/admin/content/upload', {
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
        id: 'menu_selection',
        role: 'assistant',
        content: roleSpecificMenuMessage[conversationState.selectedRole!] || `Perfect! You've selected ${subject}. What would you like to do today?`,
        timestamp: new Date(),
        messageType: 'options',
        quickReplies: generateMenuQuickReplies(conversationState.selectedRole!)
      }

      console.log(`📋 Sending menu selection for ${conversationState.selectedRole}:`, menuSelectionMessage)
      setMessages(prev => [...prev, menuSelectionMessage])
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
        id: 'confirmation',
        role: 'assistant',
        content: `Excellent! I'm ready to help you with **${menuItem?.title}**.

${menuItem?.description}

Feel free to ask me any questions related to your studies. I'll provide detailed explanations tailored to your level and role.`,
        timestamp: new Date(),
        messageType: 'confirmation'
      }
      setMessages(prev => [...prev, confirmationMessage])
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

    const seniorClasses = [
      { id: 'class_11', text: 'Class 11', value: 'Class 11', icon: '11' },
      { id: 'class_12', text: 'Class 12', value: 'Class 12', icon: '12' }
    ]

    const allClasses = [...primaryClasses, ...middleClasses, ...secondaryClasses, ...seniorClasses]

    // Filter classes based on subscription access
    if (subscriptionData && !subscriptionData.access.has_all_classes) {
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
    // Define subjects available for each class level
    const subjectsByClass: Record<string, string[]> = {
      'Class 1': ['English', 'Hindi', 'Mathematics', 'Environmental Studies'],
      'Class 2': ['English', 'Hindi', 'Mathematics', 'Environmental Studies'],
      'Class 3': ['English', 'Hindi', 'Mathematics', 'Environmental Studies'],
      'Class 4': ['English', 'Hindi', 'Mathematics', 'Environmental Studies'],
      'Class 5': ['English', 'Hindi', 'Mathematics', 'Environmental Studies'],
      'Class 6': ['English', 'Hindi', 'Mathematics', 'Science', 'Geography', 'History', 'Sanskrit'],
      'Class 7': ['English', 'Hindi', 'Mathematics', 'Science', 'Geography', 'History', 'Sanskrit'],
      'Class 8': ['English', 'Hindi', 'Mathematics', 'Science', 'Geography', 'History', 'Sanskrit'],
      'Class 9': ['English', 'Hindi', 'Mathematics', 'Science', 'Geography', 'History', 'Political Science', 'Economics', 'Sanskrit'],
      'Class 10': ['English', 'Hindi', 'Mathematics', 'Science', 'Geography', 'History', 'Political Science', 'Economics', 'Sanskrit'],
      'Class 11': ['English', 'Hindi', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Political Science', 'History', 'Geography'],
      'Class 12': ['English', 'Hindi', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Political Science', 'History', 'Geography']
    }

    // Get subjects for the selected class, default to basic subjects
    let subjects = subjectsByClass[classLevel] || ['English', 'Hindi', 'Mathematics', 'Science']

    // Filter subjects based on subscription access
    if (subscriptionData && !subscriptionData.access.has_all_subjects) {
      // If user has specific subject access, filter to only those subjects
      if (subscriptionData.subscription.purchased_subjects &&
          subscriptionData.subscription.purchased_subjects.length > 0) {
        const purchasedSubjects = subscriptionData.subscription.purchased_subjects
        subjects = subjects.filter(subject =>
          purchasedSubjects.includes(subject) ||
          purchasedSubjects.includes('ALL')
        )
      }
    }

    // Add "All Subjects" option for cross-subject queries (only if user has access to multiple subjects)
    const subjectOptions = subjects.length > 1 ? ['All Subjects', ...subjects] : subjects

    return subjectOptions.map(subject => ({
      id: subject.toLowerCase().replace(/\s+/g, '_'),
      text: subject,
      value: subject === 'All Subjects' ? 'general' : subject,
      action: 'select_subject'
    }))
  }

  const generateMenuQuickReplies = (role: UserRole): QuickReply[] => {
    const roleSpecificMenus: Record<UserRole, QuickReply[]> = {
      student: [
        { id: 'homework_help', text: 'Homework Help', value: 'homework_help', icon: 'PenTool' },
        { id: 'explain_topic', text: 'Deep Dive', value: 'explain_topic', icon: 'Layers' },
        { id: 'exam_prep', text: 'Ace Your Exams', value: 'exam_prep', icon: 'Trophy' },
        { id: 'clear_doubts', text: 'Doubt Resolution', value: 'clear_doubts', icon: 'CheckCircle' },
        { id: 'study_tips', text: 'Virat Insights', value: 'study_tips', icon: 'Sparkles' },
        { id: 'book_structure', text: 'Let\'s Talk', value: 'book_structure', icon: 'MessageCircle' }
      ],
      teacher: [
        { id: 'lesson_planning', text: 'Lesson Planning', value: 'lesson_planning', icon: 'ClipboardList' },
        { id: 'teaching_resources', text: 'Teaching Resources', value: 'teaching_resources', icon: 'BookOpen' },
        { id: 'assessment_help', text: 'Assessment Help', value: 'assessment_help', icon: 'BarChart3' },
        { id: 'curriculum_guidance', text: 'Curriculum Guidance', value: 'curriculum_guidance', icon: 'GraduationCap' },
        { id: 'classroom_management', text: 'Classroom Management', value: 'classroom_management', icon: 'Users' },
        { id: 'parent_communication', text: 'Parent Communication', value: 'parent_communication', icon: 'Phone' }
      ],
      parent: [
        { id: 'child_progress', text: 'Child\'s Progress', value: 'child_progress', icon: 'TrendingUp' },
        { id: 'home_support', text: 'Home Support Tips', value: 'home_support', icon: 'Home' },
        { id: 'curriculum_understanding', text: 'Understand Curriculum', value: 'curriculum_understanding', icon: 'BookOpen' },
        { id: 'parent_guidance', text: 'Parenting Guidance', value: 'parent_guidance', icon: 'Heart' },
        { id: 'homework_assistance', text: 'Homework Assistance', value: 'homework_assistance', icon: 'PenTool' },
        { id: 'school_communication', text: 'School Communication', value: 'school_communication', icon: 'School' }
      ]
    }

    return roleSpecificMenus[role] || roleSpecificMenus.student
  }

  const getMenuItemById = (id: string): MenuItem | undefined => {
    const allMenuItems: MenuItem[] = [
      // Student menus
      { id: 'homework_help', title: 'Homework Help', description: 'Get step-by-step guidance for your homework assignments', intent: 'homework_help' },
      { id: 'explain_topic', title: 'Deep Dive', description: 'Understand complex topics with clear explanations and examples', intent: 'explain_topic' },
      { id: 'exam_prep', title: 'Ace Your Exams', description: 'Prepare effectively for your upcoming exams', intent: 'exam_prep' },
      { id: 'clear_doubts', title: 'Doubt Resolution', description: 'Clear your doubts and misconceptions', intent: 'clear_doubts' },
      { id: 'study_tips', title: 'Virat Insights', description: 'Learn effective study techniques and strategies', intent: 'study_tips' },

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
                className="group cursor-pointer h-full border-2 border-orange-200/60 hover:border-blue-400/80 transition-all duration-300 hover:shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden"
              >
                <CardContent className="p-4">
                  {/* Horizontal layout with icon and text */}
                  <div className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors duration-200 leading-tight">
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
    if (!subscriptionData) return []

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
      if (a.isLocked !== b.isLocked) return a.isLocked ? 1 : -1
      if (a.board !== b.board) return a.board.localeCompare(b.board)
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
      'homework_help': 'Step-by-step guidance for assignments',
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
    switch (conversationState.phase) {
      case 'initial_greeting':
      case 'awaiting_role_selection':
        return 'Please select your role using the buttons above...'
      case 'role_selected':
        return 'Please select your education board using the buttons above...'
      case 'board_selected':
        return 'Please select your class level using the buttons above...'
      case 'class_selected':
        return 'Please select your subject using the buttons above...'
      case 'subject_selected':
        return 'Please select what you\'d like to do using the buttons above...'
      case 'chatting':
        const role = conversationState.selectedRole
        const classLevel = conversationState.selectedClass
        const subject = conversationState.selectedSubject
        const subjectText = subject && subject !== 'general' ? ` ${subject}` : ''
        if (role === 'student') {
          return `Ask me anything about your ${classLevel}${subjectText} studies... Try: 'Explain the quadratic formula' or 'What is photosynthesis?'`
        } else if (role === 'teacher') {
          return `How can I help you with teaching ${classLevel}${subjectText}? Ask about lesson plans, resources, or teaching strategies...`
        } else if (role === 'parent') {
          return `How can I help you support your child's ${classLevel}${subjectText} education? Ask about curriculum, progress, or home support...`
        }
        return 'Ask me anything about education...'
      default:
        return 'Please complete the setup process...'
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
          userName: user?.firstName || 'there',
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
          userName: user?.firstName || 'there',
          userRole: undefined,
          educationBoard: undefined,
          classLevel: undefined,
          subject: undefined,
          menuIntent: undefined
        }
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        {/* Header */}
        <Card className="mb-3 bg-white/90 backdrop-blur-md border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-r from-orange-500/5 to-blue-500/5">
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
                      <span className={`text-sm font-semibold ${
                        subscriptionData.quota.percentage_used >= 80
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
                        className={`h-full transition-all duration-300 ${
                          subscriptionData.quota.percentage_used >= 80
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
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'online' ? 'bg-green-500' :
                    connectionStatus === 'offline' ? 'bg-red-500' :
                    'bg-yellow-500 animate-pulse'
                  }`}></div>
                  <span className={`${
                    connectionStatus === 'online' ? 'text-green-600' :
                    connectionStatus === 'offline' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {connectionStatus === 'online' ? 'Online' :
                     connectionStatus === 'offline' ? 'Offline' :
                     'Checking...'}
                  </span>
                </div>

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
          <Card className="mb-3 bg-blue-50/90 backdrop-blur-md border-blue-200 shadow-lg rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 text-sm">Loading subscription details...</span>
              </div>
            </CardContent>
          </Card>
        )}



        {subscriptionError && subscriptionError !== 'NO_SUBSCRIPTION' && (
          <Card className="mb-3 bg-red-50/90 backdrop-blur-md border-red-200 shadow-lg rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="font-semibold text-red-900">Error Loading Subscription</h3>
                  <p className="text-sm text-red-700">Please refresh the page or contact support if the issue persists.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat Interface */}
        <Card className="bg-white/90 backdrop-blur-md border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {/* Messages Area */}
            <div className="h-[calc(100vh-280px)] min-h-[400px] max-h-[600px] overflow-y-auto overflow-x-hidden p-6 space-y-6 bg-gradient-to-b from-gray-50/30 to-white/50">
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
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md ${
                        message.role === 'user'
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
                      <div className={`rounded-2xl px-4 py-3 shadow-sm backdrop-blur-sm overflow-hidden ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-2'
                          : 'bg-white border border-gray-200 text-gray-900 mr-2'
                      }`}>
                        <div className="flex-1">
                          {message.role === 'assistant' ? (
                            <div>
                              {message.isAgentResponse ? (
                                // Agent responses are already well-formatted, display directly
                                <div className="prose prose-sm max-w-none">
                                  <div className="whitespace-pre-wrap">{message.content}</div>
                                  {message.agentType && (
                                    <div className="text-xs text-gray-500 mt-2 flex items-center">
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
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <BookOpen className="h-3.5 w-3.5 text-blue-600" />
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

                              {/* REMOVED: Detailed sources section - too long and annoying for users */}
                              {false && message.sources && message.sources.length > 0 && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center">
                                      <BookOpen className="h-5 w-5 text-blue-600 mr-2" />
                                      <h4 className="text-sm font-semibold text-gray-900">Sources & References</h4>
                                    </div>
                                    {message.metadata && (
                                      <Badge variant="outline" className="text-xs">
                                        {message.metadata.total_results} sources • {message.metadata.confidence} confidence
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="space-y-3 overflow-hidden">
                                    {message.sources.map((source, index) => (
                                      <div key={source.id} className={`p-3 rounded-lg border transition-colors hover:border-blue-300 overflow-hidden ${
                                        source.display_format === 'student_friendly' ? 'bg-blue-50/90 border-blue-200' :
                                        source.display_format === 'academic' ? 'bg-green-50/90 border-green-200' :
                                        source.display_format === 'accessible' ? 'bg-purple-50/90 border-purple-200' :
                                        'bg-white border-gray-200'
                                      }`}>
                                        <div className="flex items-start gap-2">
                                          <Badge className="shrink-0 mt-0.5 text-xs">{index + 1}</Badge>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h5 className="font-medium text-gray-900 text-sm">{source.title}</h5>
                                              {source.trust_indicator && (
                                                <span className="text-base" title={source.trust_indicator.description}>
                                                  {source.trust_indicator.visual}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-gray-600 mb-2">
                                              <span className="font-medium">{source.chapter}</span>
                                              {source.page !== 'Unknown Page' && (
                                                <span> • Page {source.page}</span>
                                              )}
                                              <span> • {source.subject} {source.class}</span>
                                            </p>
                                            <p className="text-sm text-gray-700 italic line-clamp-2 break-words overflow-hidden">
                                              "{source.content_preview}"
                                            </p>

                                            {/* Role-specific explanation */}
                                            {source.role_explanation && (
                                              <div className="mt-2 p-2 bg-white/60 rounded text-gray-700">
                                                <div className="font-medium text-xs text-gray-600 mb-1">
                                                  {source.display_format === 'student_friendly' ? '📚 For Students:' :
                                                   source.display_format === 'academic' ? '👩‍🏫 For Teachers:' :
                                                   '👨‍👩‍👧‍👦 For Parents:'}
                                                </div>
                                                <div className="text-xs">{source.role_explanation}</div>
                                              </div>
                                            )}

                                            {/* Trust indicator explanation */}
                                            {source.trust_indicator && (
                                              <div className="mt-2 text-xs text-gray-600">
                                                <span className="font-medium">Reliability:</span> {source.trust_indicator.userFriendlyExplanation}
                                              </div>
                                            )}

                                            {/* Language adaptation */}
                                            {source.language_adaptation?.hindiTranslation && (
                                              <div className="mt-2 p-2 bg-orange-50/60 rounded">
                                                <div className="font-medium text-xs text-orange-700 mb-1">🇮🇳 हिंदी में:</div>
                                                <div className="text-xs text-orange-800">{source.language_adaptation.hindiTranslation}</div>
                                                {source.language_adaptation.culturalContext && (
                                                  <div className="text-xs text-orange-700 mt-1 italic">
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
                                    <div className="text-xs text-gray-500 mt-2 flex items-center">
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
                                        <div className={`grid gap-3 ${
                                          message.quickReplies.length <= 3
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
                                            focus:ring-2 focus:ring-blue-500/20 focus:outline-none ${
                                              message.quickReplies.length === 12
                                                ? 'min-h-[44px] p-2 text-xs' // Compact size for class selection (6×2 grid)
                                                : 'min-h-[36px] max-w-[200px] p-3' // Standard size for role/board selection
                                            }`}
                                          disabled={isLoading}
                                        >
                                          {message.quickReplies.length === 12 ? (
                                            // Simplified layout for class selection (6×2 grid)
                                            <div className="flex items-center justify-center w-full">
                                              <div className="font-semibold text-center leading-tight">
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
                                                <div className="font-semibold text-sm leading-tight truncate">
                                                  {quickReply.text}
                                                </div>
                                                {getQuickReplyDescription(quickReply.id) && (
                                                  <div className="text-xs text-gray-600 mt-1 opacity-80 leading-tight line-clamp-2">
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
                               message.id !== 'confirmation' &&
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

              {/* Loading Indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mr-3">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                        <span className="text-sm text-gray-600">Thinking...</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelMessage}
                          className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200/50 bg-gradient-to-r from-orange-50/20 to-blue-50/20 p-4">
              {/* File Upload Display */}
              {uploadedFile && (
                <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-blue-50 border border-orange-200/30 rounded-xl flex items-center justify-between backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-gray-800 font-medium">{uploadedFile.name}</span>
                    <span className="text-xs text-gray-600">
                      ({(uploadedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeUploadedFile}
                    className="h-6 w-6 p-0 text-orange-600 hover:text-red-500 rounded-lg"
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
                      <SelectTrigger className="w-56 h-11 bg-white/90 backdrop-blur-sm border-2 border-orange-200/60 hover:border-blue-400/80 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 focus:ring-2 focus:ring-blue-500/20">
                        <SelectValue placeholder="Select board & class" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border-2 border-orange-200/60 rounded-xl shadow-lg max-h-[400px]">
                        {/* Unlocked Options Section */}
                        {generateContextOptions().filter(opt => !opt.isLocked).length > 0 && (
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Your Access
                          </div>
                        )}
                        {generateContextOptions().filter(opt => !opt.isLocked).map(option => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="cursor-pointer hover:bg-gradient-to-r hover:from-orange-50/60 hover:to-blue-50/60 rounded-lg transition-colors duration-150 my-0.5"
                          >
                            <span className="font-medium text-gray-800">{option.label}</span>
                          </SelectItem>
                        ))}

                        {/* Locked Options Section - Upgrade CTA */}
                        {generateContextOptions().filter(opt => opt.isLocked).length > 0 && (
                          <>
                            <div className="px-2 py-1.5 mt-2 text-xs font-semibold text-orange-600 uppercase tracking-wide flex items-center">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Upgrade to Unlock
                            </div>
                            {generateContextOptions().filter(opt => opt.isLocked).slice(0, 8).map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="cursor-pointer hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 rounded-lg transition-colors duration-150 my-0.5 opacity-75"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium text-gray-600">{option.label}</span>
                                  <Badge variant="outline" className="ml-2 text-xs bg-gradient-to-r from-orange-100 to-blue-100 border-orange-300 text-orange-700">
                                    {option.requiredPlan}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                            {generateContextOptions().filter(opt => opt.isLocked).length > 8 && (
                              <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                                +{generateContextOptions().filter(opt => opt.isLocked).length - 8} more options available
                              </div>
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <span className="hidden sm:inline">Switch anytime</span>
                      {subscriptionData && (
                        <Badge variant="outline" className="ml-1 bg-gradient-to-r from-orange-50 to-blue-50 border-orange-200 text-orange-700 font-semibold">
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
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-orange-50 via-white to-blue-50 border-2 border-orange-200/60">
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
            <DialogDescription className="text-center text-gray-600 mt-2">
              Unlock access to <span className="font-semibold text-gray-800">{upgradeModalData?.selectedBoard} {upgradeModalData?.selectedClass}</span> and more!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Selection Info */}
            <div className="bg-white/80 backdrop-blur-sm border-2 border-orange-200/60 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="bg-gradient-to-r from-orange-100 to-blue-100 p-2 rounded-lg">
                  <Sparkles className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 mb-1">You're trying to access:</h4>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{upgradeModalData?.selectedBoard} {upgradeModalData?.selectedClass}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Plan Benefits */}
            <div className="bg-gradient-to-r from-orange-50 to-blue-50 border-2 border-orange-200/40 rounded-xl p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Sparkles className="h-4 w-4 mr-2 text-orange-600" />
                {upgradeModalData?.requiredPlan} Plan Benefits:
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
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
              <p className="text-xs text-gray-500 mt-1">Cancel anytime • No hidden fees</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="w-full sm:w-auto border-2 border-gray-300 hover:border-gray-400"
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
    </div>
  )
}
