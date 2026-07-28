'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, GraduationCap, BarChart3, Globe, Brain, ChevronDown, ChevronLeft, ChevronRight,
  Target, Zap, TrendingUp, ArrowRight, MessageSquare, Search, Database, Cpu, Lightbulb,
  Rocket, Mail, Phone, MapPin, Send, User, BookOpen, Shield, Users, Clock, Award,
  Heart, Star, CheckCircle, Facebook, Twitter, Instagram, Linkedin, Youtube, Check, Crown, Sparkles
} from 'lucide-react'
import { LoadingButton } from '@/components/core/ui/loading-button'
import { Navbar } from '@/components/core/navigation/navbar'

export const EnhancedLandingPage: React.FC = () => {
  const router = useRouter()
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeFaqCategory, setActiveFaqCategory] = useState<'students' | 'teachers' | 'parents'>('students')
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [counters, setCounters] = useState({ students: 0, satisfaction: 0, courses: 0, teachers: 0 })

  const heroRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const countersRef = useRef<HTMLDivElement>(null)

  const testimonials = [
    { id: 1, name: "Priya Sharma", grade: "Class 10", quote: "The AI tutor helped me understand complex math concepts in minutes. My grades improved from C to A+ in just 3 months!" },
    { id: 2, name: "Arjun Patel", grade: "Class 12", quote: "Practest's adaptive testing prepared me perfectly for boards. The personalized question bank was a game-changer!" },
    { id: 3, name: "Sneha Reddy", grade: "Class 9", quote: "Finally, a platform that understands how I learn! The visual content and interactive features made studying fun." }
  ]

  const faqCategories = {
    students: [
      { question: "How does Digi Classroom's AI tutoring system help me learn better?", answer: "Our advanced agentic RAG system combines multiple AI models with curriculum-specific content retrieval. It understands your learning style, adapts to your pace, and provides personalized explanations using Bloom's taxonomy classification for optimal comprehension." },
      { question: "What makes the e-Learning Practest assessment engine special?", answer: "Our Practest engine uses Computer Adaptive Testing (CAT) algorithms with T5/BART models for intelligent question generation. It maintains a comprehensive question bank with hierarchical topic organization and provides real-time performance analytics." },
      { question: "Can I track my learning progress and performance?", answer: "Yes! Digi Classroom provides comprehensive progress tracking with visual dashboards, performance analytics, learning streaks, XP points, and detailed insights into your strengths and areas for improvement." },
      { question: "Is the content aligned with my school curriculum?", answer: "Absolutely! All content is meticulously aligned with the latest CBSE curriculum for classes 9-12. Our database-driven approach ensures comprehensive coverage with metadata tagging for precise curriculum alignment across all subjects." },
      { question: "Can I access the platform offline?", answer: "Yes! Download lessons, practice materials, and assessments for offline access. Our OfflineOrbit feature ensures uninterrupted learning even without internet connectivity." }
    ],
    teachers: [
      { question: "How can I manage my classroom and students on Digi Classroom?", answer: "Our comprehensive teacher dashboard allows you to create and manage classes, assign homework, track student progress, generate detailed reports, and customize learning paths for individual students or groups." },
      { question: "What analytics and insights are available for educators?", answer: "Access detailed analytics including student performance metrics, engagement levels, learning patterns, assessment results, and curriculum coverage reports. All data is presented in easy-to-understand visualizations." },
      { question: "Can I create custom content and assessments?", answer: "Yes! Teachers can create custom lessons, quizzes, and assignments using our intuitive content creation tools. You can also modify existing content to match your teaching style and curriculum requirements." },
      { question: "How does the platform support different teaching methodologies?", answer: "Digi Classroom supports various teaching approaches including flipped classroom, blended learning, project-based learning, and traditional instruction methods with flexible content delivery options." },
      { question: "Is there professional development support for teachers?", answer: "We provide comprehensive training resources, webinars, documentation, and dedicated support to help teachers maximize the platform's potential and integrate it effectively into their teaching practice." }
    ],
    parents: [
      { question: "How can I monitor my child's learning progress and performance?", answer: "Parents get access to detailed progress reports, learning analytics, time spent studying, achievement badges, and performance trends. You can set up notifications for important milestones and achievements." },
      { question: "Is the platform safe and secure for my child?", answer: "Absolutely! Digi Classroom implements robust security measures including data encryption, privacy protection, content filtering, and compliance with educational data protection regulations to ensure a safe learning environment." },
      { question: "Can I set study schedules and screen time limits?", answer: "Yes! Parents can set daily study goals, screen time limits, break reminders, and create structured learning schedules. The platform includes parental controls to manage access and usage patterns." },
      { question: "How do I communicate with my child's teachers through the platform?", answer: "The platform includes secure messaging features, parent-teacher conference scheduling, progress sharing, and collaborative tools to maintain regular communication with educators about your child's learning journey." },
      { question: "What support is available if my child needs help?", answer: "We provide 24/7 technical support, AI-powered tutoring assistance, access to human tutors for complex queries, and comprehensive help resources to ensure your child gets the support they need." }
    ]
  }

  const platformFeatures = [
    { icon: Brain, title: "AI-Powered Tutoring System", description: "Advanced conversational AI with role-based responses, CBSE curriculum alignment, and intelligent RAG search", color: "from-purple-500 to-indigo-600", highlight: "AI Powered", glowColor: "shadow-purple-500/25" },
    { icon: Database, title: "e-Learning Practest Engine", description: "Comprehensive assessment system with adaptive testing, intelligent question generation, and detailed analytics", color: "from-blue-500 to-cyan-500", highlight: "Smart Testing", glowColor: "shadow-blue-500/25" },
    { icon: Search, title: "Enhanced Question Bank", description: "Hierarchical topic organization with Board to Class to Subject to Chapter structure and metadata tagging", color: "from-green-500 to-emerald-500", highlight: "Organized Content", glowColor: "shadow-green-500/25" },
    { icon: Cpu, title: "Computer Adaptive Testing", description: "CAT algorithms that adjust difficulty based on performance for optimal learning progression", color: "from-orange-500 to-red-500", highlight: "Adaptive Learning", glowColor: "shadow-orange-500/25" },
    { icon: BarChart3, title: "Advanced Analytics", description: "Comprehensive performance tracking with Bloom's taxonomy classification and learning insights", color: "from-pink-500 to-rose-500", highlight: "Deep Insights", glowColor: "shadow-pink-500/25" },
    { icon: Globe, title: "Multi-Modal Learning", description: "Support for all learning styles with visual, auditory, and kinesthetic content delivery methods", color: "from-teal-500 to-blue-500", highlight: "Universal Access", glowColor: "shadow-teal-500/25" }
  ]

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) animateCounters()
      })
    }, { threshold: 0.5 })
    if (countersRef.current) observer.observe(countersRef.current)
    return () => observer.disconnect()
  }, [])

  const animateCounters = () => {
    const targets = { students: 100000, satisfaction: 98, courses: 500, teachers: 1200 }
    const duration = 2000, steps = 60
    let step = 0
    const interval = setInterval(() => {
      step++
      const progress = step / steps
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCounters({
        students: Math.floor(targets.students * easeOut),
        satisfaction: Math.floor(targets.satisfaction * easeOut),
        courses: Math.floor(targets.courses * easeOut),
        teachers: Math.floor(targets.teachers * easeOut)
      })
      if (step >= steps) {
        clearInterval(interval)
        setCounters(targets)
      }
    }, duration / steps)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [testimonials.length])

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const scrolled = window.pageYOffset
        const parallax = scrolled * 0.5
        heroRef.current.style.transform = `translateY(${parallax}px)`
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Newsletter subscription:', newsletterEmail)
    setNewsletterEmail('')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div ref={heroRef} className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900" />
        <div className="absolute inset-0 bg-white/30 dark:bg-black/20 backdrop-blur-sm" />

        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="mb-6 mt-8">
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
            <LoadingButton variant="primary" size="lg" onClick={() => router.push('/sign-up')} className="px-8 py-4 text-lg font-semibold transform hover:scale-105 transition-all duration-300">
              Start Learning Now
              <Rocket className="h-5 w-5 ml-2 animate-bounce" />
            </LoadingButton>
            <LoadingButton variant="outline" size="lg" onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 text-lg font-semibold transform hover:scale-105 transition-all duration-300">
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

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-gray-400 hover:text-orange-500 transition-colors duration-300" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" ref={featuresRef} className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Platform <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Features</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Discover the cutting-edge technology that powers personalized learning experiences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {platformFeatures.map((feature, index) => (
              <div key={index} className={`relative p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border border-gray-200 dark:border-gray-700 group overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${feature.color} rounded-xl mb-6 shadow-lg ${feature.glowColor}`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <span className={`inline-block px-3 py-1 text-xs font-semibold bg-gradient-to-r ${feature.color} text-white rounded-full mb-2`}>
                      {feature.highlight}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{feature.title}</h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Preview Section */}
      <section id="plans" className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Simple, <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Transparent Pricing</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Choose the perfect plan for your learning journey. All plans include access to our advanced AI tutor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Free Trial Plan */}
            <div className="relative p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border border-gray-200 dark:border-gray-600">
              <div className="absolute top-4 right-4">
                <span className="inline-block px-3 py-1 text-xs font-semibold bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-full">
                  Try Free
                </span>
              </div>
              <div className="mb-4">
                <Sparkles className="h-10 w-10 text-gray-600 dark:text-gray-300 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free Trial</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">₹0</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">/ 7 days</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Try all features with limited questions</p>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>15 questions total</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>All boards & classes</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>No credit card required</span>
                </li>
              </ul>
            </div>

            {/* Basic Plan */}
            <div className="relative p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border border-blue-200 dark:border-blue-700">
              <div className="mb-4">
                <BookOpen className="h-10 w-10 text-blue-600 dark:text-blue-400 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Basic</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">₹249</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">/ month</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Perfect for focused learning</p>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>30 questions per day</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>1 board, 1 class</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>Email support</span>
                </li>
              </ul>
            </div>

            {/* Classic Plan - Popular */}
            <div className="relative p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-2 border-green-400 dark:border-green-600">
              <div className="absolute top-4 right-4">
                <span className="inline-block px-3 py-1 text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full">
                  Popular
                </span>
              </div>
              <div className="mb-4">
                <MessageSquare className="h-10 w-10 text-green-600 dark:text-green-400 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Classic</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">₹499</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">/ month</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">For dedicated learners</p>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>60 questions per day</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>1 board, 1 class</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>Priority support</span>
                </li>
              </ul>
            </div>

            {/* Pro Plan - Best Value */}
            <div className="relative p-6 bg-gradient-to-br from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-2 border-orange-400 dark:border-orange-600">
              <div className="absolute top-4 right-4">
                <span className="inline-block px-3 py-1 text-xs font-semibold bg-gradient-to-r from-orange-500 to-blue-600 text-white rounded-full">
                  Best Value
                </span>
              </div>
              <div className="mb-4">
                <Crown className="h-10 w-10 text-orange-600 dark:text-orange-400 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pro</h3>
                <div className="flex items-baseline mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">₹999</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">/ month</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Ultimate flexibility</p>
              </div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>150 questions per day</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>1 board, ALL classes</span>
                </li>
                <li className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>Early access to features</span>
                </li>
              </ul>
            </div>
          </div>

          {/* CTA Button to Full Pricing Page */}
          <div className="text-center">
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              View Full Pricing Details
              <ArrowRight className="h-5 w-5" />
            </a>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Compare all features and find the perfect plan for your needs
            </p>
          </div>
        </div>
      </section>

      {/* Data Counters Section / About Section */}
      <section id="about" ref={countersRef} className="py-20 bg-gradient-to-br from-orange-500 to-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Trusted by Thousands
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              Join our growing community of learners, educators, and institutions
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Students', value: counters.students.toLocaleString(), icon: Users, suffix: '+' },
              { label: 'Success Rate', value: counters.satisfaction, icon: Target, suffix: '%' },
              { label: 'Courses', value: counters.courses, icon: BookOpen, suffix: '+' },
              { label: 'Teachers', value: counters.teachers, icon: GraduationCap, suffix: '+' }
            ].map((stat, index) => (
              <div key={index} className="text-center p-6 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300">
                <stat.icon className="h-12 w-12 mx-auto mb-4 text-white" />
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {stat.value}{stat.suffix}
                </div>
                <div className="text-white/90 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Student <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Success Stories</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Hear from students who transformed their learning journey with Digi Classroom
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-8 md:p-12 shadow-lg">
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />
                  ))}
                </div>
                <blockquote className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-8 italic leading-relaxed">
                  "{testimonials[currentTestimonial].quote}"
                </blockquote>
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {testimonials[currentTestimonial].name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 dark:text-white text-lg">
                      {testimonials[currentTestimonial].name}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {testimonials[currentTestimonial].grade}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentTestimonial ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Frequently Asked <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">Questions</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Get answers to common questions about Digi Classroom
            </p>
          </div>

          {/* FAQ Category Tabs */}
          <div className="flex justify-center mb-12">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-2 shadow-lg border border-gray-200 dark:border-gray-700">
              {(['students', 'teachers', 'parents'] as const).map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveFaqCategory(category)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 capitalize ${
                    activeFaqCategory === category
                      ? 'bg-gradient-to-r from-orange-500 to-blue-600 text-white shadow-lg'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ Content */}
          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {faqCategories[activeFaqCategory].map((faq, index) => (
                <div key={index} className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-300"
                  >
                    <span className="font-semibold text-gray-900 dark:text-white pr-4">{faq.question}</span>
                    <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-4">
                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Stay Updated with Digi Classroom
            </h2>
            <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto">
              Get the latest updates on new features, educational insights, and learning tips delivered to your inbox
            </p>

            <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto">
              <div className="flex gap-4">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 px-6 py-4 rounded-xl border-0 bg-white/10 backdrop-blur-md text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
                  required
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors duration-300 flex items-center gap-2"
                >
                  <Send className="h-5 w-5" />
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Footer / Contact Section */}
      <footer id="contact" className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* Company Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold">Digi Classroom</span>
              </div>
              <p className="text-gray-300 mb-6 max-w-md">
                Revolutionizing education with AI-powered learning experiences. Join thousands of students and educators in transforming the future of learning.
              </p>
              <div className="flex space-x-4">
                {[Facebook, Twitter, Instagram, Linkedin, Youtube].map((Icon, index) => (
                  <a key={index} href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gradient-to-br hover:from-orange-500 hover:to-blue-600 transition-all duration-300">
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-6">Quick Links</h3>
              <ul className="space-y-3">
                {['About Us', 'Features', 'Pricing', 'Blog', 'Help Center', 'Contact'].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-gray-300 hover:text-white transition-colors duration-300">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold mb-6">Contact Info</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-orange-500 mr-3" />
                  <span className="text-gray-300">support@mydigiclassroom.com</span>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-orange-500 mr-3" />
                  <span className="text-gray-300">+91 9310959596</span>
                </div>
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-orange-500 mr-3 mt-1" />
                  <span className="text-gray-300">Connaught Place, New Delhi, India</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 mb-4 md:mb-0">
                © 2024 Digi Classroom. All rights reserved.
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-gray-400 hover:text-white transition-colors duration-300">Privacy Policy</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors duration-300">Terms of Service</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors duration-300">Cookie Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
