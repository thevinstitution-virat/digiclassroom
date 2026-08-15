/**
 * VG Kosh Productivity Tools Page
 * Revolutionary productivity features for Indian students
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Clock,
  Shield,
  GraduationCap,
  BarChart3,
  Wifi,
  Sparkles,
  Play,
  Pause,
  Square,
  Bell,
  BookOpen,
  Trophy,
  Target,
  Zap,
  Brain,
  Users,
  TrendingUp,
  Star,
  Award
} from 'lucide-react'

// Import productivity components
import CurricuTimer from '@/components/productivity/CurricuTimer'
import FocusShield from '@/components/productivity/FocusShield'
import FlashBharat from '@/components/productivity/FlashBharat'
import ParentPulse from '@/components/productivity/ParentPulse'
import OfflineOrbit from '@/components/productivity/OfflineOrbit'
import MoodMentor from '@/components/productivity/MoodMentor'

export default function ProductivityPage() {
  const [selectedTool, setSelectedTool] = useState('overview')

  const productivityFeatures = [
    {
      id: 'curricutimer',
      name: 'CurricuTimer',
      description: 'Adaptive Pomodoro with CBSE/ICSE curriculum integration',
      icon: Clock,
      status: 'active',
      benefits: ['Grade-specific timing', 'Syllabus-aware scheduling', 'Exam countdown'],
      color: 'blue'
    },
    {
      id: 'focusshield',
      name: 'FocusShield',
      description: 'Smart focus mode with app-level distraction blocking',
      icon: Shield,
      status: 'active',
      benefits: ['Notification suppression', 'Emergency SOS', 'Whitelist control'],
      color: 'green'
    },
    {
      id: 'flashbharat',
      name: 'FlashBharat',
      description: 'Culturally-gamified active recall with Indian context',
      icon: GraduationCap,
      status: 'active',
      benefits: ['Cultural badges', 'Live quiz battles', 'Peer leaderboards'],
      color: 'purple'
    },
    {
      id: 'parentpulse',
      name: 'ParentPulse',
      description: 'Parent & teacher dashboard with progress insights',
      icon: BarChart3,
      status: 'active',
      benefits: ['Study analytics', 'SMS notifications', 'Progress reports'],
      color: 'orange'
    },
    {
      id: 'offlineorbit',
      name: 'OfflineOrbit',
      description: 'Offline-first architecture for low-bandwidth areas',
      icon: Wifi,
      status: 'active',
      benefits: ['Works offline', 'Auto-sync', 'Low bandwidth'],
      color: 'indigo'
    },
    {
      id: 'moodmentor',
      name: 'MoodMentor',
      description: 'AI-driven study coach with mood-aware scheduling',
      icon: Sparkles,
      status: 'active',
      benefits: ['Mood tracking', 'AI coaching', 'Adaptive scheduling'],
      color: 'pink'
    }
  ]

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'border-primary/30 bg-primary/10',
      green: 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800',
      purple: 'border-primary/30 bg-primary/10',
      orange: 'border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800',
      indigo: 'border-primary/30 bg-primary/10',
      pink: 'border-primary/30 bg-primary/10'
    }
    return colorMap[color as keyof typeof colorMap] || colorMap.blue
  }

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Enhanced Hero Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-[#C0392B] to-[#FF6B35] rounded-2xl flex items-center justify-center shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
              Revolutionary Productivity Tools
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            🇮🇳 Designed specifically for Indian students with cultural context and curriculum integration
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-cyan-50/50 dark:from-primary/20 dark:to-cyan-950/20 rounded-2xl border border-primary/20">
            <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-primary to-cyan-500 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2 text-foreground">Smart Timing</h3>
            <p className="text-muted-foreground">
              Grade-specific Pomodoro sessions with curriculum integration
            </p>
          </div>
          <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-primary/10 dark:from-primary/20 dark:to-primary/20 rounded-2xl border border-primary/20">
            <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2 text-foreground">Cultural Learning</h3>
            <p className="text-muted-foreground">
              Indian context and gamification for better engagement
            </p>
          </div>
          <div className="text-center p-6 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-2xl border border-green-200/30">
            <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <Wifi className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-bold text-lg mb-2 text-foreground">Offline Ready</h3>
            <p className="text-muted-foreground">
              Works seamlessly in low-bandwidth areas across India
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Features Grid */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                Productivity Tools Suite
              </h2>
              <p className="text-muted-foreground">
                Choose from our comprehensive collection of productivity enhancers
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productivityFeatures.map((feature) => {
            const IconComponent = feature.icon
            return (
              <div
                key={feature.id}
                className="cursor-pointer p-6 bg-gradient-to-r from-white to-muted/40 dark:from-[var(--navy-deep)] dark:to-[var(--slate-blue)] border border-border/50 rounded-2xl hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                onClick={() => setSelectedTool(feature.id)}
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#C0392B] to-[#FF6B35] rounded-xl flex items-center justify-center shadow-lg">
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <Badge className="px-3 py-1 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-200 font-medium">
                      {feature.status}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{feature.name}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>

                <div className="space-y-3 mb-6">
                  {feature.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-[#C0392B] to-[#FF6B35] rounded-full"></div>
                      <span className="text-sm text-foreground font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full h-12 bg-gradient-to-r from-[#C0392B] to-[#FF6B35] hover:from-[#A93226] hover:to-[#E8551C] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
                  onClick={() => setSelectedTool(feature.id)}
                >
                  <span>Launch {feature.name}</span>
                  <Zap className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Enhanced Productivity Impact Stats */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
                Productivity Impact
              </h2>
              <p className="text-muted-foreground">
                How these tools boost your learning efficiency and academic performance
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-cyan-50 dark:from-primary dark:to-cyan-950 rounded-2xl border border-primary/20 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-primary to-cyan-500 rounded-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">40%</div>
            <div className="text-sm font-medium text-primary">Focus Improvement</div>
          </div>

          <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-2xl border border-green-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">60%</div>
            <div className="text-sm font-medium text-green-700 dark:text-green-300">Retention Boost</div>
          </div>

          <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-primary/10 dark:from-primary dark:to-primary rounded-2xl border border-primary/20 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">25%</div>
            <div className="text-sm font-medium text-primary">Time Savings</div>
          </div>

          <div className="text-center p-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-2xl border border-orange-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Star className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">80%</div>
            <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Student Satisfaction</div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderToolContent = () => {
    switch (selectedTool) {
      case 'curricutimer':
        return <CurricuTimer />
      case 'focusshield':
        return <FocusShield />
      case 'flashbharat':
        return <FlashBharat />
      case 'parentpulse':
        return <ParentPulse />
      case 'offlineorbit':
        return <OfflineOrbit />
      case 'moodmentor':
        return <MoodMentor />
      default:
        return renderOverview()
    }
  }

  return (
    <div className="dcs">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-primary/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent">
              Revolutionary Productivity Suite
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[#FF6B35] via-[#F5A623] to-[#FFD700] bg-clip-text text-transparent flex items-center justify-center gap-4">
              <Zap className="h-12 w-12 text-orange-500" />
              VG Kosh Productivity
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Revolutionary productivity tools designed specifically for Indian students with cultural context and curriculum integration
          </p>
        </div>

        {/* Enhanced Navigation */}
        {selectedTool !== 'overview' && (
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setSelectedTool('overview')}
                className="px-6 py-3 h-12 rounded-xl border-orange-200 hover:border-orange-400 hover:bg-orange-50 text-orange-600 font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
              >
                <BarChart3 className="h-5 w-5 mr-2" />
                <span>Back to Overview</span>
              </Button>
              <div className="flex items-center space-x-3">
                <Badge className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500/10 to-primary/10 text-orange-600 border-orange-200 font-medium">
                  {productivityFeatures.find(f => f.id === selectedTool)?.name}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {renderToolContent()}
      </div>
    </div>
  )
}
