'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Target, Trophy, Play, RotateCcw } from 'lucide-react'
import { useAttentionTracker } from '@/hooks/useAttentionTracker'
import { AttentionResponse, BehaviorMetrics, GameConfig } from '@/lib/attention/ClientAssessmentEngine'

interface Balloon {
  id: string
  type: 'target' | 'distractor'
  color: string
  x: number
  y: number
  size: number
  createdAt: number
}

interface BalloonHuntProps {
  config: GameConfig
  onComplete: (results: AttentionResponse[], metrics: BehaviorMetrics) => void
  onProgress: (progress: number) => void
  grade: number
  age: number
}

export const BalloonHunt: React.FC<BalloonHuntProps> = ({
  config,
  onComplete,
  onProgress,
  grade,
  age
}) => {
  const [gameState, setGameState] = useState<'instructions' | 'demo' | 'countdown' | 'active' | 'complete'>('instructions')
  const [currentBalloons, setCurrentBalloons] = useState<Balloon[]>([])
  const [responses, setResponses] = useState<AttentionResponse[]>([])
  const [score, setScore] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(config.duration || 120)
  const [countdown, setCountdown] = useState(3)
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number>(0)

  // Enhanced attention tracking
  const {
    trackGaze,
    trackClick,
    getMetrics,
    startTracking,
    stopTracking,
    resetTracking
  } = useAttentionTracker()

  // Initialize tracking when component mounts
  useEffect(() => {
    resetTracking()
  }, [resetTracking])

  // Auto-start game for testing (remove in production)
  useEffect(() => {
    if (gameState === 'instructions') {
      console.log('Component mounted, game state:', gameState)
    }
  }, [gameState])

  const startCountdown = useCallback(() => {
    setGameState('countdown')
    setCountdown(3)
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          startGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const startGame = useCallback(() => {
    console.log('Starting game...')
    setGameState('active')
    startTimeRef.current = Date.now()

    // Start attention tracking
    startTracking()

    // Generate initial balloons after a short delay to ensure game area is ready
    setTimeout(() => {
      if (gameAreaRef.current) {
        const area = gameAreaRef.current.getBoundingClientRect()
        const newBalloons: Balloon[] = []

        // Generate target balloons
        const targetCount = 1 + Math.floor(Math.random() * 2) // 1-2 targets
        for (let i = 0; i < targetCount; i++) {
          const color = config.colors?.[Math.floor(Math.random() * config.colors.length)] || 'red'
          newBalloons.push({
            id: `target_${Date.now()}_${i}`,
            type: 'target',
            color,
            x: Math.random() * Math.max(100, area.width - 80),
            y: Math.random() * Math.max(100, area.height - 80),
            size: config.targetSize === 'large' ? 60 : config.targetSize === 'small' ? 40 : 50,
            createdAt: Date.now()
          })
        }

        // Generate distractors
        const distractorCount = Math.floor(targetCount * (config.distractorRatio || 0.3))
        for (let i = 0; i < distractorCount; i++) {
          newBalloons.push({
            id: `distractor_${Date.now()}_${i}`,
            type: 'distractor',
            color: 'gray',
            x: Math.random() * Math.max(100, area.width - 60),
            y: Math.random() * Math.max(100, area.height - 60),
            size: 45,
            createdAt: Date.now()
          })
        }

        console.log('Generated initial balloons:', newBalloons)
        setCurrentBalloons(newBalloons)
      }
    }, 100)

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          completeGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Generate new balloons every 3-5 seconds
    const balloonInterval = setInterval(() => {
      console.log('Generating new balloons...')
      if (gameAreaRef.current) {
        const area = gameAreaRef.current.getBoundingClientRect()
        const newBalloons: Balloon[] = []

        // Generate target balloons
        const targetCount = 1 + Math.floor(Math.random() * 2)
        for (let i = 0; i < targetCount; i++) {
          const color = config.colors?.[Math.floor(Math.random() * config.colors.length)] || 'red'
          newBalloons.push({
            id: `target_${Date.now()}_${i}`,
            type: 'target',
            color,
            x: Math.random() * Math.max(100, area.width - 80),
            y: Math.random() * Math.max(100, area.height - 80),
            size: config.targetSize === 'large' ? 60 : config.targetSize === 'small' ? 40 : 50,
            createdAt: Date.now()
          })
        }

        // Generate distractors
        const distractorCount = Math.floor(targetCount * (config.distractorRatio || 0.3))
        for (let i = 0; i < distractorCount; i++) {
          newBalloons.push({
            id: `distractor_${Date.now()}_${i}`,
            type: 'distractor',
            color: 'gray',
            x: Math.random() * Math.max(100, area.width - 60),
            y: Math.random() * Math.max(100, area.height - 60),
            size: 45,
            createdAt: Date.now()
          })
        }

        setCurrentBalloons(newBalloons)
      }
    }, 3000 + Math.random() * 2000)

    return () => {
      clearInterval(timer)
      clearInterval(balloonInterval)
    }
  }, [startTracking, config])



  const handleBalloonClick = useCallback((balloon: Balloon, event: React.MouseEvent) => {
    console.log('🎈 Balloon clicked!', {
      balloonId: balloon.id,
      balloonType: balloon.type,
      currentResponsesCount: responses.length
    })

    const clickTime = Date.now()
    const reactionTime = clickTime - balloon.createdAt
    const sessionTime = clickTime - startTimeRef.current

    // Track click with enhanced attention tracker
    trackClick(event, balloon.type === 'target', reactionTime)

    const response: AttentionResponse = {
      stimulusId: balloon.id,
      stimulusType: balloon.type,
      responseTime: reactionTime,
      correct: balloon.type === 'target',
      timestamp: clickTime,
      screenPosition: { x: event.clientX, y: event.clientY },
      trialNumber: responses.length + 1,
      sessionTime
    }

    console.log('📝 Adding response:', response)
    setResponses(prev => {
      const newResponses = [...prev, response]
      console.log('📊 Updated responses count:', newResponses.length)
      return newResponses
    })

    if (balloon.type === 'target') {
      setScore(prev => prev + 1)
      // Remove clicked balloon
      setCurrentBalloons(prev => prev.filter(b => b.id !== balloon.id))

      // Show positive feedback
      showFeedback('correct', { x: event.clientX, y: event.clientY })
    } else {
      // Negative feedback for distractor
      showFeedback('incorrect', { x: event.clientX, y: event.clientY })
    }

    // Update progress
    const targetResponses = responses.filter(r => r.stimulusType === 'target').length + (balloon.type === 'target' ? 1 : 0)
    const progress = Math.min(95, (targetResponses / (config.targetCount || 20)) * 100)
    onProgress(progress)
  }, [responses, config.targetCount, onProgress, trackClick])

  const completeGame = useCallback(() => {
    console.log('🏁 Completing game...')
    setGameState('complete')

    // Stop attention tracking and get comprehensive metrics
    stopTracking()
    const attentionMetrics = getMetrics()

    console.log('📊 Game completion data:', {
      responsesCount: responses.length,
      sampleResponses: responses.slice(0, 3),
      attentionMetrics,
      score
    })

    // Convert attention metrics to behavior metrics format
    const metrics: BehaviorMetrics = {
      totalTime: attentionMetrics.totalTime,
      idleTime: attentionMetrics.idleTime / 1000, // Convert to seconds
      distractionEvents: attentionMetrics.distractionEvents,
      clickAccuracy: attentionMetrics.clickAccuracy / 100, // Convert to 0-1 scale
      responseVariability: attentionMetrics.responseVariability,
      engagementScore: attentionMetrics.engagementScore
    }

    console.log('📈 Final metrics:', metrics)
    onComplete(responses, metrics)
  }, [responses, onComplete, stopTracking, getMetrics, score])

  const showFeedback = (type: 'correct' | 'incorrect', position: { x: number, y: number }) => {
    // Create temporary feedback element
    const feedback = document.createElement('div')
    feedback.className = `fixed pointer-events-none z-50 text-2xl font-bold ${
      type === 'correct' ? 'text-green-500' : 'text-red-500'
    }`
    feedback.style.left = `${position.x - 20}px`
    feedback.style.top = `${position.y - 20}px`
    feedback.textContent = type === 'correct' ? '✓' : '✗'
    
    document.body.appendChild(feedback)
    
    setTimeout(() => {
      document.body.removeChild(feedback)
    }, 1000)
  }

  if (gameState === 'instructions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-2xl bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">🎈 Balloon Hunt</h2>
            <h3 className="text-2xl font-bold text-gray-600 mb-4">गुब्बारा शिकार</h3>
          </div>
          
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-xl p-6">
              <p className="text-lg text-gray-700 mb-3">
                <strong>English:</strong> Find and tap the colorful balloons as quickly as possible! 
                Ignore the gray balloons - they're just distractors.
              </p>
              <p className="text-lg text-gray-700">
                <strong>हिंदी:</strong> रंग-बिरंगे गुब्बारों को जल्दी से ढूंढें और उन पर टैप करें! 
                स्लेटी गुब्बारों को नज़रअंदाज़ करें।
              </p>
            </div>
            
            <div className="flex justify-center gap-8 py-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-400 rounded-full flex items-center justify-center text-white text-2xl mb-2 mx-auto">
                  🎈
                </div>
                <p className="text-green-600 font-semibold">✓ Tap These!</p>
                <p className="text-sm text-gray-600">रंगीन गुब्बारे</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-400 rounded-full flex items-center justify-center text-white text-2xl mb-2 mx-auto">
                  🎈
                </div>
                <p className="text-green-600 font-semibold">✓ Tap These!</p>
                <p className="text-sm text-gray-600">रंगीन गुब्बारे</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center text-white text-2xl mb-2 mx-auto">
                  ⚫
                </div>
                <p className="text-red-600 font-semibold">✗ Ignore These</p>
                <p className="text-sm text-gray-600">स्लेटी गुब्बारे</p>
              </div>
            </div>
            
            <div className="bg-yellow-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="h-5 w-5" />
                <span className="font-semibold">Time: {Math.floor(config.duration! / 60)} minutes</span>
                <span className="ml-4">समय: {Math.floor(config.duration! / 60)} मिनट</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => setGameState('demo')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Practice First / पहले अभ्यास करें
            </button>
            <button
              onClick={startCountdown}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-105"
            >
              <Play className="h-5 w-5 inline mr-2" />
              Start Test / टेस्ट शुरू करें
            </button>
          </div>

          {/* Debug: Quick start button for testing */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  console.log('Quick start clicked')
                  startGame()
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
              >
                🚀 Quick Start (Debug)
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'countdown') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            key={countdown}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-8xl font-bold text-blue-600 mb-4"
          >
            {countdown}
          </motion.div>
          <p className="text-2xl text-gray-600">Get Ready! / तैयार हो जाओ!</p>
        </div>
      </div>
    )
  }

  if (gameState === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-2">Great Job! 🎉</h3>
          <h4 className="text-2xl font-bold text-gray-600 mb-4">बहुत बढ़िया!</h4>
          <p className="text-xl text-gray-700 mb-6">
            You found <span className="font-bold text-blue-600">{score}</span> balloons!
          </p>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-gray-600">Processing your results...</p>
            <p className="text-gray-600">आपके परिणाम संसाधित हो रहे हैं...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Game Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Target className="h-5 w-5" />
              <span className="font-semibold">Score: {score}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-600">
              <Trophy className="h-5 w-5" />
              <span className="font-semibold">Accuracy: {responses.length > 0 ? Math.round((responses.filter(r => r.correct).length / responses.length) * 100) : 0}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-5 w-5" />
            <span className="font-semibold text-lg">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (1 - timeRemaining / config.duration!) * 100)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className="relative h-[calc(100vh-120px)] overflow-hidden cursor-crosshair bg-gradient-to-br from-blue-50 to-purple-50"
        onMouseMove={trackGaze}
      >
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded text-sm z-50">
            <div>Game State: {gameState}</div>
            <div>Balloons: {currentBalloons.length}</div>
            <div>Responses: {responses.length}</div>
            <div>Score: {score}</div>
            <div>Time: {timeRemaining}s</div>
          </div>
        )}

        <AnimatePresence>
          {currentBalloons.map((balloon) => (
            <motion.div
              key={balloon.id}
              className={`absolute cursor-pointer select-none z-10 ${
                balloon.type === 'target' ? 'hover:scale-110' : 'hover:scale-105'
              }`}
              style={{
                left: balloon.x,
                top: balloon.y,
                width: balloon.size,
                height: balloon.size,
              }}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              whileTap={{ scale: 0.8 }}
              onClick={(e) => handleBalloonClick(balloon, e)}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg border-4"
                style={{
                  backgroundColor: balloon.type === 'target' ? balloon.color : '#9CA3AF',
                  borderColor: balloon.type === 'target' ? balloon.color : '#6B7280'
                }}
              >
                {balloon.type === 'target' ? '🎈' : '⚫'}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Fallback message if no balloons */}
        {gameState === 'active' && currentBalloons.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-600">
              <div className="text-2xl mb-2">🎈</div>
              <div>Looking for balloons...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
