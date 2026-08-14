'use client'

import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react'
import { MandalaMark } from '@/design/indic/motifs/mandala-mark'

/**
 * LandingFooter — the app's existing footer, preserved verbatim from the prior
 * landing. Kept deliberately (per request) rather than porting the mock's
 * footer, and rendered OUTSIDE the `.dcl` wrapper so it uses the app's normal
 * tokens rather than the landing-scoped surface set.
 */
export function LandingFooter() {
  return (
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
  )
}
