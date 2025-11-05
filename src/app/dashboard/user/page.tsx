'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  MessageSquare,
  BookOpen,
  Brain,
  TrendingUp,
  Heart,
  ArrowRight,
  Clock,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Activity,
  BookMarked,
  Trophy,
  Timer,
  Flame
} from 'lucide-react'
import { LoadingButton } from '@/components/ui/loading-button'

export default function UserDashboard() {
  const { user } = useUser()
  const router = useRouter()

  const quickActions = [
    {
      title: 'AI Tutor Chat',
      description: 'Get instant help with your studies',
      icon: MessageSquare,
      href: '/dashboard/user/ai-tutor',
      gradient: 'from-purple-500 to-indigo-600',
      highlight: 'AI Powered'
    },
    {
      title: 'Study Materials',
      description: 'Access your learning resources',
      icon: BookOpen,
      href: '/dashboard/user/materials',
      gradient: 'from-green-500 to-emerald-500',
      highlight: 'Comprehensive'
    },
    {
      title: 'Practest Engine',
      description: 'Take adaptive assessments',
      icon: Brain,
      href: '/dashboard/user/practest',
      gradient: 'from-blue-500 to-cyan-500',
      highlight: 'Smart Testing'
    },
    {
      title: 'Productivity Tools',
      description: 'Enhance your study efficiency',
      icon: TrendingUp,
      href: '/dashboard/user/productivity',
      gradient: 'from-orange-500 to-red-500',
      highlight: 'Efficiency'
    },
    {
      title: 'Dictionary',
      description: 'Comprehensive word reference',
      icon: BookMarked,
      href: '/dashboard/user/dictionary',
      gradient: 'from-pink-500 to-rose-500',
      highlight: 'Reference'
    },
    {
      title: 'Mitram Assessment',
      description: 'Personalized evaluation system',
      icon: Heart,
      href: '/dashboard/user/mitram',
      gradient: 'from-teal-500 to-blue-500',
      highlight: 'Personalized'
    }
  ]

  const userStats = [
    { label: 'Study Streak', value: '12', icon: Flame, color: 'text-orange-500', suffix: ' days' },
    { label: 'Courses Active', value: '5', icon: BookOpen, color: 'text-blue-500', suffix: '' },
    { label: 'AI Sessions', value: '47', icon: Brain, color: 'text-purple-500', suffix: '' },
    { label: 'Avg Score', value: '89', icon: Trophy, color: 'text-green-500', suffix: '%' }
  ]

  const learningStats = [
    { label: 'Completed', value: '24', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'In Progress', value: '8', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Achievements', value: '15', icon: Award, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Study Hours', value: '127', icon: Timer, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' }
  ]

  const recentActivities = [
    {
      title: 'Completed Math Chapter 5',
      description: 'Algebra and Functions',
      time: '2 hours ago',
      icon: CheckCircle2,
      score: '92%',
      progress: '100%'
    },
    {
      title: 'AI Tutor Session',
      description: 'Physics - Mechanics',
      time: '1 day ago',
      icon: MessageSquare,
      duration: '45 min'
    },
    {
      title: 'Practest Assessment',
      description: 'Chemistry Quiz',
      time: '2 days ago',
      icon: Brain,
      score: '85%'
    },
    {
      title: 'Study Material Review',
      description: 'Biology Notes',
      time: '3 days ago',
      icon: BookOpen,
      progress: '75%'
    }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      {/* Hero Header Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 py-16">
        <div className="absolute inset-0 bg-white/30 dark:bg-black/20 backdrop-blur-sm" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 rounded-full border border-orange-200/50 dark:border-blue-200/20 mb-6 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-orange-500 mr-2 animate-pulse" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Learning Dashboard</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome back, <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">{user?.firstName || 'Student'}</span>! 🎓
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Ready to continue your learning journey with AI-powered education?
            </p>

            {/* User Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {userStats.map((stat, index) => (
                <div key={index} className="text-center p-4 bg-white/20 dark:bg-gray-800/20 backdrop-blur-md rounded-xl border border-white/30 dark:border-gray-700/30 hover:bg-white/30 dark:hover:bg-gray-800/30 transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
                  <stat.icon className={`h-8 w-8 mx-auto mb-2 ${stat.color} animate-pulse`} />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}{stat.suffix}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Actions Section */}
        <section className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Your Learning <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Tools</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Access all your educational features and tools in one place
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {quickActions.map((action, index) => (
              <div key={index} className={`relative p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border border-gray-200 dark:border-gray-700 group overflow-hidden cursor-pointer`} onClick={() => router.push(action.href)}>
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${action.gradient} rounded-xl mb-6 shadow-lg`}>
                    <action.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <span className={`inline-block px-3 py-1 text-xs font-semibold bg-gradient-to-r ${action.gradient} text-white rounded-full mb-2`}>
                      {action.highlight}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{action.title}</h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{action.description}</p>
                  <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-orange-500 transition-colors duration-300">
                    <span>Access Now</span>
                    <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activities */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Activities</h2>
                    <p className="text-gray-600 dark:text-gray-300">Your latest learning progress</p>
                  </div>
                </div>
                <LoadingButton
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/user/profile')}
                  className="flex items-center gap-2"
                >
                  View Profile
                  <ArrowRight className="h-4 w-4" />
                </LoadingButton>
              </div>

              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 group cursor-pointer border border-gray-200 dark:border-gray-700">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                        <activity.icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {activity.title}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          {activity.time}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 mb-2">
                        {activity.description}
                      </p>
                      <div className="flex items-center space-x-4">
                        {activity.score && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Score: {activity.score}
                          </span>
                        )}
                        {activity.progress && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            Progress: {activity.progress}
                          </span>
                        )}
                        {activity.duration && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                            Duration: {activity.duration}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Learning Progress Sidebar */}
          <div className="space-y-8">
            {/* Learning Stats */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Learning Progress</h2>
                  <p className="text-gray-600 dark:text-gray-300">Track your journey</p>
                </div>
              </div>

              <div className="space-y-4">
                {learningStats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 ${stat.bgColor} rounded-xl flex items-center justify-center mr-3`}>
                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{stat.label}</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Access */}
            <div className="bg-gradient-to-br from-orange-500 to-blue-600 rounded-2xl shadow-lg p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Ready to Learn?</h3>
              <p className="text-white/90 mb-6">
                Continue your learning journey with our AI-powered tools
              </p>
              <LoadingButton
                variant="secondary"
                size="lg"
                onClick={() => router.push('/dashboard/user/ai-tutor')}
                className="w-full bg-white text-blue-600 hover:bg-gray-100"
              >
                Start AI Session
                <Brain className="h-5 w-5 ml-2" />
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
