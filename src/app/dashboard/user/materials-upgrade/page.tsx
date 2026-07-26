'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown,
  Zap,
  BookOpen,
  Download,
  Users,
  Clock,
  Shield,
  Star,
  Check,
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  Award,
  Infinity,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'

interface PricingPlan {
  id: string
  name: string
  price: number
  originalPrice?: number
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  popular?: boolean
  icon: React.ElementType
  gradient: string
}

interface FeatureHighlight {
  icon: React.ElementType
  title: string
  description: string
  gradient: string
}

export default function MaterialsUpgradePage() {
  const { user } = useBetterAuthUser()
  const [selectedPlan, setSelectedPlan] = useState<string>('premium')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')

  const pricingPlans: PricingPlan[] = [
    {
      id: 'basic',
      name: 'Basic Access',
      price: 0,
      period: 'month',
      description: 'Essential study materials for getting started',
      features: [
        'Access to 100+ basic study materials',
        'Standard PDF downloads',
        'Basic search functionality',
        'Community support',
        'Mobile app access'
      ],
      icon: BookOpen,
      gradient: 'from-gray-500 to-gray-600'
    },
    {
      id: 'premium',
      name: 'Premium Plus',
      price: billingCycle === 'monthly' ? 299 : 2399,
      originalPrice: billingCycle === 'monthly' ? 499 : 3999,
      period: billingCycle === 'monthly' ? 'month' : 'year',
      description: 'Complete access to premium educational content',
      features: [
        'Unlimited access to 10,000+ premium materials',
        'HD video lectures and animations',
        'Interactive mind maps and diagrams',
        'Offline download capability',
        'AI-powered personalized recommendations',
        'Priority customer support',
        'Advanced analytics and progress tracking',
        'Exclusive CBSE exam preparation content'
      ],
      highlighted: true,
      popular: true,
      icon: Crown,
      gradient: 'from-orange-500 to-blue-600'
    },
    {
      id: 'ultimate',
      name: 'Ultimate Pro',
      price: billingCycle === 'monthly' ? 499 : 3999,
      originalPrice: billingCycle === 'monthly' ? 799 : 6399,
      period: billingCycle === 'monthly' ? 'month' : 'year',
      description: 'Everything you need for academic excellence',
      features: [
        'Everything in Premium Plus',
        'Live doubt-solving sessions',
        'One-on-one mentorship calls',
        'Custom study plans by experts',
        'Early access to new content',
        'Unlimited AI tutor interactions',
        'Advanced performance analytics',
        'Certificate of completion',
        'Career guidance sessions'
      ],
      icon: Zap,
      gradient: 'from-purple-500 to-pink-600'
    }
  ]

  const featureHighlights: FeatureHighlight[] = [
    {
      icon: Infinity,
      title: 'Unlimited Access',
      description: 'Access to our complete library of 10,000+ premium study materials, updated regularly',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Download,
      title: 'Offline Learning',
      description: 'Download materials for offline study. Perfect for areas with limited internet connectivity',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: Target,
      title: 'Personalized Content',
      description: 'AI-powered recommendations based on your learning style and academic performance',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      icon: Award,
      title: 'Expert Curated',
      description: 'Content created and reviewed by subject matter experts and experienced educators',
      gradient: 'from-purple-500 to-indigo-500'
    }
  ]

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
    // Handle plan selection logic here
    console.log('Selected plan:', planId)
  }

  const handleUpgrade = () => {
    // Handle upgrade logic here
    console.log('Upgrading to:', selectedPlan, billingCycle)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Premium Study Materials
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Unlock Your
            </span>
            <br />
            <span className="text-gray-900 dark:text-white">Academic Potential</span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Access premium study materials, expert-curated content, and advanced learning tools 
            designed to accelerate your academic success.
          </p>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {featureHighlights.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <Card className="h-full bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden group-hover:scale-105">
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center shadow-lg`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex justify-center mb-12"
        >
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-2 shadow-lg border border-white/20">
            <div className="flex items-center space-x-1">
              <Button
                variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-xl px-6 py-2 transition-all duration-200 ${
                  billingCycle === 'monthly'
                    ? 'bg-gradient-to-r from-orange-500 to-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </Button>
              <Button
                variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('yearly')}
                className={`rounded-xl px-6 py-2 transition-all duration-200 relative ${
                  billingCycle === 'yearly'
                    ? 'bg-gradient-to-r from-orange-500 to-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Save 40%
                </Badge>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Pricing Plans */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16"
        >
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative group ${plan.highlighted ? 'lg:scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-orange-500 to-blue-600 text-white px-4 py-2 rounded-full shadow-lg">
                    <Star className="h-4 w-4 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <Card className={`h-full bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden ${
                plan.highlighted ? 'ring-2 ring-orange-500/20' : ''
              }`}>
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${plan.gradient} flex items-center justify-center shadow-lg`}>
                    <plan.icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center space-x-2">
                      {plan.originalPrice && (
                        <span className="text-lg text-gray-400 line-through">
                          ₹{plan.originalPrice}
                        </span>
                      )}
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        ₹{plan.price}
                      </span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-300">
                      per {plan.period}
                    </span>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    onClick={() => handlePlanSelect(plan.id)}
                    className={`w-full h-12 rounded-xl font-semibold transition-all duration-200 ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200'
                    }`}
                  >
                    {plan.price === 0 ? 'Current Plan' : 'Choose Plan'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <Card className="bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-md border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Ready to Transform Your Learning?
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of students who have already upgraded their academic journey with our premium materials.
              </p>
              <Button
                onClick={handleUpgrade}
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Crown className="h-5 w-5 mr-2" />
                Upgrade Now
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
