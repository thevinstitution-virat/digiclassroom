'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Rocket, Play, Brain, Database, Target, TrendingUp } from 'lucide-react'
import { LoadingButton } from '@/components/ui/loading-button'

export const SimpleLandingPage: React.FC = () => {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900" />
        <div className="absolute inset-0 bg-white/30 dark:bg-black/20 backdrop-blur-sm" />

        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 rounded-full border border-orange-200/50 dark:border-blue-200/20 mb-6 backdrop-blur-sm">
              <Zap className="h-4 w-4 text-orange-500 mr-2 animate-pulse" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Powered by Advanced AI & Machine Learning</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6">
            <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Digi Classroom</span>
            <br />
            <span className="text-4xl md:text-5xl">Next-Gen Learning Platform</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 italic underline decoration-orange-500 decoration-2 underline-offset-4">
            AI-Powered • Adaptive • Comprehensive
          </p>

          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
            Experience revolutionary education with our <strong>Agentic RAG AI system</strong>,
            advanced <em>e-Learning Practest engine</em>, and comprehensive CBSE curriculum coverage.
            Transform your learning journey with intelligent tutoring and adaptive assessments.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <LoadingButton 
              variant="primary" 
              size="lg" 
              onClick={() => router.push('/sign-up')} 
              className="px-8 py-4 text-lg font-semibold transform hover:scale-105 transition-all duration-300"
            >
              Start Learning Now
              <Rocket className="h-5 w-5 ml-2 animate-bounce" />
            </LoadingButton>
            <LoadingButton 
              variant="outline" 
              size="lg" 
              className="px-8 py-4 text-lg font-semibold transform hover:scale-105 transition-all duration-300"
            >
              <Play className="w-5 h-5 mr-2" />
              Explore Features
            </LoadingButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { label: 'AI Models', value: '5+', icon: Brain, color: 'text-purple-500' },
              { label: 'Question Bank', value: '50K+', icon: Database, color: 'text-blue-500' },
              { label: 'Success Rate', value: '98%', icon: Target, color: 'text-green-500' },
              { label: 'Learning Paths', value: '1000+', icon: TrendingUp, color: 'text-orange-500' }
            ].map((stat, index) => (
              <div key={index} className="text-center p-4 bg-white/20 dark:bg-gray-800/20 backdrop-blur-md rounded-xl border border-white/30 dark:border-gray-700/30 hover:bg-white/30 dark:hover:bg-gray-800/30 transition-all duration-300 transform hover:scale-105 hover:shadow-lg">
                <stat.icon className={`h-8 w-8 mx-auto mb-2 ${stat.color} animate-pulse`} />
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simple Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
            Platform <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Features</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
            Discover the cutting-edge technology that powers personalized learning experiences
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
              <Brain className="h-12 w-12 mx-auto mb-4 text-purple-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Agentic RAG AI System</h3>
              <p className="text-gray-600 dark:text-gray-300">Advanced retrieval-augmented generation with multiple search strategies</p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
              <Database className="h-12 w-12 mx-auto mb-4 text-blue-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">e-Learning Practest Engine</h3>
              <p className="text-gray-600 dark:text-gray-300">Comprehensive assessment system with adaptive testing</p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
              <Target className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Enhanced Question Bank</h3>
              <p className="text-gray-600 dark:text-gray-300">Hierarchical topic organization with metadata tagging</p>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-12 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Digi Classroom</h3>
          <p className="text-gray-300 mb-6">Revolutionizing education with AI-powered learning experiences</p>
          <p className="text-gray-400">© 2024 Digi Classroom. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
