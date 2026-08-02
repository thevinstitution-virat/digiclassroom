'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useState } from 'react'
// Shared brand mark, vendored from PDLMS. Replaces the GraduationCap-on-a-
// gradient-square tile: the trio now shares one circular mandala mark that
// takes each app's accent, so the SSO hop between products stays continuous.
import { MandalaMark } from '@/design/indic/motifs/mandala-mark'

interface NavbarProps {
  className?: string
}

export function Navbar({ className = '' }: NavbarProps) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Features', href: '#features' },
    { name: 'Plans', href: '#plans' },
    { name: 'About', href: '#about' },
    { name: 'Contact', href: '#contact' },
  ]

  // Parchment rather than white, so the bar belongs to the warm Indic canvas
  // underneath it instead of floating as a cool neutral strip.
  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md ${className}`}
      style={{
        background: 'rgb(var(--parchment-rgb) / 0.86)',
        borderBottom: '1px solid rgb(var(--temple-stone-rgb) / 0.22)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2.5">
              <MandalaMark size={36} />
              {/* Yatra One via --font-display, but as a <span>: this is a
                  wordmark, not a document heading, so it must not become an h1. */}
              <span
                className="text-xl tracking-tight text-[color:var(--night-ink)] dark:text-[color:var(--ivory-cream)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Digi Classroom
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="indic-muted hover:text-[color:var(--accent-strong)] dark:hover:text-[color:var(--accent-primary-dark)] transition-colors duration-200 font-semibold"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Right side - Theme Toggle and Auth Buttons */}
          <div className="flex items-center space-x-4">
            <ThemeToggle />

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => router.push('/sign-in')}
                className="indic-muted hover:text-[color:var(--accent-strong)] dark:hover:text-[color:var(--accent-primary-dark)] font-semibold px-3 py-2 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push('/sign-up')}
                className="indic-cta indic-cta--primary !min-h-0 !py-2 !px-5 text-sm"
              >
                Get Started
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg indic-muted hover:bg-[color:var(--accent-soft)] dark:hover:bg-white/5 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div
            className="md:hidden py-4"
            style={{ borderTop: '1px solid rgb(var(--temple-stone-rgb) / 0.22)' }}
          >
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="indic-muted hover:text-[color:var(--accent-strong)] dark:hover:text-[color:var(--accent-primary-dark)] transition-colors duration-200 font-semibold px-2 py-1"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div
                className="flex flex-col gap-3 pt-4"
                style={{ borderTop: '1px solid rgb(var(--temple-stone-rgb) / 0.22)' }}
              >
                <button
                  onClick={() => {
                    router.push('/sign-in')
                    setIsMenuOpen(false)
                  }}
                  className="text-left indic-muted hover:text-[color:var(--accent-strong)] dark:hover:text-[color:var(--accent-primary-dark)] font-semibold px-2 py-1"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    router.push('/sign-up')
                    setIsMenuOpen(false)
                  }}
                  className="indic-cta indic-cta--primary !min-h-0 !py-2.5 text-sm"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
