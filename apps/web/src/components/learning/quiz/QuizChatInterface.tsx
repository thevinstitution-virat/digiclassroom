/**
 * VG Kosh Quiz Chat Interface
 * WhatsApp-style chat interface for interactive quizzes
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Progress } from '@/components/core/ui/progress'
import { 
  SpeakerWaveIcon, 
  HeartIcon,
  SparklesIcon,
  ClockIcon,
  TrophyIcon,
  FireIcon
} from '@heroicons/react/24/outline'
import { ChatMessage, QuizQuestion, TypingIndicator } from '@/lib/types/quiz'

interface QuizChatInterfaceProps {
  sessionId: string
  userId: string
  questionCount: number
  onQuizComplete: (result: any) => void
  onAnswerSubmit: (answer: string, questionId: string) => void
}

export default function QuizChatInterface({
  sessionId,
  userId,
  questionCount,
  onQuizComplete,
  onAnswerSubmit
}: QuizChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null)
  const [typingIndicator, setTypingIndicator] = useState<TypingIndicator>({ isVisible: false, message: '' })
  const [quizProgress, setQuizProgress] = useState({ current: 0, total: questionCount })
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isQuizActive, setIsQuizActive] = useState(true)
  const [quizData, setQuizData] = useState<any[]>([]) // Store all quiz questions and answers for review
  const [messageCounter, setMessageCounter] = useState(0) // Counter for unique message IDs

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Helper function to generate unique message IDs with better uniqueness
  const generateUniqueMessageId = (prefix: string = 'msg') => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    const id = `${prefix}-${timestamp}-${random}-${messageCounter}`
    setMessageCounter(prev => prev + 1)
    return id
  }

  // Reset quiz session state
  const resetQuizSession = () => {
    console.log('🔄 Resetting quiz session state')
    setMessages([])
    setCurrentQuestion(null)
    setQuizProgress({ current: 0, total: questionCount })
    setScore(0)
    setStreak(0)
    setTimeElapsed(0)
    setIsQuizActive(true)
    setQuizData([])
    setMessageCounter(0)
    startTimeRef.current = Date.now()
  }

  useEffect(() => {
    // Reset everything for new quiz session
    resetQuizSession()

    // Initialize quiz with welcome message
    setTimeout(() => initializeQuiz(), 100) // Small delay to ensure state is reset

    // Start timer
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionId, questionCount]) // Reset when sessionId or questionCount changes

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const initializeQuiz = async () => {
    // Clear any existing messages for new quiz session
    setMessages([])

    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: generateUniqueMessageId('welcome'),
      type: 'system',
      content: '🎯 नमस्ते! Welcome to VG Kosh Quiz Master! Ready to test your vocabulary knowledge? Let\'s make learning fun! 📚✨',
      timestamp: new Date(),
      isUser: false
    }

    setMessages([welcomeMessage])
    
    // Show typing indicator
    showTypingIndicator('Preparing your first question...')
    
    // Simulate loading and show first question
    setTimeout(() => {
      hideTypingIndicator()
      showNextQuestion()
    }, 2000)
  }

  const showTypingIndicator = (message: string) => {
    setTypingIndicator({ isVisible: true, message })
  }

  const hideTypingIndicator = () => {
    setTypingIndicator({ isVisible: false, message: '' })
  }

  const showNextQuestion = (questionNumber?: number) => {
    // Enhanced mock questions with variety
    const mockQuestions: QuizQuestion[] = [
      {
        id: `q-1`, wordId: 'word-1', categoryId: 'general', questionType: 'mcq',
        questionText: 'What does "serendipity" mean in Hindi?',
        options: ['संयोग से मिलना', 'दुर्भाग्य', 'योजना बनाना', 'समस्या'],
        correctAnswer: 'संयोग से मिलना',
        explanation: '"Serendipity" means finding something good unexpectedly. Like discovering a great book at a Delhi street market! 📖',
        culturalContext: 'In Indian context, serendipity often relates to unexpected discoveries during festivals or while exploring local markets.',
        hindiContext: 'संयोग से मिलना - जब कुछ अच्छा अचानक मिल जाए',
        difficultyLevel: 'medium', usageCount: 0, successRate: 0, isActive: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: `q-2`, wordId: 'word-2', categoryId: 'general', questionType: 'mcq',
        questionText: 'What does "ubiquitous" mean?',
        options: ['सर्वव्यापी (present everywhere)', 'दुर्लभ (rare)', 'सुंदर (beautiful)', 'कठिन (difficult)'],
        correctAnswer: 'सर्वव्यापी (present everywhere)',
        explanation: '"Ubiquitous" means present everywhere. Like how mobile phones have become ubiquitous in Indian cities and villages! 📱',
        culturalContext: 'Technology has made many things ubiquitous in modern India.',
        hindiContext: 'सर्वव्यापी - हर जगह मौजूद',
        difficultyLevel: 'medium', usageCount: 0, successRate: 0, isActive: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: `q-3`, wordId: 'word-3', categoryId: 'general', questionType: 'mcq',
        questionText: 'Which word means "extremely beautiful"?',
        options: ['magnificent', 'ordinary', 'simple', 'plain'],
        correctAnswer: 'magnificent',
        explanation: '"Magnificent" means extremely beautiful or impressive. Like the magnificent architecture of the Taj Mahal! 🏛️',
        culturalContext: 'India has many magnificent monuments and natural wonders.',
        hindiContext: 'शानदार - अत्यंत सुंदर',
        difficultyLevel: 'easy', usageCount: 0, successRate: 0, isActive: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: `q-4`, wordId: 'word-4', categoryId: 'general', questionType: 'mcq',
        questionText: 'What does "perseverance" mean in Hindi?',
        options: ['दृढ़ता (determination)', 'आलस्य (laziness)', 'भय (fear)', 'क्रोध (anger)'],
        correctAnswer: 'दृढ़ता (determination)',
        explanation: '"Perseverance" means persistence despite difficulties. Like students showing perseverance in their JEE/NEET preparation! 📚',
        culturalContext: 'Perseverance is highly valued in Indian culture and education.',
        hindiContext: 'दृढ़ता - कठिनाइयों के बावजूद भी लगे रहना',
        difficultyLevel: 'medium', usageCount: 0, successRate: 0, isActive: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: `q-5`, wordId: 'word-5', categoryId: 'general', questionType: 'mcq',
        questionText: 'What does "eloquent" mean?',
        options: ['वाक्पटु (fluent in speech)', 'मूक (silent)', 'अशिक्षित (uneducated)', 'भ्रमित (confused)'],
        correctAnswer: 'वाक्पटु (fluent in speech)',
        explanation: '"Eloquent" means fluent and persuasive in speaking. Like great Indian orators and leaders! 🎤',
        culturalContext: 'India has a rich tradition of eloquent speakers and debaters.',
        hindiContext: 'वाक्पटु - बोलने में निपुण',
        difficultyLevel: 'hard', usageCount: 0, successRate: 0, isActive: true, createdAt: new Date(), updatedAt: new Date()
      }
    ]

    // Use provided question number or current progress
    const currentQuestionNumber = questionNumber !== undefined ? questionNumber : quizProgress.current
    const questionIndex = currentQuestionNumber % mockQuestions.length
    const mockQuestion = mockQuestions[questionIndex]

    console.log(`🎯 Showing question ${currentQuestionNumber + 1}/${quizProgress.total}: ${mockQuestion.questionText}`)

    setCurrentQuestion(mockQuestion)

    const questionMessage: ChatMessage = {
      id: generateUniqueMessageId('question'),
      type: 'question',
      content: `📝 Question ${currentQuestionNumber + 1}/${quizProgress.total}\n\n${mockQuestion.questionText}`,
      timestamp: new Date(),
      isUser: false,
      questionData: mockQuestion
    }

    setMessages(prev => [...prev, questionMessage])
  }

  const handleAnswerSelect = async (selectedAnswer: string) => {
    if (!currentQuestion || !isQuizActive) return

    // Add user's answer to chat
    const userMessage: ChatMessage = {
      id: generateUniqueMessageId('user'),
      type: 'answer',
      content: selectedAnswer,
      timestamp: new Date(),
      isUser: true
    }

    setMessages(prev => [...prev, userMessage])

    // Show typing indicator for AI response
    showTypingIndicator('Checking your answer...')

    // Simulate API call delay
    setTimeout(() => {
      hideTypingIndicator()
      processAnswer(selectedAnswer)
    }, 1500)

    // Call parent handler
    onAnswerSubmit(selectedAnswer, currentQuestion.id)
  }

  const processAnswer = (userAnswer: string) => {
    if (!currentQuestion) return

    const isCorrect = userAnswer === currentQuestion.correctAnswer

    console.log(`📝 Processing answer for question ${quizProgress.current + 1}/${quizProgress.total}`)
    console.log(`🎯 User answered: ${userAnswer}`)
    console.log(`✅ Correct answer: ${currentQuestion.correctAnswer}`)
    console.log(`${isCorrect ? '🎉' : '❌'} Result: ${isCorrect ? 'Correct' : 'Incorrect'}`)

    // Store quiz data for review
    const questionData = {
      question: currentQuestion,
      userAnswer,
      isCorrect,
      questionNumber: quizProgress.current + 1
    }
    setQuizData(prev => [...prev, questionData])

    // Update score and streak
    if (isCorrect) {
      setScore(prev => prev + 10)
      setStreak(prev => prev + 1)
    } else {
      setStreak(0)
    }

    // Create result message
    const resultMessage: ChatMessage = {
      id: generateUniqueMessageId('result'),
      type: 'result',
      content: isCorrect ?
        `🎉 Correct! Well done! ✅\n\n${currentQuestion.explanation}` :
        `❌ Oops! The correct answer is: ${currentQuestion.correctAnswer}\n\n${currentQuestion.explanation}`,
      timestamp: new Date(),
      isUser: false,
      answerData: {
        userAnswer,
        isCorrect,
        explanation: currentQuestion.explanation,
        culturalContext: currentQuestion.culturalContext
      }
    }

    setMessages(prev => [...prev, resultMessage])

    // Update progress and get the new question number
    const newQuestionNumber = quizProgress.current + 1
    setQuizProgress(prev => ({ ...prev, current: newQuestionNumber }))

    // Check if quiz is complete
    if (newQuestionNumber >= quizProgress.total) {
      setTimeout(() => completeQuiz(), 2000)
    } else {
      // Show next question after delay with the correct question number
      setTimeout(() => {
        showTypingIndicator('Preparing next question...')
        setTimeout(() => {
          hideTypingIndicator()
          showNextQuestion(newQuestionNumber) // Pass the correct question number
        }, 1500)
      }, 3000)
    }
  }

  const completeQuiz = () => {
    setIsQuizActive(false)

    const completionMessage: ChatMessage = {
      id: generateUniqueMessageId('completion'),
      type: 'system',
      content: `🏁 Quiz Complete! 🎊\n\nYour Score: ${score}/${quizProgress.total * 10}\nAccuracy: ${Math.round((score / (quizProgress.total * 10)) * 100)}%\nTime: ${formatTime(timeElapsed)}\n\nGreat job! Keep practicing to improve your vocabulary! 📚✨`,
      timestamp: new Date(),
      isUser: false
    }

    setMessages(prev => [...prev, completionMessage])

    // Call completion handler with quiz data for review
    onQuizComplete({
      score,
      totalQuestions: quizProgress.total,
      timeElapsed,
      accuracy: Math.round((score / (quizProgress.total * 10)) * 100),
      quizData // Include all questions and answers for review
    })
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const playPronunciation = () => {
    // TODO: Implement audio playback
    console.log('Playing pronunciation...')
  }

  return (
    <div className="flex flex-col h-[600px] bg-gradient-to-b from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
      {/* Quiz Header */}
      <div className="flex items-center justify-between p-4 bg-green-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-green-600 font-bold text-lg">🎯</span>
          </div>
          <div>
            <h3 className="font-semibold">VG Kosh Quiz Master</h3>
            <p className="text-sm text-green-100">Interactive Vocabulary Quiz</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 text-sm">
            <ClockIcon className="h-4 w-4" />
            <span>{formatTime(timeElapsed)}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-green-200 dark:border-green-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress: {quizProgress.current}/{quizProgress.total}
          </span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <TrophyIcon className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">{score}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FireIcon className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">{streak}</span>
            </div>
          </div>
        </div>
        <Progress 
          value={(quizProgress.current / quizProgress.total) * 100} 
          className="h-2"
        />
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessageBubble 
            key={message.id} 
            message={message}
            onAnswerSelect={handleAnswerSelect}
            onPlayPronunciation={playPronunciation}
          />
        ))}
        
        {/* Typing Indicator */}
        {typingIndicator.isVisible && (
          <div className="flex items-center space-x-2">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3 max-w-xs">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">{typingIndicator.message}</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

// Chat Message Bubble Component
interface ChatMessageBubbleProps {
  message: ChatMessage
  onAnswerSelect: (answer: string) => void
  onPlayPronunciation: () => void
}

function ChatMessageBubble({ message, onAnswerSelect, onPlayPronunciation }: ChatMessageBubbleProps) {
  const isUser = message.isUser
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md ${isUser ? 'order-2' : 'order-1'}`}>
        <div className={`rounded-lg p-3 ${
          isUser 
            ? 'bg-green-600 text-white' 
            : message.type === 'system' 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
        }`}>
          <p className="text-sm whitespace-pre-line">{message.content}</p>
          
          {/* Question Options */}
          {message.type === 'question' && message.questionData && (
            <div className="mt-3 space-y-2">
              {message.questionData.options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => onAnswerSelect(option)}
                  className="w-full text-left justify-start bg-white hover:bg-green-50 border-green-300 text-gray-700"
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + index)})</span>
                  {option}
                </Button>
              ))}
              
              {/* Audio button for pronunciation */}
              <div className="flex justify-center mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPlayPronunciation}
                  className="text-green-600 hover:text-green-700"
                >
                  <SpeakerWaveIcon className="h-4 w-4 mr-1" />
                  Pronunciation
                </Button>
              </div>
            </div>
          )}
          
          {/* Answer Result */}
          {message.type === 'result' && message.answerData && (
            <div className="mt-2">
              {message.answerData.culturalContext && (
                <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900 rounded border border-orange-200 dark:border-orange-700">
                  <p className="text-xs text-orange-800 dark:text-orange-200">
                    🇮🇳 <strong>Cultural Context:</strong> {message.answerData.culturalContext}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

export { QuizChatInterface }
