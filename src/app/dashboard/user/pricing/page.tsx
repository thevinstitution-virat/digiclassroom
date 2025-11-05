'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Brain,
  Zap,
  Crown,
  Sparkles,
  Check,
  ArrowRight,
  Lock,
  BookOpen,
  MessageSquare,
  Target,
  TrendingUp,
  Award,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PricingPlan {
  id: string
  name: string
  planCode: string
  price: number
  period: string
  description: string
  dailyQuestions: number | string
  boardAccess: string
  classAccess: string
  features: string[]
  highlighted?: boolean
  popular?: boolean
  icon: React.ElementType
  gradient: string
  badge?: string
}

export default function AITutorPricingPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState<string>('classic')
  const [currentSubscription, setCurrentSubscription] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Get context from URL params (board/class that triggered upgrade)
  const suggestedBoard = searchParams.get('board')
  const suggestedClass = searchParams.get('class')

  useEffect(() => {
    // Fetch current subscription
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/user/subscription')
        if (response.ok) {
          const data = await response.json()
          setCurrentSubscription(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscription()
  }, [])

  const pricingPlans: PricingPlan[] = [
    {
      id: 'free-trial',
      name: 'Free Trial',
      planCode: 'FREE_TRIAL',
      price: 0,
      period: '7 days',
      description: 'Try all features with limited questions',
      dailyQuestions: '15 total',
      boardAccess: 'All boards',
      classAccess: 'All classes',
      features: [
        '15 questions total (not daily)',
        'Access to all boards (CBSE, ICSE, State)',
        'Access to all classes (1-12)',
        'All subjects included',
        'Valid for 7 days',
        'No credit card required'
      ],
      icon: Sparkles,
      gradient: 'from-gray-500 to-gray-600',
      badge: 'Try Free'
    },
    {
      id: 'basic',
      name: 'Basic',
      planCode: 'BASIC',
      price: 249,
      period: 'month',
      description: 'Perfect for focused learning in one class',
      dailyQuestions: 30,
      boardAccess: '1 board',
      classAccess: '1 class',
      features: [
        '30 questions per day',
        'Access to one board (CBSE/ICSE/State)',
        'Access to one class',
        'All subjects included',
        'Daily quota resets automatically',
        'Email support'
      ],
      icon: BookOpen,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'classic',
      name: 'Classic',
      planCode: 'CLASSIC',
      price: 499,
      period: 'month',
      description: 'More questions for dedicated learners',
      dailyQuestions: 60,
      boardAccess: '1 board',
      classAccess: '1 class',
      features: [
        '60 questions per day (2x Basic)',
        'Access to one board (CBSE/ICSE/State)',
        'Access to one class',
        'All subjects included',
        'Daily quota resets automatically',
        'Priority email support',
        'Advanced analytics'
      ],
      icon: MessageSquare,
      gradient: 'from-green-500 to-emerald-500',
      popular: true,
      badge: 'Popular'
    },
    {
      id: 'pro',
      name: 'Pro',
      planCode: 'PRO',
      price: 999,
      period: 'month',
      description: 'Ultimate flexibility for serious students',
      dailyQuestions: 150,
      boardAccess: '1 board',
      classAccess: 'All classes',
      features: [
        '150 questions per day (5x Basic)',
        'Access to one board (CBSE/ICSE/State)',
        'Access to ALL classes (1-12)',
        'All subjects included',
        'Switch between classes anytime',
        'Priority support with faster response',
        'Advanced analytics & insights',
        'Early access to new features'
      ],
      highlighted: true,
      icon: Crown,
      gradient: 'from-orange-500 to-blue-600',
      badge: 'Best Value'
    }
  ]

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
  }

  const handleSubscribe = (plan: PricingPlan) => {
    // TODO: Integrate with Razorpay/Stripe payment gateway
    console.log('Subscribe to plan:', plan.planCode)
    
    // For now, show alert
    alert(`Payment integration coming soon!\n\nSelected Plan: ${plan.name}\nPrice: ₹${plan.price}/${plan.period}\n\nThis will redirect to Razorpay payment gateway.`)
    
    // Future implementation:
    // 1. Create Razorpay order via API
    // 2. Open Razorpay checkout
    // 3. Handle payment success/failure
    // 4. Create subscription via API
  }

  const isCurrentPlan = (planCode: string) => {
    return currentSubscription?.subscription?.plan_code === planCode
  }

  const canUpgrade = (planPrice: number) => {
    if (!currentSubscription) return true
    const currentPrice = currentSubscription.subscription?.monthly_price || 0
    return planPrice > currentPrice
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-orange-500 to-blue-600 p-4 rounded-full">
                  <Brain className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent mb-4">
              AI Tutor Subscription Plans
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the perfect plan for your learning journey. All plans include access to our advanced AI tutor with personalized learning support.
            </p>
          </motion.div>

          {/* Context Alert - Show if user came from upgrade modal */}
          {suggestedBoard && suggestedClass && (
            <Alert className="mt-6 max-w-2xl mx-auto bg-gradient-to-r from-orange-50 to-blue-50 border-2 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-gray-700">
                You're trying to access <span className="font-semibold">{suggestedBoard} {suggestedClass}</span>. 
                Choose a plan below to unlock this content and more!
              </AlertDescription>
            </Alert>
          )}

          {/* Current Subscription Info */}
          {!isLoading && currentSubscription && (
            <div className="mt-6 inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm border-2 border-orange-200/60 rounded-xl px-4 py-2">
              <Badge className="bg-gradient-to-r from-orange-500 to-blue-600 text-white">
                Current Plan
              </Badge>
              <span className="font-semibold text-gray-800">
                {currentSubscription.subscription?.plan_name || 'Free Trial'}
              </span>
              <span className="text-gray-500">
                • {currentSubscription.quota?.questions_remaining || 0} questions remaining today
              </span>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative ${plan.highlighted ? 'lg:scale-105 z-10' : ''}`}
            >
              <Card className={`h-full border-2 transition-all duration-300 hover:shadow-xl ${
                plan.highlighted 
                  ? 'border-orange-300 shadow-lg' 
                  : 'border-gray-200 hover:border-orange-200'
              } ${selectedPlan === plan.id ? 'ring-2 ring-orange-500' : ''}`}>
                <CardHeader>
                  {/* Badge */}
                  {plan.badge && (
                    <Badge className={`absolute top-4 right-4 bg-gradient-to-r ${plan.gradient} text-white`}>
                      {plan.badge}
                    </Badge>
                  )}

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${plan.gradient} flex items-center justify-center mb-4`}>
                    <plan.icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Plan Name */}
                  <CardTitle className="text-2xl font-bold text-gray-800">
                    {plan.name}
                  </CardTitle>

                  {/* Price */}
                  <div className="mt-4">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                        ₹{plan.price}
                      </span>
                      <span className="text-gray-500 ml-2">/{plan.period}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <CardDescription className="mt-2 text-gray-600">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {/* Key Stats */}
                  <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Daily Questions:</span>
                      <span className="font-semibold text-gray-800">{plan.dailyQuestions}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Board Access:</span>
                      <span className="font-semibold text-gray-800">{plan.boardAccess}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Class Access:</span>
                      <span className="font-semibold text-gray-800">{plan.classAccess}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isCurrentPlan(plan.planCode) || (!canUpgrade(plan.price) && plan.price > 0)}
                    className={`w-full ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white'
                        : 'bg-white border-2 border-gray-300 hover:border-orange-400 text-gray-800'
                    } font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {isCurrentPlan(plan.planCode) ? (
                      <>Current Plan</>
                    ) : !canUpgrade(plan.price) && plan.price > 0 ? (
                      <>Downgrade Not Available</>
                    ) : (
                      <>
                        {plan.price === 0 ? 'Start Free Trial' : 'Subscribe Now'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
            Why Choose AI Tutor?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: 'Personalized Learning',
                description: 'AI adapts to your learning style and pace',
                gradient: 'from-orange-500 to-red-500'
              },
              {
                icon: TrendingUp,
                title: 'Track Progress',
                description: 'Monitor your improvement with detailed analytics',
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                icon: Award,
                title: 'Expert Content',
                description: 'Curriculum-aligned content by subject experts',
                gradient: 'from-purple-500 to-indigo-500'
              }
            ].map((feature, idx) => (
              <Card key={idx} className="border-2 border-gray-200 hover:border-orange-200 transition-all duration-300 hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-4`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ or Support */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Have questions? Need help choosing the right plan?
          </p>
          <Button variant="outline" className="border-2 border-orange-300 hover:border-orange-400">
            Contact Support
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

