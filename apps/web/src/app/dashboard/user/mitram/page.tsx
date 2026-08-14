/**
 * Mitram Dashboard - Psychological & Aptitude Assessment Platform
 * Sanskrit: मित्रम् (Friend) - A comprehensive assessment companion for Indian students
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Cpu,
  Heart,
  Lightbulb,
  Flag,
  Trophy,
  BarChart3,
  Clock,
  Users,
  BookOpen,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Brain,
  Target,
  Award,
  TrendingUp,
  Star,
  Zap,
  Settings,
  Puzzle,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react'
import { BalloonHunt } from '@/components/Mitram/AttentionTests/BalloonHunt'
import { ClientAssessmentEngine, AttentionResponse, BehaviorMetrics } from '@/lib/attention/ClientAssessmentEngine'

interface AssessmentModule {
  id: string
  name: string
  description: string
  duration: number
  icon: React.ComponentType<any>
  color: string
  available: boolean
  completed: boolean
  lastScore?: number
  lastTaken?: string
}

interface UserProgress {
  totalAssessments: number
  averageScore: number
  strongestArea: string
  weakestArea: string
  overallTrend: string
  moduleBreakdown: any[]
}

export default function MitramDashboard() {
  const [assessmentModules, setAssessmentModules] = useState<AssessmentModule[]>([])
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userGrade, setUserGrade] = useState(10)
  const [userBoard, setUserBoard] = useState('CBSE')
  const [currentAssessment, setCurrentAssessment] = useState<any>(null)
  const [userAge, setUserAge] = useState(15) // Should come from user profile
  const [assessmentProgress, setAssessmentProgress] = useState(0)
  const [clientEngine] = useState(() => new ClientAssessmentEngine())

  // Load initial data
  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Mock data for demo - All 5 assessment modules
      const mockModules = [
        {
          id: 'attention',
          name: 'TEA-Ch² Focus Check',
          description: 'Attention and focus assessment with selectivity, sustained attention, and switching tasks.',
          duration: 15,
          icon: Brain,
          color: 'from-purple-500 to-indigo-600',
          glowColor: 'shadow-purple-500/25',
          ageRange: [5, 15],
          available: true,
          completed: false
        },
        {
          id: 'grit',
          name: '8-Item Grit Scale',
          description: 'Perseverance and passion assessment for long-term goals and academic success.',
          duration: 20,
          icon: Heart,
          color: 'from-red-500 to-pink-600',
          glowColor: 'shadow-red-500/25',
          ageRange: [8, 18],
          available: true,
          completed: true,
          lastScore: 85,
          lastTaken: '2024-01-15'
        },
        {
          id: 'decision',
          name: 'ADMQ Decision Making',
          description: 'Decision-making style assessment under various academic and life scenarios.',
          duration: 25,
          icon: Lightbulb,
          color: 'from-yellow-500 to-orange-600',
          glowColor: 'shadow-yellow-500/25',
          ageRange: [12, 18],
          available: true,
          completed: false
        },
        {
          id: 'habit',
          name: 'Habit Change Inventory',
          description: 'Bad habit identification and change readiness assessment for better learning.',
          duration: 6,
          icon: Settings,
          color: 'from-green-500 to-emerald-600',
          glowColor: 'shadow-green-500/25',
          ageRange: [10, 18],
          available: true,
          completed: false
        },
        {
          id: 'aptitude',
          name: 'CogAT Mini Aptitude Test',
          description: 'Cognitive abilities assessment covering verbal, quantitative, and nonverbal domains.',
          duration: 15,
          icon: Puzzle,
          color: 'from-blue-500 to-cyan-600',
          glowColor: 'shadow-blue-500/25',
          ageRange: [6, 18],
          available: true,
          completed: false
        }
      ]

      const mockProgress = {
        totalAssessments: 15,
        averageScore: 78,
        strongestArea: 'Grit & Perseverance',
        weakestArea: 'Decision Making',
        overallTrend: 'Improving',
        moduleBreakdown: [
          { module: 'TEA-Ch² Focus Check', average: 82, interpretation: 'Above Average' },
          { module: '8-Item Grit Scale', average: 85, interpretation: 'Excellent' },
          { module: 'ADMQ Decision Making', average: 76, interpretation: 'Good' },
          { module: 'Habit Change Inventory', average: 79, interpretation: 'Good' },
          { module: 'CogAT Mini Aptitude Test', average: 81, interpretation: 'Above Average' }
        ]
      }

      setAssessmentModules(mockModules)
      setUserProgress(mockProgress)
      setNotifications([])

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartAssessment = async (moduleId: string) => {
    const module = assessmentModules.find(m => m.id === moduleId)
    if (module) {
      setActiveModule(moduleId)
      console.log(`Starting assessment: ${module.name}`)

      // Generate assessment based on module type
      if (moduleId === 'attention') {
        // Use client engine to generate game configuration
        const balloonHuntConfig = clientEngine.generateGameConfig('BALLOON_HUNT', userGrade, userAge)

        setCurrentAssessment({
          moduleId,
          subtest: {
            id: `balloon_hunt_${Date.now()}`,
            name: 'TEA-Ch² Balloon Hunt',
            type: 'selective',
            gameConfig: balloonHuntConfig
          },
          type: 'balloon_hunt'
        })
      }
    }
  }

  const handleAssessmentComplete = async (responses: AttentionResponse[], metrics: BehaviorMetrics) => {
    if (!currentAssessment) return

    try {
      console.log('Assessment completed:', {
        responses: responses.length,
        metrics,
        accuracy: responses.filter(r => r.correct).length / responses.length * 100
      })

      // Prepare assessment data for API with fallback values
      const assessmentData = {
        responses,
        behaviorMetrics: metrics,
        subtestId: currentAssessment.subtest.id,
        userGrade: userGrade || 8, // Fallback to grade 8
        userAge: userAge || 13 // Fallback to age 13
      }

      console.log('📤 Sending assessment data to API:', {
        responsesCount: responses.length,
        sampleResponse: responses[0],
        behaviorMetrics: metrics,
        subtestId: currentAssessment.subtest.id,
        userGrade,
        userAge
      })

      // Send assessment data to API for processing
      const response = await fetch('/api/mitram/attention/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assessmentData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        throw new Error(`API Error (${response.status}): ${errorData.error || 'Failed to process assessment'}`)
      }

      const result = await response.json()
      console.log('✅ Assessment results:', result)

      // Save assessment to localStorage for persistence
      if (result.success && result.assessment) {
        localStorage.setItem(`focus_check_${user?.id}`, JSON.stringify(result.assessment))
      }

      // Update module completion status
      setAssessmentModules(prev => prev.map(module =>
        module.id === currentAssessment.moduleId
          ? {
              ...module,
              completed: true,
              lastScore: Math.round(result.assessment.everydayIndex || 0),
              lastTaken: new Date().toISOString().split('T')[0]
            }
          : module
      ))

      // Reset assessment state
      setCurrentAssessment(null)
      setActiveModule(null)
      setAssessmentProgress(0)

      // Show results message
      const message = result.assessment.belowThreshold
        ? `Assessment completed! Score: ${Math.round(result.assessment.everydayIndex || 0)}%. Attention support recommended.`
        : `Assessment completed! Score: ${Math.round(result.assessment.everydayIndex || 0)}%. Great job!`

      alert(message)

      // Show Pomodoro recommendation
      if (result.pomodoroRecommendations) {
        const pomodoroMinutes = Math.round(result.pomodoroRecommendations.sessionDuration / 60)
        setTimeout(() => {
          alert(`🍅 Your personalized study session: ${pomodoroMinutes} minutes\n\n${result.pomodoroRecommendations.rationale}`)
        }, 1000)
      }

    } catch (error) {
      console.error('❌ Failed to process assessment results:', error)

      // Show detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Assessment completed, but there was an error processing the results:\n\n${errorMessage}\n\nPlease check the console for more details and try again.`)
    }
  }

  const handleAssessmentProgress = (progress: number) => {
    setAssessmentProgress(progress)
  }

  const formatLastTaken = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0)
  return 'Today'
    if (diffDays === 1)
  return 'Yesterday'
    if (diffDays < 7)
  return `${diffDays} days ago`
    if (diffDays < 30)
  return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  if (isLoading) {
    return (
      <div className="dcs">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-[#C0392B] to-[#FF6B35] rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">
                <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                  Loading Mitram Dashboard...
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Preparing your personalized psychological and aptitude assessment experience
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (activeModule && currentAssessment) {
    const module = assessmentModules.find(m => m.id === activeModule)

    // Render specific assessment based on type
    if (currentAssessment.type === 'balloon_hunt') {
      return (
        <BalloonHunt
          config={currentAssessment.subtest.gameConfig}
          onComplete={handleAssessmentComplete}
          onProgress={handleAssessmentProgress}
          grade={userGrade}
          age={userAge}
        />
      )
    }

    // Fallback for other assessment types
    return (
      <div className="dcs">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20 text-center max-w-2xl">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                  Assessment Module: {module?.name}
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                Loading assessment... Please wait.
              </p>
              <div className="flex items-center justify-center mb-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <Button
                onClick={() => {
                  setActiveModule(null)
                  setCurrentAssessment(null)
                }}
                className="px-8 py-3 h-12 bg-gradient-to-r from-[#C0392B] to-[#FF6B35] hover:from-[#A93226] hover:to-[#E8551C] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
              >
                <ArrowRight className="h-5 w-5 mr-2 rotate-180" />
                <span>Back to Dashboard</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dcs">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
              AI-Powered Psychological Assessment Platform
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent flex items-center justify-center gap-4">
              <Brain className="h-12 w-12 text-orange-500" />
              मित्रम् (Mitram)
            </span>
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Your comprehensive psychological and aptitude assessment companion designed for Indian students
          </p>
        </div>

        {/* Enhanced Sanskrit Shloka Card */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                Sanskrit Wisdom
              </span>
            </h2>
          </div>

          <div className="bg-gradient-to-r from-orange-50/50 to-blue-50/50 dark:from-orange-900/20 dark:to-blue-900/20 rounded-2xl p-8 border border-orange-200/30">
            <div className="text-center space-y-6">
              <div className="text-xl font-bold text-gray-800 dark:text-gray-200 leading-relaxed">
                पापान्निवारयति योजयते हिताय गुह्यं च गूहति गुणान् प्रकटीकरोति ।<br />
                आपद्गतं च न जहाति ददाति काले सन्मित्रलक्षणमिदं प्रवदन्ति सन्तः ॥
              </div>
              <div className="space-y-4">
                <div className="bg-white/60 dark:bg-gray-800/60 p-6 rounded-xl">
                  <p className="text-gray-700 dark:text-gray-300 italic leading-relaxed">
                    "He who restrains from sin, joins in what is beneficial, keeps secrets secret, reveals virtues,
                    does not abandon one in distress, and gives at the proper time—these are the marks of a true friend."
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 p-6 rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    जो पाप से रोकता है, हित में जोड़ता है, गुप्त बात गुप्त रखता है, गुणों को प्रकट करता है,
                    आपत्ति आने पर नहीं छोड़ता, और समय आने पर देता है—इन गुणों को सत्त्विक मित्र का लक्षण कहते हैं।
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Notifications */}
        {notifications.length > 0 && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-lg font-bold mb-2">
                <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                  {notifications.length} New Notification{notifications.length > 1 ? 's' : ''}
                </span>
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Check your assessment alerts and recommendations
              </p>
            </div>
          </div>
        )}

        {/* Enhanced Progress Overview */}
        {userProgress && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                    Your Assessment Journey
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Track your psychological and cognitive development over time
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-2xl border border-blue-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{userProgress.totalAssessments}</div>
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Assessments</div>
              </div>

              <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-2xl border border-green-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{userProgress.averageScore}</div>
                <div className="text-sm font-medium text-green-700 dark:text-green-300">Avg Score</div>
              </div>

              <div className="text-center p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 rounded-2xl border border-purple-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Star className="h-6 w-6 text-white" />
                </div>
                <div className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{userProgress.strongestArea}</div>
                <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Strongest</div>
              </div>

              <div className="text-center p-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-2xl border border-orange-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{userProgress.overallTrend}</div>
                <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Trend</div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Assessment Modules */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Cpu className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                  Assessment Modules
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Comprehensive psychological and aptitude assessments designed for Indian students
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {assessmentModules.map((module) => {
              const IconComponent = module.icon
              return (
                <div key={module.id} className={`relative p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border border-gray-200 dark:border-gray-700 group overflow-hidden`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  <div className="relative z-10">
                    <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${module.color} rounded-xl mb-6 shadow-lg ${module.glowColor}`}>
                      <IconComponent className="h-8 w-8 text-white" />
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {module.name}
                        </h3>
                        {module.completed && (
                          <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-5 w-5" />
                            <span className="text-sm font-medium">Completed</span>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                        {module.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-6">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{module.duration} minutes</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>Ages {module.ageRange[0]}-{module.ageRange[1]}</span>
                      </div>
                    </div>

                    {module.completed && module.lastScore && (
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
                        <div className="flex items-center space-x-2 text-green-700 dark:text-green-400">
                          <Trophy className="h-4 w-4" />
                          <span className="font-medium">Last Score: {module.lastScore}%</span>
                        </div>
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {formatLastTaken(module.lastTaken)}
                        </span>
                      </div>
                    )}

                    <Button
                      onClick={() => handleStartAssessment(module.id)}
                      disabled={!module.available}
                      className="w-full bg-gradient-to-r from-[#C0392B] to-[#FF6B35] hover:from-[#A93226] hover:to-[#E8551C] text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span>{module.completed ? 'Retake Assessment' : 'Start Assessment'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Enhanced Recent Results */}
        {userProgress && userProgress.moduleBreakdown && userProgress.moduleBreakdown.length > 0 && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                    Recent Assessment Results
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your latest performance across different modules
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userProgress.moduleBreakdown.map((result: any, index: number) => (
                <div key={index} className="p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                  <div className="w-10 h-10 mb-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {index + 1}
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{result.module}</h4>
                  <div className="text-3xl font-bold bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent mb-2">{result.average}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{result.interpretation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Educational Context */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-3xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                Designed for Indian Students
              </span>
            </h3>
            <div className="max-w-3xl mx-auto">
              <div className="bg-gradient-to-r from-orange-50/50 to-blue-50/50 dark:from-orange-900/20 dark:to-blue-900/20 rounded-2xl p-8 border border-orange-200/30">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                  Mitram assessments are culturally adapted for Indian educational contexts,
                  incorporating CBSE/ICSE curriculum alignment, bilingual support, and
                  age-appropriate norms for Indian students. Results help optimize your
                  learning journey for competitive exams like IIT-JEE, NEET, and board examinations.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl text-center">
                <div className="text-2xl mb-2">🇮🇳</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Indian Context</div>
              </div>
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl text-center">
                <div className="text-2xl mb-2">📚</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Curriculum Aligned</div>
              </div>
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl text-center">
                <div className="text-2xl mb-2">🧠</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Scientifically Validated</div>
              </div>
              <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl text-center">
                <div className="text-2xl mb-2">👨‍👩‍👧‍👦</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Family Friendly</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
