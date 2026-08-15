'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Brain,
  Crown,
  Sparkles,
  Check,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Target,
  TrendingUp,
  Award,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Navbar } from '@/components/navigation/navbar'

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

export default function PublicPricingPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<string>('classic')

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
      gradient: 'from-muted-foreground/60 to-muted-foreground/70',
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
      gradient: 'from-primary to-cyan-500'
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
      gradient: 'from-orange-500 to-primary/80',
      badge: 'Best Value'
    }
  ]

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
  }

  const handleGetStarted = (plan: PricingPlan) => {
    // Redirect to sign-up page with plan information
    router.push(`/sign-up?plan=${plan.planCode}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-primary/10 dark:from-[var(--night-ink)] dark:via-[var(--navy-deep)] dark:to-[var(--night-ink)]">
      {/* Navigation */}
      <Navbar />

      <div className="container mx-auto px-4 py-12 max-w-7xl pt-24">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-primary/80 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-orange-500 to-primary/80 p-4 rounded-full">
                  <Brain className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 to-primary/80 bg-clip-text text-transparent mb-4">
              AI Tutor Subscription Plans
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the perfect plan for your learning journey. All plans include access to our advanced AI tutor with personalized learning support.
            </p>
          </motion.div>
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
                  ? 'border-orange-300 dark:border-orange-600 shadow-lg'
                  : 'border-border hover:border-orange-200 dark:hover:border-orange-600'
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
                  <CardTitle className="text-2xl font-bold text-foreground">
                    {plan.name}
                  </CardTitle>

                  {/* Price */}
                  <div className="mt-4">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-primary/80 bg-clip-text text-transparent">
                        ₹{plan.price}
                      </span>
                      <span className="text-muted-foreground ml-2">/{plan.period}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <CardDescription className="mt-2 text-muted-foreground">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {/* Key Stats */}
                  <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Daily Questions:</span>
                      <span className="font-semibold text-foreground">{plan.dailyQuestions}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Board Access:</span>
                      <span className="font-semibold text-foreground">{plan.boardAccess}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Class Access:</span>
                      <span className="font-semibold text-foreground">{plan.classAccess}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleGetStarted(plan)}
                    className={`w-full ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-orange-500 to-primary/80 hover:from-orange-600 hover:to-primary/80 text-white'
                        : 'bg-card border-2 border-input hover:border-orange-400 dark:hover:border-orange-500 text-foreground'
                    } font-semibold transition-all duration-200 transform hover:scale-105`}
                  >
                    {plan.price === 0 ? 'Start Free Trial' : 'Get Started'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-orange-600 to-primary/80 bg-clip-text text-transparent">
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
                gradient: 'from-primary to-cyan-500'
              },
              {
                icon: Award,
                title: 'Expert Content',
                description: 'Curriculum-aligned content by subject experts',
                gradient: 'from-primary to-primary/80'
              }
            ].map((feature, idx) => (
              <Card key={idx} className="border-2 border-border hover:border-orange-200 dark:hover:border-orange-600 transition-all duration-300 hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-4`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ or Support */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Have questions? Need help choosing the right plan?
          </p>
          <Button variant="outline" className="border-2 border-orange-300 dark:border-orange-600 hover:border-orange-400 dark:hover:border-orange-500 bg-card text-foreground hover:bg-orange-50 transition-all duration-200">
            Contact Support
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

