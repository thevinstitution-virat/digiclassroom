'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, BarChart3, Globe, Brain, ChevronDown,
  Target, Zap, TrendingUp, ArrowRight, MessageSquare, Search, Database,
  Rocket, Mail, Phone, MapPin, Send, BookOpen, Star,
  Facebook, Twitter, Instagram, Linkedin, Youtube, Check, Crown, Sparkles
} from 'lucide-react'
import { Navbar } from '@/components/navigation/navbar'
import { HeroProductMockup } from '@/components/landing/sections/HeroProductMockup'
import { AiTutorDeepDive } from '@/components/landing/sections/AiTutorDeepDive'
import { ProductivitySuite } from '@/components/landing/sections/ProductivitySuite'
// Shared Indic motifs, vendored from PDLMS (canonical: shared/design/indic).
// Same lotus mandala and chakra rule the other two apps use — this landing is
// the most visible surface, so it is where the family resemblance has to land.
import { MandalaSVG } from '@/design/indic/motifs/mandala-svgs'
import { MandalaMark } from '@/design/indic/motifs/mandala-mark'
import { ChakraDivider } from '@/design/indic/motifs/chakra-divider'

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

  // Pre-launch: value props voiced through learner personas from our design-partner
  // interviews — not fabricated named students. Honest founding-cohort framing.
  const testimonials = [
    { id: 1, name: "Class 10 learner", grade: "Design-partner persona", quote: "What I want from an AI tutor: explain a hard concept in minutes — and show me the exact textbook page it came from so I can trust it." },
    { id: 2, name: "Class 12 learner", grade: "Design-partner persona", quote: "Adaptive testing that gets harder as I improve, mapped to the actual board pattern — that's what would prepare me for exams." },
    { id: 3, name: "Class 9 learner", grade: "Design-partner persona", quote: "A platform that adapts to how I learn and keeps me focused — flashcards, streaks, and offline access — would make studying feel less like a chore." }
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

  /* Every feature previously carried its own hue (purple, blue, green, orange,
     pink, teal). Six unrelated gradients read as a component gallery rather
     than one product, and none of them were Indic. They now share the accent
     plinth; the distinguishing signal is the motif watermark behind each tile,
     which is the same set of six mandalas PDLMS uses on its feature grid. */
  const platformFeatures = [
    { icon: Brain, title: "AI-Powered Tutoring System", description: "Advanced conversational AI with role-based responses, CBSE curriculum alignment, and intelligent RAG search", highlight: "AI Powered", motif: 'lotus' },
    { icon: Database, title: "e-Learning Practest Engine", description: "Comprehensive assessment system with adaptive testing, intelligent question generation, and detailed analytics", highlight: "Smart Testing", motif: 'sriyantra' },
    { icon: Search, title: "Enhanced Question Bank", description: "Hierarchical topic organization with Board to Class to Subject to Chapter structure and metadata tagging", highlight: "Organized Content", motif: 'ashoka' },
    { icon: Target, title: "Computer Adaptive Testing", description: "CAT algorithms that adjust difficulty based on performance for optimal learning progression", highlight: "Adaptive Learning", motif: 'peacock' },
    { icon: BarChart3, title: "Advanced Analytics", description: "Comprehensive performance tracking with Bloom's taxonomy classification and learning insights", highlight: "Deep Insights", motif: 'kolam' },
    { icon: Globe, title: "Multi-Modal Learning", description: "Support for all learning styles with visual, auditory, and kinesthetic content delivery methods", highlight: "Universal Access", motif: 'meenakari' }
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
    const targets = { students: 6, satisfaction: 100, courses: 7, teachers: 7 }
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
    <div className="indic-landing min-h-screen">
      {/* Navigation */}
      <Navbar />

      {/* ── Hero ──
          indic-hero-canvas supplies the pastel Indic gradient (light) / deep
          night-to-turmeric gradient (dark) plus the ambient orbs, so this
          section names no colours of its own. */}
      <section className="indic-hero-canvas relative min-h-screen flex items-center justify-center pt-16">
        {/* Parallax layer: kept as an empty transform target — the gradient now
            lives on the section itself so it can't slide away from its edges. */}
        <div ref={heroRef} className="absolute inset-0 pointer-events-none" />
        <div className="rangoli-texture" />

        {/* Slowly breathing lotus mandala, the trio's shared hero motif */}
        <div className="mandala-wrapper mandala-breathe">
          <MandalaSVG />
        </div>

        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto py-16">
          <div className="mb-6 mt-8">
            <span className="indic-eyebrow indic-rise">
              <Zap className="h-4 w-4" /> Powered by Advanced AI &amp; Machine Learning
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl mb-6 indic-rise indic-delay-1">
            <span className="gradient-text-indic-soft">Digi Classroom</span>
            <br />
            <span className="text-3xl md:text-5xl">Next-Gen Learning Platform</span>
          </h1>

          <p
            className="text-xl md:text-2xl mb-8 font-semibold tracking-wide indic-rise indic-delay-2"
            style={{ color: 'var(--accent-strong)' }}
          >
            AI-Powered · Adaptive · Comprehensive
          </p>

          <p className="indic-muted text-lg md:text-xl mb-12 max-w-4xl mx-auto leading-relaxed indic-rise indic-delay-2">
            Experience revolutionary education with our <strong>Agentic RAG AI system</strong>,
            advanced <em>e-Learning Practest engine</em>, and comprehensive CBSE curriculum coverage.
            Transform your learning journey with intelligent tutoring and adaptive assessments.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center indic-rise indic-delay-3">
            <button onClick={() => router.push('/sign-up')} className="indic-cta indic-cta--primary w-full sm:w-auto text-lg">
              Start Learning Now
              <Rocket className="h-5 w-5" />
            </button>
            <button
              onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="indic-cta indic-cta--ghost w-full sm:w-auto text-lg"
            >
              <Play className="w-5 h-5" />
              Explore Features
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { label: 'AI Models', value: '5+', icon: Brain },
              { label: 'NCERT-Cited', value: '100%', icon: Database },
              { label: 'Classes 6–12', value: 'CBSE·ICSE', icon: Target },
              { label: 'Productivity Tools', value: '7', icon: TrendingUp }
            ].map((stat, index) => (
              <div key={index} className="indic-tile text-center p-4">
                <span className="indic-icon-plinth w-11 h-11 mx-auto mb-2">
                  <stat.icon className="h-5 w-5" />
                </span>
                <div className="indic-stat__value text-2xl">{stat.value}</div>
                <div className="indic-muted text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Product mockup — shows what Digi Classroom actually is, above the fold */}
          <HeroProductMockup />
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 indic-float">
          <ChevronDown className="w-7 h-7" style={{ color: 'rgb(var(--accent-strong-rgb) / 0.6)' }} />
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" ref={featuresRef} className="indic-section--warm py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6">
              Platform <span className="gradient-text-indic-soft">Features</span>
            </h2>
            <p className="indic-muted text-xl max-w-3xl mx-auto">
              Discover the cutting-edge technology that powers personalized learning experiences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {platformFeatures.map((feature, index) => (
              <div key={index} className="indic-tile p-8">
                <div className={`indic-tile__motif indic-motif-${feature.motif}`} />
                <div className="relative z-10">
                  <span className="indic-icon-plinth w-16 h-16 mb-6">
                    <feature.icon className="h-8 w-8" />
                  </span>
                  <div className="mb-4">
                    <span className="indic-eyebrow mb-3">{feature.highlight}</span>
                    <h3 className="text-xl mt-3">{feature.title}</h3>
                  </div>
                  <p className="indic-muted leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ChakraDivider className="indic-section" />

      {/* AI Tutor (Sarvagya RAG) + Practest deep-dive */}
      <AiTutorDeepDive />

      {/* The Productivity Suite — real branded student tools */}
      <ProductivitySuite />

      {/* ── Plans ── */}
      <section id="plans" className="indic-section py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6">
              Simple, <span className="gradient-text-indic-soft">Transparent Pricing</span>
            </h2>
            <p className="indic-muted text-xl max-w-3xl mx-auto">
              Choose the perfect plan for your learning journey. All plans include access to our advanced AI tutor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Tier colour previously carried the meaning (grey / blue / green /
                orange). Rank is now carried by the accent ramp — temple-stone,
                peacock, accent, gold — which stays inside the Indic palette and
                still reads as an ascending ladder. */}
            {[
              {
                name: 'Free Trial', price: '₹0', unit: '/ 7 days', icon: Sparkles, badge: 'Try Free',
                blurb: 'Try all features with limited questions', tint: 'var(--temple-stone)',
                features: ['15 questions total', 'All boards & classes', 'No credit card required'],
              },
              {
                name: 'Basic', price: '₹249', unit: '/ month', icon: BookOpen, badge: null,
                blurb: 'Perfect for focused learning', tint: 'var(--peacock-teal)',
                features: ['30 questions per day', '1 board, 1 class', 'Email support'],
              },
              {
                name: 'Classic', price: '₹499', unit: '/ month', icon: MessageSquare, badge: 'Popular',
                blurb: 'For dedicated learners', tint: 'var(--accent-strong)', featured: true,
                features: ['60 questions per day', '1 board, 1 class', 'Priority support'],
              },
              {
                name: 'Pro', price: '₹999', unit: '/ month', icon: Crown, badge: 'Best Value',
                blurb: 'Ultimate flexibility', tint: 'var(--lotus-deep)',
                features: ['150 questions per day', '1 board, ALL classes', 'Early access to features'],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="indic-tile p-6"
                style={plan.featured ? { borderColor: 'rgb(var(--accent-primary-rgb) / 0.65)', borderWidth: 2 } : undefined}
              >
                {plan.badge && (
                  <div className="absolute top-4 right-4 z-10">
                    <span
                      className="inline-block px-3 py-1 text-xs font-bold text-white rounded-full"
                      style={{ background: plan.tint }}
                    >
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="relative z-10">
                  <div className="mb-4">
                    <plan.icon className="h-10 w-10 mb-3" style={{ color: plan.tint }} />
                    <h3 className="text-2xl mb-2">{plan.name}</h3>
                    <div className="flex items-baseline mb-2">
                      <span className="indic-stat__value text-4xl">{plan.price}</span>
                      <span className="indic-muted ml-2">{plan.unit}</span>
                    </div>
                    <p className="indic-muted text-sm">{plan.blurb}</p>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start text-sm">
                        <Check className="h-5 w-5 mr-2 flex-shrink-0" style={{ color: 'var(--teal-light)' }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <a href="/pricing" className="indic-cta indic-cta--primary">
              View Full Pricing Details
              <ArrowRight className="h-5 w-5" />
            </a>
            <p className="indic-muted mt-4 text-sm">
              Compare all features and find the perfect plan for your needs
            </p>
          </div>
        </div>
      </section>

      {/* ── Capability counters ── */}
      <section id="about" ref={countersRef} className="indic-section--deep mandala-watermark py-20">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="indic-eyebrow mb-6">
              <Sparkles className="w-4 h-4" /> Launching 2026 · Founding learners onboarding now
            </span>
            <h2 className="text-4xl md:text-5xl mt-6 mb-6">
              Built for Every CBSE &amp; ICSE Learner
            </h2>
            <p className="indic-muted text-xl max-w-3xl mx-auto">
              Not vanity metrics — the real capabilities students get from day one.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'AI Models', value: counters.students, icon: Brain, suffix: '+' },
              { label: 'NCERT-Cited', value: counters.satisfaction, icon: Target, suffix: '%' },
              { label: 'Classes (6–12)', value: counters.courses, icon: BookOpen, suffix: '' },
              { label: 'Productivity Tools', value: counters.teachers, icon: Zap, suffix: '' }
            ].map((stat, index) => (
              <div
                key={index}
                className="text-center p-6 rounded-xl backdrop-blur-md transition-all duration-300"
                style={{
                  background: 'rgb(var(--ivory-cream-rgb) / 0.08)',
                  border: '1px solid rgb(var(--gold-rgb) / 0.25)',
                }}
              >
                <stat.icon className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--gold)' }} />
                <div className="indic-stat__value text-4xl md:text-5xl mb-2">
                  {stat.value}{stat.suffix}
                </div>
                <div className="indic-muted font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="indic-section py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6">
              Designed With <span className="gradient-text-indic-soft">Real Learners</span>
            </h2>
            <p className="indic-muted text-xl max-w-3xl mx-auto">
              We&apos;re building Digi Classroom alongside students. These are the needs they voiced —
              the product is built to meet them.
            </p>
            <p className="indic-muted text-sm mt-3 italic opacity-80">
              Illustrative voices from design-partner interviews · launching 2026
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="indic-tile p-8 md:p-12">
              <div className="indic-tile__motif indic-motif-lotus" />
              <div className="relative z-10 text-center">
                <div className="flex justify-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-6 w-6 fill-current" style={{ color: 'var(--gold)' }} />
                  ))}
                </div>
                <blockquote className="text-xl md:text-2xl mb-8 italic leading-relaxed">
                  &ldquo;{testimonials[currentTestimonial].quote}&rdquo;
                </blockquote>
                <div className="flex items-center justify-center gap-4">
                  <span className="indic-icon-plinth w-16 h-16 text-xl">
                    {testimonials[currentTestimonial].name.charAt(0)}
                  </span>
                  <div className="text-left">
                    <div className="font-bold text-lg">{testimonials[currentTestimonial].name}</div>
                    <div className="indic-muted">{testimonials[currentTestimonial].grade}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-8 gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  aria-label={`Show testimonial ${index + 1}`}
                  className="w-3 h-3 rounded-full transition-all duration-300"
                  style={{
                    background: index === currentTestimonial
                      ? 'var(--accent-strong)'
                      : 'rgb(var(--temple-stone-rgb) / 0.35)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="indic-section--warm py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6">
              Frequently Asked <span className="gradient-text-indic-soft">Questions</span>
            </h2>
            <p className="indic-muted text-xl max-w-3xl mx-auto">
              Get answers to common questions about Digi Classroom
            </p>
          </div>

          <div className="flex justify-center mb-12">
            <div className="indic-tile p-2 flex">
              {(['students', 'teachers', 'parents'] as const).map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveFaqCategory(category)}
                  className="relative z-10 px-6 py-3 rounded-lg font-bold transition-all duration-300 capitalize"
                  style={
                    activeFaqCategory === category
                      ? { background: 'var(--accent-strong)', color: '#fff' }
                      : { color: 'var(--bark)' }
                  }
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {faqCategories[activeFaqCategory].map((faq, index) => (
                <div key={index} className="indic-tile overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="relative z-10 w-full px-6 py-4 text-left flex items-center justify-between"
                  >
                    {/* A question in an accordion is a control, not a document
                        heading — kept as a span so it never lands in the outline. */}
                    <span className="font-bold pr-4">{faq.question}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--accent-strong)' }}
                    />
                  </button>
                  {openFaq === index && (
                    <div className="relative z-10 px-6 pb-4">
                      <p className="indic-muted leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Newsletter ── */}
      <section className="indic-section--deep py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl mb-6">
              Stay Updated with Digi Classroom
            </h2>
            <p className="indic-muted text-xl mb-12 max-w-3xl mx-auto">
              Get the latest updates on new features, educational insights, and learning tips delivered to your inbox
            </p>

            <form onSubmit={handleNewsletterSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  aria-label="Email address"
                  className="flex-1 px-6 py-4 rounded-xl border-0 backdrop-blur-md outline-none focus:ring-2"
                  style={{
                    background: 'rgb(var(--ivory-cream-rgb) / 0.12)',
                    color: 'var(--ivory-cream)',
                  }}
                  required
                />
                <button
                  type="submit"
                  className="indic-cta px-8"
                  style={{ background: 'var(--gold)', color: 'var(--night-ink)' }}
                >
                  <Send className="h-5 w-5" />
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        id="contact"
        className="py-16"
        style={{ background: 'var(--night-ink)', color: 'var(--ivory-cream)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* Company Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <MandalaMark size={40} />
                <span className="text-2xl" style={{ fontFamily: 'var(--font-display)' }}>Digi Classroom</span>
              </div>
              <p className="mb-6 max-w-md" style={{ color: 'rgb(var(--ivory-cream-rgb) / 0.72)' }}>
                Revolutionizing education with AI-powered, NCERT-grounded learning. Launching 2026 —
                join the founding cohort shaping the future of CBSE &amp; ICSE study.
              </p>
              {/* Ecosystem badge — part of the Vidyaverse trio */}
              <a
                href="https://vgraphics.in"
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-6 transition-colors duration-300"
                style={{
                  background: 'rgb(var(--ivory-cream-rgb) / 0.05)',
                  border: '1px solid rgb(var(--gold-rgb) / 0.22)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--gold))' }}
                />
                <span className="text-xs font-semibold" style={{ color: 'rgb(var(--ivory-cream-rgb) / 0.75)' }}>
                  Part of the <span className="gradient-text-indic-soft font-bold">Vidyaverse</span> ecosystem — one login across Campus OS, Library &amp; Tutor
                </span>
              </a>
              <div className="flex gap-4">
                {[Facebook, Twitter, Instagram, Linkedin, Youtube].map((Icon, index) => (
                  <a
                    key={index}
                    href="#"
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
                    style={{
                      background: 'rgb(var(--ivory-cream-rgb) / 0.06)',
                      border: '1px solid rgb(var(--gold-rgb) / 0.18)',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg mb-6" style={{ color: 'var(--gold)' }}>Quick Links</h3>
              <ul className="space-y-3">
                {['About Us', 'Features', 'Pricing', 'Blog', 'Help Center', 'Contact'].map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="transition-colors duration-300 hover:text-[color:var(--gold)]"
                      style={{ color: 'rgb(var(--ivory-cream-rgb) / 0.72)' }}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg mb-6" style={{ color: 'var(--gold)' }}>Contact Info</h3>
              <div className="space-y-4" style={{ color: 'rgb(var(--ivory-cream-rgb) / 0.72)' }}>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 mr-3" style={{ color: 'var(--accent-primary)' }} />
                  <span>support@mydigiclassroom.com</span>
                </div>
                <div className="flex items-center">
                  <Phone className="h-5 w-5 mr-3" style={{ color: 'var(--accent-primary)' }} />
                  <a href="tel:+919310959596" className="transition-colors duration-300 hover:text-[color:var(--gold)]">+91 93109 59596</a>
                </div>
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 mr-3 mt-1" style={{ color: 'var(--accent-primary)' }} />
                  <span>
                    Vinstitution, 2nd Floor, Property No. 44, Regal Building,
                    Connaught Place, New Delhi — 110090
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8" style={{ borderTop: '1px solid rgb(var(--gold-rgb) / 0.14)' }}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4" style={{ color: 'rgb(var(--ivory-cream-rgb) / 0.6)' }}>
              <p className="text-center md:text-left leading-relaxed">
                Digi Classroom is a brand of the Vinstitution segment of VPD Vastus
                Ventures Private Limited.
              </p>
              <div className="flex gap-6">
                <a href="#" className="transition-colors duration-300 hover:text-[color:var(--gold)]">Privacy Policy</a>
                <a href="#" className="transition-colors duration-300 hover:text-[color:var(--gold)]">Terms of Service</a>
                <a href="#" className="transition-colors duration-300 hover:text-[color:var(--gold)]">Cookie Policy</a>
              </div>
            </div>

            {/* Legal identifiers + copyright — same block across the trio, only the brand name above changes */}
            <div
              className="mt-6 pt-6 flex flex-col items-center gap-1.5 text-center text-xs"
              style={{ borderTop: '1px solid rgb(var(--gold-rgb) / 0.1)', color: 'rgb(var(--ivory-cream-rgb) / 0.35)' }}
            >
              <p>PAN: AAMCV2938B &middot; GSTIN: 07AAMCV2938B1ZA &middot; ISO 9001:2015 Certified</p>
              <p>
                &copy; {new Date().getFullYear()} VPD Vastus Ventures Pvt. Ltd. All rights reserved.
                &middot; Proudly powered by Vinstitution &middot; Designed by{' '}
                <a href="https://vgraphics.in" className="transition-colors duration-300 hover:text-[color:var(--gold)]">
                  VGraphics.in
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
