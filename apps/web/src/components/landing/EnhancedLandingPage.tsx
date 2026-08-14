'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Zap, Rocket, Play, Bot, BadgeCheck, Quote, Layers, Flame, Trophy, ChevronDown,
  LayoutGrid, Brain, ClipboardCheck, Network, SlidersHorizontal, BarChart3, Share2,
  Route, MessageSquare, BookOpen, Puzzle, WifiOff, Shield, Smile, Users, Timer,
  Tag, Sparkles, MessagesSquare, Crown, Check, GraduationCap, Library, Heart, Star,
  ChevronLeft, ChevronRight, HelpCircle, Send, Menu, Sun, Moon,
} from 'lucide-react'
import { LandingFooter } from '@/components/landing/LandingFooter'

/* ── Reusable inline SVG mandalas (ported from the mock) ─────────────────── */

function NavMandala({ id, spin }: { id: string; spin: string }) {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg viewBox="0 0 120 120" width={38} height={38} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="70%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="var(--saffron)" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill={`url(#${id})`} />
      <circle cx="60" cy="60" r="58" fill="none" stroke="var(--gold)" strokeOpacity="0.55" strokeWidth="1.5" />
      <g className={spin} style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
        {petals.map((r) => (
          <ellipse key={r} cx="60" cy="26" rx="8" ry="20" fill="#fff" fillOpacity="0.34" transform={`rotate(${r} 60 60)`} />
        ))}
      </g>
      <circle cx="60" cy="60" r="15" fill="#fff" fillOpacity="0.95" />
      <circle cx="60" cy="60" r="6.5" fill="var(--saffron)" />
    </svg>
  )
}

function HeroMandala({ spinA, spinB }: { spinA: string; spinB: string }) {
  const outer = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  const inner = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg viewBox="0 0 400 400" width="100%" xmlns="http://www.w3.org/2000/svg">
      <g className={spinA} style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
        <circle cx="200" cy="200" r="182" fill="none" stroke="rgb(255 153 51 / 0.20)" strokeWidth="1" />
        <circle cx="200" cy="200" r="162" fill="none" stroke="rgb(255 107 53 / 0.22)" strokeWidth="0.8" />
        {outer.map((r) => (
          <path key={r} d="M200,42 Q222,72 200,104 Q178,72 200,42Z" fill="rgb(255 107 53 / 0.18)" stroke="rgb(255 153 51 / 0.4)" strokeWidth="0.6" transform={`rotate(${r} 200 200)`} />
        ))}
      </g>
      <g className={spinB} style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
        <circle cx="200" cy="200" r="104" fill="none" stroke="rgb(0 106 110 / 0.3)" strokeWidth="1" />
        {inner.map((r) => (
          <path key={r} d="M200,108 Q216,134 200,158 Q184,134 200,108Z" fill="rgb(0 106 110 / 0.22)" stroke="rgb(0 106 110 / 0.5)" strokeWidth="0.7" transform={`rotate(${r} 200 200)`} />
        ))}
      </g>
      <circle cx="200" cy="200" r="40" fill="rgb(255 215 0 / 0.08)" stroke="rgb(255 215 0 / 0.4)" strokeWidth="1" />
      <circle cx="200" cy="200" r="20" fill="rgb(255 215 0 / 0.16)" stroke="rgb(255 153 51 / 0.6)" strokeWidth="1.2" />
      <circle cx="200" cy="200" r="7" fill="rgb(255 215 0 / 0.7)" />
    </svg>
  )
}

function ChakraWheel({ spin }: { spin: string }) {
  const spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  return (
    <svg viewBox="0 0 100 100" width={42} height={42} className={spin} aria-hidden="true" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--accent-strong)" strokeWidth="2" />
      <circle cx="50" cy="50" r="8" fill="var(--accent-strong)" />
      {spokes.map((r) => (
        <line key={r} x1="50" y1="50" x2="50" y2="6" stroke="var(--accent-strong)" strokeWidth="1.4" transform={`rotate(${r} 50 50)`} />
      ))}
    </svg>
  )
}

function RingMandala({ spin, stroke = '#FFD700' }: { spin: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 200 200" width="100%" className={spin} aria-hidden="true" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
      <circle cx="100" cy="100" r="92" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="3 7" />
      <circle cx="100" cy="100" r="66" fill="none" stroke="#FF9933" strokeWidth="1" />
      <circle cx="100" cy="100" r="40" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="2 5" />
      <circle cx="100" cy="100" r="14" fill={stroke} fillOpacity="0.4" />
    </svg>
  )
}

function CornerMotif() {
  return (
    <svg viewBox="0 0 200 200" width={150} height={150} aria-hidden="true" style={{ position: 'absolute', right: -30, top: -30, opacity: 0.12 }}>
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeDasharray="3 6" />
      <circle cx="100" cy="100" r="62" fill="none" stroke="var(--peacock-teal)" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="38" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeDasharray="2 5" />
      <circle cx="100" cy="100" r="12" fill="var(--gold)" />
    </svg>
  )
}

/* ── Data (verbatim from the mock) ──────────────────────────────────────── */

const FEATURES = [
  { Icon: Brain, title: 'AI Tutoring System', tag: 'Agentic RAG', desc: 'Conversational AI with role-based answers, CBSE/ICSE alignment, and citation-backed retrieval over your NCERT books.' },
  { Icon: ClipboardCheck, title: 'Practest Engine', tag: 'Smart testing', desc: 'Adaptive assessment with intelligent question generation and real-time, chapter-level performance analytics.' },
  { Icon: Network, title: 'Structured Question Bank', tag: 'Organised', desc: 'Board → Class → Subject → Chapter hierarchy with clean metadata tagging so nothing gets lost.' },
  { Icon: SlidersHorizontal, title: 'Computer-Adaptive Testing', tag: 'Adaptive', desc: 'CAT algorithms adjust difficulty to your performance for the fastest possible learning curve.' },
  { Icon: BarChart3, title: 'Advanced Analytics', tag: 'Deep insight', desc: "Track mastery with Bloom's-taxonomy classification and honest strength/gap reporting." },
  { Icon: Share2, title: 'Multi-Modal Learning', tag: 'Universal', desc: 'Visual, reading and practice modes so every learner meets the material the way they think best.' },
]

const TOOLS = [
  { Icon: Zap, name: 'FlashBharat', tagline: 'Gamified active recall', desc: 'Indian-context flashcards, live quiz battles and cultural badges that make revision addictive.' },
  { Icon: WifiOff, name: 'OfflineOrbit', tagline: 'Offline-first learning', desc: 'Download lessons, tests and notes — study with zero internet, then sync smartly on reconnect.' },
  { Icon: Shield, name: 'FocusShield', tagline: 'Smart focus mode', desc: 'Blocks distracting apps during study, with a whitelist you control and an emergency escape.' },
  { Icon: Smile, name: 'MoodMentor', tagline: 'AI study coach', desc: 'Tracks how you feel and adapts the schedule — coaching that protects motivation, not just marks.' },
  { Icon: Users, name: 'ParentPulse', tagline: 'Parent & teacher view', desc: 'Progress insight and direct messaging so families stay in the loop without the nagging.' },
  { Icon: Timer, name: 'CurricuTimer', tagline: 'Syllabus-aware Pomodoro', desc: 'Adaptive study timers tuned to your grade and the CBSE/ICSE syllabus, engagement tracked.' },
]

const PLANS = [
  { name: 'Free', price: '₹0', unit: '/ 7 days', Icon: Sparkles, badge: 'Try free', blurb: 'Try every feature, limited questions.', feats: ['15 questions total', 'All boards & classes', 'No credit card'], tint: 'var(--temple-stone)', featured: false },
  { name: 'Basic', price: '₹249', unit: '/ month', Icon: BookOpen, badge: '', blurb: 'For focused, single-subject learning.', feats: ['30 questions / day', '1 board, 1 class', 'Email support'], tint: 'var(--peacock-teal)', featured: false },
  { name: 'Classic', price: '₹499', unit: '/ month', Icon: MessagesSquare, badge: 'Popular', blurb: 'For dedicated daily learners.', feats: ['60 questions / day', '1 board, 1 class', 'Priority support'], tint: 'var(--accent-strong)', featured: true },
  { name: 'Pro', price: '₹999', unit: '/ month', Icon: Crown, badge: 'Best value', blurb: 'Ultimate flexibility, all classes.', feats: ['150 questions / day', '1 board, ALL classes', 'Early feature access'], tint: 'var(--lotus-deep)', featured: false },
]

const STEPS = [
  { n: '01', Icon: MessageSquare, title: 'Ask anything', desc: 'Type a doubt in Hindi or English from any NCERT chapter, Classes 6–12.' },
  { n: '02', Icon: BookOpen, title: 'Learn with proof', desc: 'Every answer cites the exact textbook page and tags its Bloom’s level.' },
  { n: '03', Icon: BarChart3, title: 'Practise adaptively', desc: 'Practest tunes difficulty to you and tracks mastery until it sticks.' },
]

const TRIO = [
  { Icon: Bot, name: 'Digi Classroom', role: 'AI Tutor', here: true, desc: 'NCERT-grounded tutoring & adaptive practice for Classes 6–12.' },
  { Icon: GraduationCap, name: 'Vidyaverse', role: 'Campus OS', here: false, desc: 'The institution operating system — admissions to ID cards.' },
  { Icon: Library, name: 'PDLMS', role: 'Digital Library', here: false, desc: 'Multi-tenant digital library of learning resources.' },
]

const COUNTERS = [
  { Icon: Brain, value: '5+', label: 'AI models' },
  { Icon: BadgeCheck, value: '100%', label: 'NCERT-cited' },
  { Icon: BookOpen, value: '6–12', label: 'Classes' },
  { Icon: Zap, value: '7', label: 'Study tools' },
]

const FAQ_DATA: Record<'students' | 'teachers' | 'parents', { q: string; a: string }[]> = {
  students: [
    { q: 'How does the AI tutor actually help me learn?', a: 'It combines multiple models with curriculum-specific retrieval, adapts to your pace, and explains using Bloom’s taxonomy — always citing the NCERT page so you can trust the answer.' },
    { q: 'What makes the Practest engine special?', a: 'Computer-adaptive testing generates questions from a hierarchical bank and adjusts difficulty in real time, with chapter-level analytics after every attempt.' },
    { q: 'Can I track my progress?', a: 'Yes — visual dashboards, learning streaks, XP and clear strength/gap insight so you always know what to revise next.' },
    { q: 'Is content aligned to my syllabus?', a: 'All content is mapped to the latest CBSE and ICSE curriculum for Classes 6–12, with metadata tagging for precise alignment across subjects.' },
    { q: 'Can I use it offline?', a: 'Yes — OfflineOrbit lets you download lessons, practice and assessments, then syncs intelligently when you reconnect.' },
  ],
  teachers: [
    { q: 'How do I manage my classroom?', a: 'Create and manage classes, assign work, track student progress, generate reports, and customise learning paths for individuals or groups.' },
    { q: 'What analytics do I get?', a: 'Performance metrics, engagement levels, learning patterns, assessment results and curriculum-coverage reports — all as clear visualisations.' },
    { q: 'Can I create my own content?', a: 'Yes — build custom lessons, quizzes and assignments, or adapt existing content to your teaching style and syllabus needs.' },
    { q: 'Which teaching methods are supported?', a: 'Flipped classroom, blended, project-based and traditional instruction — with flexible content delivery for each.' },
    { q: 'Is there onboarding support?', a: 'Training resources, webinars and documentation to help you integrate the platform effectively into your practice.' },
  ],
  parents: [
    { q: 'How do I monitor my child’s progress?', a: 'Detailed progress reports, time-on-task, achievement badges and trends — with milestone notifications when they matter.' },
    { q: 'Is the platform safe for my child?', a: 'Data encryption, privacy protection, content filtering and compliance with educational data-protection norms keep the space safe.' },
    { q: 'Can I set study schedules and limits?', a: 'Set daily goals, screen-time limits, break reminders and structured schedules, with parental controls over access.' },
    { q: 'Can I reach my child’s teachers?', a: 'Secure messaging, conference scheduling and progress sharing keep parent–teacher communication simple.' },
    { q: 'What support is available?', a: 'AI tutoring assistance, help resources and human support so your child always has a next step.' },
  ],
}

const TESTIMONIALS = [
  { name: 'Class 10 learner', role: 'Design-partner persona', quote: 'Explain a hard concept in minutes — and show me the exact textbook page it came from, so I can trust it.' },
  { name: 'Class 12 learner', role: 'Design-partner persona', quote: 'Adaptive testing that gets harder as I improve, mapped to the real board pattern. That is what would prepare me.' },
  { name: 'Class 9 learner', role: 'Design-partner persona', quote: 'A platform that adapts to how I learn and keeps me focused — flashcards, streaks and offline access.' },
]

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#ai-tutor', label: 'AI Tutor' },
  { href: '#pricing', label: 'Plans' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
]

export const EnhancedLandingPage: React.FC = () => {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqTab, setFaqTab] = useState<'students' | 'teachers' | 'parents'>('students')
  const [openFaq, setOpenFaq] = useState(0)
  const [activeT, setActiveT] = useState(0)

  useEffect(() => setMounted(true), [])

  const goSignup = () => router.push('/sign-up')
  const isDark = mounted && resolvedTheme === 'dark'
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  const t = TESTIMONIALS[activeT]
  const initials = t.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const faqList = FAQ_DATA[faqTab]

  const chipBase = 'inline-flex items-center justify-center rounded-full font-bold cursor-pointer transition-all'

  return (
    <>
      <div className="dcl" style={{ minHeight: '100vh' }}>
        {/* announcement bar */}
        <div style={{ background: 'linear-gradient(90deg,var(--indigo-deep),var(--night-ink))', color: 'var(--ivory-cream)', textAlign: 'center', fontSize: 13.5, fontWeight: 600, padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, flexWrap: 'wrap' }}>
          <Sparkles size={16} style={{ color: 'var(--gold)' }} />
          Launching 2026 · Founding cohort onboarding now · NCERT-grounded, citation-backed AI tutoring
        </div>

        {/* nav */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(14px) saturate(160%)', background: 'var(--nav-bg)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 11, color: 'var(--ink)' }}>
              <NavMandala id="mm-nav" spin="spin-slow" />
              <span className="deva" style={{ fontSize: 23, letterSpacing: '.01em' }}>Digi Classroom</span>
            </a>

            <div className="nav-links" style={{ alignItems: 'center', gap: 30 }}>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="navlink">{l.label}</a>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 42, height: 42, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--accent-text)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDark ? <Sun size={21} /> : <Moon size={21} />}
              </button>
              <div className="nav-cta" style={{ alignItems: 'center', gap: 10 }}>
                <button onClick={() => router.push('/sign-in')} className="navlink" style={{ fontWeight: 700, padding: '8px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>Sign in</button>
                <button onClick={goSignup} className="btn btn-primary" style={{ padding: '11px 22px', fontSize: 15 }}>Get started</button>
              </div>
              <button onClick={() => setMenuOpen((v) => !v)} className="nav-burger" aria-label="Menu" style={{ width: 42, height: 42, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
                <Menu size={23} />
              </button>
            </div>
          </div>

          {menuOpen && (
            <div style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)', padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="navlink" style={{ padding: '11px 4px', fontSize: 17 }}>{l.label}</a>
              ))}
              <button onClick={() => { setMenuOpen(false); goSignup() }} className="btn btn-primary" style={{ marginTop: 10 }}>Get started</button>
            </div>
          )}
        </nav>

        <main id="top">
          {/* ───────── HERO ───────── */}
          <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(56px,8vw,96px) 24px clamp(64px,9vw,110px)' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(58rem 42rem at 82% -6%,rgb(var(--accent-primary-rgb) / 0.16),transparent 60%),radial-gradient(52rem 44rem at 6% 8%,rgb(0 106 110 / 0.14),transparent 58%)' }} />
            <div className="floaty" style={{ position: 'absolute', top: '8%', right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,107,53,.22),transparent 68%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

            <div className="breathe" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(120vw,1100px)', opacity: 0.5, pointerEvents: 'none' }}>
              <HeroMandala spinA="spin-slow" spinB="spin-rev" />
            </div>

            <div style={{ position: 'relative', zIndex: 2, maxWidth: 940, margin: '0 auto', textAlign: 'center' }}>
              <span className="eyebrow"><Zap size={17} /> Powered by Sarvagya · Agentic RAG over NCERT</span>
              <h1 style={{ fontFamily: 'var(--font-body)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.04, margin: '22px 0 0', fontSize: 'clamp(40px,7vw,78px)', color: 'var(--ink)' }}>
                The AI tutor that<br /><span className="grad">shows its sources.</span>
              </h1>
              <p className="deva" style={{ fontSize: 'clamp(18px,2.4vw,26px)', color: 'var(--accent-text)', margin: '18px 0 0', letterSpacing: '.02em' }}>ज्ञान · अभ्यास · उत्कर्ष</p>
              <p className="sub" style={{ maxWidth: '44ch' }}>NCERT-grounded answers, Bloom-tagged and citation-backed. Adaptive Practest, offline-ready study tools — built for CBSE &amp; ICSE learners, Classes 6–12.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 32 }}>
                <button onClick={goSignup} className="btn btn-primary">Start learning free <Rocket size={20} /></button>
                <a href="#ai-tutor" className="btn btn-ghost"><Play size={20} /> See it in action</a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, margin: '44px auto 0', maxWidth: 760 }}>
                {[['5+', 'AI models'], ['100%', 'NCERT-cited'], ['6–12', 'CBSE · ICSE'], ['7', 'study tools']].map(([v, l]) => (
                  <div key={l} className="card" style={{ padding: '18px 14px', textAlign: 'center', boxShadow: 'none' }}>
                    <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--accent-text)' }}>{v}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13.5, fontWeight: 600 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* product mockup */}
            <div style={{ position: 'relative', zIndex: 2, maxWidth: 820, margin: '52px auto 0' }}>
              <div style={{ position: 'absolute', inset: -16, borderRadius: 28, background: 'linear-gradient(135deg,var(--gold),var(--saffron),var(--lotus-pink))', filter: 'blur(34px)', opacity: 0.24 }} />
              <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', border: '1px solid rgb(255 215 0 / 0.3)', boxShadow: '0 40px 80px -34px rgba(0,0,0,.55)', background: '#FFFCF7' }}>
                <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: '#FFF8F0', borderBottom: '1px solid rgb(184 134 11 / 0.2)' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#C0392B', opacity: 0.75 }} />
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#F5A623' }} />
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#00897B' }} />
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: '#5A4E3C' }}>Digi Classroom · Class 9 Science</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr' }}>
                  <div style={{ padding: 20, borderRight: '1px solid rgb(184 134 11 / 0.16)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span className="plinth" style={{ width: 30, height: 30, borderRadius: 9 }}><Bot size={17} /></span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0A0F1E' }}>Digi Tutor</span>
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#00897B' }}><BadgeCheck size={14} /> grounded in NCERT</span>
                    </div>
                    <div style={{ marginLeft: 'auto', width: 'fit-content', maxWidth: '86%', fontSize: 13, padding: '10px 13px', borderRadius: '16px 16px 4px 16px', background: '#006A6E', color: '#fff' }}>Explain photosynthesis simply 🌱</div>
                    <div style={{ marginTop: 10, maxWidth: '94%', fontSize: 13, padding: '11px 13px', borderRadius: '16px 16px 16px 4px', background: '#FFF8F0', border: '1px solid rgb(184 134 11 / 0.22)', color: '#0A0F1E', lineHeight: 1.55 }}>
                      Plants make food from sunlight, water and CO₂ — turning light energy into glucose and releasing oxygen.
                      <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#FFF6E3', color: '#7A4A00' }}><Quote size={12} /> NCERT Sci 9 · p.96</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgb(0 106 110 / 0.12)', color: '#006A6E' }}><Layers size={12} /> Bloom: Understand</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, background: 'linear-gradient(135deg,#FFF3E6,#FFF8F0)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Zap size={17} style={{ color: '#A06504' }} /><span style={{ fontSize: 12, fontWeight: 800, color: '#0A0F1E' }}>FlashBharat</span></div>
                    <div style={{ borderRadius: 12, padding: 11, background: '#FFFCF7', border: '1px solid rgb(184 134 11 / 0.22)' }}>
                      <div style={{ fontSize: 11, color: '#5A4E3C', marginBottom: 3 }}>Q · Site of photosynthesis?</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0A0F1E' }}>Chloroplast</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, padding: 11, background: '#FFFCF7', border: '1px solid rgb(184 134 11 / 0.22)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 14, color: '#C0392B' }}><Flame size={17} /> 12</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 14, color: '#006A6E' }}><Trophy size={17} /> Lv 7</span>
                    </div>
                    <div style={{ fontSize: 10.5, textAlign: 'center', color: '#5A4E3C' }}>day streak · keep it alive!</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hint" style={{ display: 'flex', justifyContent: 'center', marginTop: 40, color: 'var(--accent-text)' }}><ChevronDown size={30} /></div>
          </section>

          {/* ───────── TRUST STRIP ───────── */}
          <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)' }}>
            <div style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '14px 30px', color: 'var(--muted)', fontWeight: 700, fontSize: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><BadgeCheck size={18} style={{ color: 'var(--accent-text)' }} /> NCERT-grounded</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Quote size={18} style={{ color: 'var(--peacock-teal)' }} /> Verifiable citations</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><GraduationCap size={18} style={{ color: 'var(--accent-text)' }} /> CBSE &amp; ICSE</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Layers size={18} style={{ color: 'var(--peacock-teal)' }} /> Bloom-tagged</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><WifiOff size={18} style={{ color: 'var(--accent-text)' }} /> Offline-ready</span>
            </div>
          </section>

          {/* ───────── FEATURES ───────── */}
          <section id="features" style={{ position: 'relative', padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--bg)' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <span className="eyebrow"><LayoutGrid size={17} /> The platform</span>
                <h2 className="h2" style={{ marginTop: 18 }}>Everything a serious learner needs, <span className="grad">in one place.</span></h2>
                <p className="sub">Cutting-edge technology that powers a personalised, trustworthy learning experience.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 22 }}>
                {FEATURES.map((f) => (
                  <div key={f.title} className="card lift" style={{ padding: 30 }}>
                    <CornerMotif />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <span className="plinth" style={{ width: 58, height: 58 }}><f.Icon size={28} /></span>
                      <div style={{ marginTop: 20, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>{f.tag}</div>
                      <h3 style={{ margin: '8px 0 10px', fontSize: 21, fontWeight: 800, color: 'var(--ink)' }}>{f.title}</h3>
                      <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, fontSize: 15 }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* chakra divider */}
          <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '8px 24px', background: 'var(--bg)' }}>
            <span style={{ height: 1.5, flex: 1, maxWidth: 200, background: 'linear-gradient(90deg,transparent,rgb(184 134 11 / 0.5))' }} />
            <ChakraWheel spin="spin-slow" />
            <span style={{ height: 1.5, flex: 1, maxWidth: 200, background: 'linear-gradient(270deg,transparent,rgb(184 134 11 / 0.5))' }} />
          </div>

          {/* ───────── AI TUTOR DEEP DIVE ───────── */}
          <section id="ai-tutor" style={{ position: 'relative', padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--panel-2)', overflow: 'hidden' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 52 }}>
                <span className="eyebrow"><Sparkles size={17} /> Sarvagya · Agentic RAG</span>
                <h2 className="h2" style={{ marginTop: 18 }}>A tutor that <span className="grad">cites the textbook.</span></h2>
                <p className="sub">Answers grounded in your NCERT books and tagged by Bloom’s level — then Practest turns understanding into exam-ready performance.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 26, alignItems: 'stretch' }}>
                {/* tutor mockup */}
                <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#FFFCF7', border: '1px solid rgb(255 215 0 / 0.3)', boxShadow: 'var(--card-shadow)' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 9, background: '#FFF8F0', borderBottom: '1px solid rgb(184 134 11 / 0.2)' }}>
                    <span className="plinth" style={{ width: 32, height: 32, borderRadius: 9 }}><Bot size={18} /></span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#0A0F1E' }}>Digi Tutor</span>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#00897B' }}><BadgeCheck size={15} /> grounded in NCERT</span>
                  </div>
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                    <div style={{ marginLeft: 'auto', width: 'fit-content', maxWidth: '85%', fontSize: 13.5, padding: '11px 14px', borderRadius: '16px 16px 4px 16px', background: '#006A6E', color: '#fff' }}>Why does ice float on water? (Class 9)</div>
                    <div style={{ maxWidth: '92%', fontSize: 13.5, padding: '12px 14px', borderRadius: '16px 16px 16px 4px', background: '#FFF8F0', border: '1px solid rgb(184 134 11 / 0.2)', color: '#0A0F1E', lineHeight: 1.6 }}>
                      Ice floats because water expands when it freezes — the molecules form an open hexagonal lattice, making ice <em>less dense</em> than liquid water.
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#FFF6E3', color: '#7A4A00' }}><Quote size={13} /> NCERT Sci 9 · Ch 10, p.132</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgb(0 106 110 / 0.12)', color: '#006A6E' }}><Layers size={13} /> Bloom: Understand</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 9, fontSize: 11.5, fontWeight: 700, color: '#7A4A00', background: '#FFF6E3', border: '1px solid rgb(160 101 4 / 0.15)' }}>Explain simpler</span>
                      <span style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 9, fontSize: 11.5, fontWeight: 700, color: '#006A6E', background: 'rgb(0 106 110 / 0.1)', border: '1px solid rgb(0 106 110 / 0.15)' }}>Give an example</span>
                      <span style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 9, fontSize: 11.5, fontWeight: 700, color: '#1A237E', background: 'rgb(26 35 126 / 0.09)', border: '1px solid rgb(26 35 126 / 0.15)' }}>Test me</span>
                    </div>
                  </div>
                </div>
                {/* practest mockup */}
                <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#FFFCF7', border: '1px solid rgb(255 215 0 / 0.3)', boxShadow: 'var(--card-shadow)' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 9, background: '#FFF8F0', borderBottom: '1px solid rgb(184 134 11 / 0.2)' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(135deg,#1A237E,#0D1B6E)' }}><BarChart3 size={18} /></span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#0A0F1E' }}>Practest · Adaptive</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#5A4E3C' }}>CAT engine</span>
                  </div>
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0F1E' }}>Q4 · Thermodynamics</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12.5, padding: '10px 12px', borderRadius: 9, background: 'rgb(0 137 123 / 0.12)', border: '1px solid #00897B', color: '#00695f', fontWeight: 700 }}>Heat flows hot → cold ✓</div>
                      <div style={{ fontSize: 12.5, padding: '10px 12px', borderRadius: 9, background: '#FFF8F0', border: '1px solid rgb(184 134 11 / 0.2)', color: '#5A4E3C' }}>Cold flows into hot bodies</div>
                      <div style={{ fontSize: 12.5, padding: '10px 12px', borderRadius: 9, background: '#FFF8F0', border: '1px solid rgb(184 134 11 / 0.2)', color: '#5A4E3C' }}>Temperature never equalizes</div>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: '#5A4E3C', marginBottom: 6 }}><span>Difficulty adapting to you</span><span style={{ color: '#A06504' }}>Level 7 / 10</span></div>
                      <div style={{ height: 9, borderRadius: 999, overflow: 'hidden', background: 'rgb(184 134 11 / 0.18)' }}><div style={{ height: '100%', width: '70%', borderRadius: 999, background: 'linear-gradient(90deg,#A06504,#FFD700)' }} /></div>
                      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                        {[['84%', 'Accuracy'], ['6🔥', 'Streak'], ['Apply', 'Bloom']].map(([v, l]) => (
                          <div key={l} style={{ borderRadius: 9, padding: 9, textAlign: 'center', background: '#FFF8F0', border: '1px solid rgb(184 134 11 / 0.2)' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0A0F1E' }}>{v}</div>
                            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#5A4E3C' }}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 36, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '14px 32px', color: 'var(--muted)', fontWeight: 700, fontSize: 14.5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BookOpen size={20} style={{ color: 'var(--accent-text)' }} /> NCERT-grounded answers</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Quote size={20} style={{ color: 'var(--peacock-teal)' }} /> Verifiable citations</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Layers size={20} style={{ color: 'var(--indigo-ink)' }} /> Bloom’s taxonomy tagging</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><BarChart3 size={20} style={{ color: 'var(--teal-light)' }} /> Computer-adaptive testing</span>
              </div>
            </div>
          </section>

          {/* ───────── HOW IT WORKS ───────── */}
          <section style={{ padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--bg)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 52 }}>
                <span className="eyebrow"><Route size={17} /> How it works</span>
                <h2 className="h2" style={{ marginTop: 18 }}>From doubt to <span className="grad">mastery</span> in three steps.</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22 }}>
                {STEPS.map((s) => (
                  <div key={s.n} className="card lift" style={{ padding: 30 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="plinth" style={{ width: 56, height: 56 }}><s.Icon size={27} /></span>
                      <span className="deva" style={{ fontSize: 40, color: 'var(--line)', lineHeight: 1 }}>{s.n}</span>
                    </div>
                    <h3 style={{ margin: '20px 0 9px', fontSize: 21, fontWeight: 800, color: 'var(--ink)' }}>{s.title}</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, fontSize: 15 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ───────── PRODUCTIVITY SUITE ───────── */}
          <section id="tools" style={{ padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--panel-2)' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 52 }}>
                <span className="eyebrow"><Puzzle size={17} /> Beyond the tutor</span>
                <h2 className="h2" style={{ marginTop: 18 }}>The <span className="grad">Productivity Suite.</span></h2>
                <p className="sub">A learning app should protect focus and motivation, not just serve content. These tools — built for Indian students — do exactly that.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 22 }}>
                {TOOLS.map((t2) => (
                  <div key={t2.name} className="card lift" style={{ padding: 28 }}>
                    <span className="plinth" style={{ width: 54, height: 54 }}><t2.Icon size={26} /></span>
                    <h3 style={{ margin: '18px 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{t2.name}</h3>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-text)', marginBottom: 10 }}>{t2.tagline}</div>
                    <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, fontSize: 14.5 }}>{t2.desc}</p>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 15, marginTop: 30 }}>Plus <strong style={{ color: 'var(--accent-text)' }}>Mitram</strong> — your focus companion that runs quick attention checks so you always study at your sharpest.</p>
            </div>
          </section>

          {/* ───────── PRICING ───────── */}
          <section id="pricing" style={{ padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--bg)' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 52 }}>
                <span className="eyebrow"><Tag size={17} /> Pricing</span>
                <h2 className="h2" style={{ marginTop: 18 }}>Simple, <span className="grad">transparent</span> plans.</h2>
                <p className="sub">Choose the plan for your journey. Every plan includes the citation-backed AI tutor.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
                {PLANS.map((pl) => (
                  <div key={pl.name} className="card lift" style={{ padding: 28, border: pl.featured ? '2px solid rgb(var(--accent-primary-rgb) / 0.6)' : '1px solid var(--line)' }}>
                    {pl.badge && (
                      <span style={{ position: 'absolute', top: 18, right: 18, fontSize: 11, fontWeight: 800, color: '#fff', padding: '4px 11px', borderRadius: 999, background: pl.tint }}>{pl.badge}</span>
                    )}
                    <pl.Icon size={38} style={{ color: pl.tint }} />
                    <h3 style={{ margin: '12px 0 8px', fontSize: 23, fontWeight: 800, color: 'var(--ink)' }}>{pl.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 38, fontWeight: 800, color: 'var(--ink)' }}>{pl.price}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 14 }}>{pl.unit}</span>
                    </div>
                    <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: 13.5 }}>{pl.blurb}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
                      {pl.feats.map((ft) => (
                        <div key={ft} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: 'var(--ink)' }}><Check size={18} style={{ color: 'var(--teal-light)', flex: 'none' }} /><span>{ft}</span></div>
                      ))}
                    </div>
                    <button onClick={goSignup} className="btn btn-ghost" style={{ width: '100%', fontSize: 14.5, padding: 12 }}>Choose {pl.name}</button>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginTop: 26 }}>7-day money-back on any paid plan · no-cost EMI available · cancel anytime.</p>
            </div>
          </section>

          {/* ───────── COUNTERS BAND ───────── */}
          <section id="about" style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(60px,8vw,100px) 24px', background: 'linear-gradient(135deg,var(--indigo-deep),var(--night-ink))', color: 'var(--ivory-cream)' }}>
            <div className="breathe" style={{ position: 'absolute', right: -140, top: -120, width: 460, opacity: 0.14, pointerEvents: 'none' }}>
              <RingMandala spin="spin-rev" />
            </div>
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 46 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: 'rgb(255 215 0 / 0.12)', color: 'var(--gold)', fontWeight: 700, fontSize: 13, border: '1px solid rgb(255 215 0 / 0.28)' }}><Sparkles size={17} /> Launching 2026 · Founding learners onboarding</span>
                <h2 className="h2" style={{ marginTop: 18, color: 'var(--ivory-cream)' }}>Built for every CBSE &amp; ICSE learner.</h2>
                <p className="sub" style={{ color: 'rgb(255 248 240 / 0.72)' }}>Not vanity metrics — the real capabilities students get from day one.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 18 }}>
                {COUNTERS.map((c) => (
                  <div key={c.label} style={{ textAlign: 'center', padding: '26px 16px', borderRadius: 'var(--radius)', background: 'rgb(255 248 240 / 0.06)', border: '1px solid rgb(255 215 0 / 0.22)', backdropFilter: 'blur(6px)' }}>
                    <c.Icon size={40} style={{ color: 'var(--gold)' }} />
                    <div style={{ fontSize: 'clamp(34px,4vw,46px)', fontWeight: 800, margin: '8px 0 2px', color: 'var(--ivory-cream)' }}>{c.value}</div>
                    <div style={{ color: 'rgb(255 248 240 / 0.72)', fontWeight: 700, fontSize: 14 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ───────── TESTIMONIALS ───────── */}
          <section style={{ padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--bg)' }}>
            <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
              <span className="eyebrow"><Heart size={17} /> Built with learners</span>
              <h2 className="h2" style={{ marginTop: 18 }}>Designed with <span className="grad">real learners.</span></h2>
              <p className="sub" style={{ marginBottom: 6 }}>We’re building Digi Classroom alongside students. These are the needs they voiced.</p>
              <p style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', opacity: 0.8, margin: '4px 0 40px' }}>Illustrative voices from design-partner interviews · launching 2026</p>

              <div className="card" style={{ padding: 'clamp(30px,5vw,52px)', textAlign: 'center' }}>
                <svg viewBox="0 0 200 200" width={120} height={120} aria-hidden="true" style={{ position: 'absolute', left: -24, bottom: -24, opacity: 0.1 }}>
                  <circle cx="100" cy="100" r="80" fill="none" stroke="var(--peacock-teal)" strokeWidth="2" strokeDasharray="4 8" />
                  <circle cx="100" cy="100" r="48" fill="none" stroke="var(--accent-primary)" strokeWidth="2" />
                  <circle cx="100" cy="100" r="16" fill="var(--gold)" />
                </svg>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 22, color: 'var(--gold)' }}>
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={22} fill="currentColor" />)}
                  </div>
                  <blockquote style={{ margin: 0, fontSize: 'clamp(19px,2.6vw,27px)', lineHeight: 1.5, fontStyle: 'italic', color: 'var(--ink)', fontWeight: 600 }}>“{t.quote}”</blockquote>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 28, flexWrap: 'wrap' }}>
                    <span className="plinth" style={{ width: 52, height: 52, flex: 'none', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 18 }}>{initials}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>{t.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 14 }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 26 }}>
                <button onClick={() => setActiveT((activeT + TESTIMONIALS.length - 1) % TESTIMONIALS.length)} aria-label="Previous" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={22} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {TESTIMONIALS.map((_, i) => (
                    <button key={i} onClick={() => setActiveT(i)} aria-label={`Show testimonial ${i + 1}`} style={{ width: i === activeT ? 26 : 10, height: 10, borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'all .3s', background: i === activeT ? 'linear-gradient(90deg,var(--saffron),var(--gold))' : 'var(--line)' }} />
                  ))}
                </div>
                <button onClick={() => setActiveT((activeT + 1) % TESTIMONIALS.length)} aria-label="Next" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={22} /></button>
              </div>
            </div>
          </section>

          {/* ───────── FAQ ───────── */}
          <section id="faq" style={{ padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--panel-2)' }}>
            <div style={{ maxWidth: 840, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <span className="eyebrow"><HelpCircle size={17} /> FAQ</span>
                <h2 className="h2" style={{ marginTop: 18 }}>Questions, <span className="grad">answered.</span></h2>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 34 }}>
                {(['students', 'teachers', 'parents'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setFaqTab(tab); setOpenFaq(0) }}
                    className={chipBase}
                    style={faqTab === tab
                      ? { padding: '10px 22px', fontSize: 15, textTransform: 'capitalize', border: '1px solid transparent', background: 'linear-gradient(135deg,var(--kumkum),var(--saffron))', color: '#fff', boxShadow: '0 8px 18px -8px rgba(192,57,43,.6)' }
                      : { padding: '10px 22px', fontSize: 15, textTransform: 'capitalize', border: '1px solid transparent', color: 'var(--muted)' }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {faqList.map((f, i) => (
                  <div key={f.q} className="card" style={{ boxShadow: 'none' }}>
                    <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, textAlign: 'left', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{f.q}</span>
                      <ChevronDown size={22} style={{ color: 'var(--accent-text)', flex: 'none', transition: 'transform .3s', transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                    {openFaq === i && (
                      <div style={{ padding: '0 22px 20px', color: 'var(--muted)', lineHeight: 1.65, fontSize: 15 }}>{f.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ───────── ECOSYSTEM ───────── */}
          <section style={{ padding: 'clamp(64px,9vw,116px) 24px', background: 'var(--bg)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <span className="eyebrow"><Share2 size={17} /> The Vidyaverse ecosystem</span>
                <h2 className="h2" style={{ marginTop: 18 }}>One login. <span className="grad">Three platforms.</span></h2>
                <p className="sub">Digi Classroom is part of the Vidyaverse trio — the tutor, the campus OS, and the digital library, all connected.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 20 }}>
                {TRIO.map((app) => (
                  <div key={app.name} className="card lift" style={{ padding: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="plinth" style={{ width: 50, height: 50 }}><app.Icon size={25} /></span>
                      {app.here && (
                        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', padding: '4px 10px', borderRadius: 999, background: 'linear-gradient(135deg,var(--kumkum),var(--saffron))' }}>You’re here</span>
                      )}
                    </div>
                    <h3 style={{ margin: '18px 0 3px', fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{app.name}</h3>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent-text)', marginBottom: 10 }}>{app.role}</div>
                    <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, fontSize: 14.5 }}>{app.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ───────── CTA + NEWSLETTER ───────── */}
          <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(64px,9vw,120px) 24px', background: 'linear-gradient(135deg,var(--kumkum),var(--saffron) 70%,var(--turmeric))', color: '#fff', textAlign: 'center' }}>
            <div className="breathe" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(120vw,900px)', opacity: 0.16, pointerEvents: 'none' }}>
              <svg viewBox="0 0 200 200" width="100%" className="spin-slow" aria-hidden="true" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
                <circle cx="100" cy="100" r="94" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="4 9" />
                <circle cx="100" cy="100" r="68" fill="none" stroke="#fff" strokeWidth="1" />
                <circle cx="100" cy="100" r="42" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2 6" />
                <circle cx="100" cy="100" r="15" fill="#fff" fillOpacity="0.5" />
              </svg>
            </div>
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.1, margin: 0, fontSize: 'clamp(32px,5vw,56px)' }}>Start learning the way you think.</h2>
              <p style={{ fontSize: 'clamp(16px,1.8vw,20px)', lineHeight: 1.55, margin: '18px auto 0', maxWidth: '52ch', color: 'rgba(255,255,255,.92)' }}>Join the founding cohort shaping the future of CBSE &amp; ICSE study. Get updates on new features and launch access.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', margin: '32px auto 0', maxWidth: 520 }}>
                <input type="email" placeholder="Enter your email address" aria-label="Email address" style={{ flex: 1, minWidth: 220, padding: '15px 20px', borderRadius: 999, border: 'none', fontFamily: 'var(--font-body)', fontSize: 15, background: 'rgba(255,255,255,.92)', color: '#241704', outline: 'none' }} />
                <button className="btn" style={{ background: 'var(--night-ink)', color: '#fff', padding: '15px 28px' }}><Send size={20} /> Notify me</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 22 }}>
                <button onClick={goSignup} className="btn" style={{ background: '#fff', color: 'var(--kumkum)' }}>Start free <Rocket size={20} /></button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Current footer — kept, outside the .dcl scope so it uses app tokens */}
      <LandingFooter />
    </>
  )
}
