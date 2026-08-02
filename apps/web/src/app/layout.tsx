import type { Metadata } from "next";
import Script from "next/script";

import { TRPCProvider } from '@/lib/trpc/provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { NotificationProvider } from '@/components/providers/notification-provider'
// Global CSS entry
import "./globals.css";
// Bring in additional global styles explicitly (avoid @import inside CSS)
import "../styles/vg-design-system.css";
import "../styles/vg-animations.css";
import "../styles/apple-landing.css";
import "../styles/whatsapp-chat.css";
// Indic design system — vendored from PDLMS (canonical source of truth).
// Do not edit files under design/indic/; edit them in PDLMS and re-run
// `node shared/design/indic/sync-indic.mjs`. Order is load-bearing: pigments,
// then this app's accent picked from them, then the system that consumes both,
// then the bridge that maps the accent onto shadcn's semantic tokens.
import "../design/indic/indic-tokens.css";
import "../design/indic/indic-app.css";
import "../design/indic/indic-design-system.css";
import "../styles/indic-bridge.css";
// Self-hosted fonts, imported here rather than from CSS so Next and Vite
// resolve them identically across the trio. Must precede indic-fonts.css.
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/yatra-one/400.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "../design/indic/indic-fonts.css";

export const metadata: Metadata = {
  title: "Virat Gyankosh - AI-Powered Educational Platform",
  description: "Revolutionizing personalized learning through intelligent AI agents and multi-tenant role-based access control",
  keywords: ["education", "AI", "learning", "tutoring", "personalized learning"],
  authors: [{ name: "Virat Gyankosh Team" }],
  openGraph: {
    title: "Virat Gyankosh - AI-Powered Educational Platform",
    description: "Revolutionizing personalized learning through intelligent AI agents",
    type: "website",
  },
  icons: {
    // Mandala mark, generated per-app from the Indic tokens
    // (shared/design/indic/build-indic-css.mjs) and synced into public/.
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Fonts are self-hosted via @fontsource (see imports above) — no
            render-blocking request to fonts.googleapis.com. */}
        {/* Perplexity-Level MathJax Configuration for VG Kosh */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
                window.MathJax = {
                  tex: {
                    // Perplexity-style delimiter configuration
                    inlineMath: [['\\\\(', '\\\\)']],
                    displayMath: [['\\\\[', '\\\\]']],
                    processEscapes: true,
                    processEnvironments: true,
                    processRefs: true,

                    // Enhanced package loading for comprehensive math support
                    packages: {
                      '[+]': [
                        'base',        // Basic LaTeX commands
                        'ams',         // AMS math extensions
                        'newcommand',  // Custom command definitions
                        'configmacros', // Configuration macros
                        'action',      // Action extensions
                        'autoload',    // Automatic package loading
                        'boldsymbol',  // Bold symbols
                        'color',       // Color support
                        'html',        // HTML integration
                        'unicode',     // Unicode support
                        'verb'         // Verbatim text
                      ]
                    },

                    // Advanced TeX processing options
                    tags: 'ams',
                    tagSide: 'right',
                    tagIndent: '0.8em',
                    useLabelIds: true,
                    multlineWidth: '85%',

                    // Custom macros for Indian educational context
                    macros: {
                      'Rs': '\\\\text{₹}',
                      'degree': '^{\\\\circ}',
                      'celsius': '^{\\\\circ}\\\\text{C}',
                      'fahrenheit': '^{\\\\circ}\\\\text{F}',
                      'kelvin': '\\\\text{K}',
                      'metre': '\\\\text{m}',
                      'kilogram': '\\\\text{kg}',
                      'second': '\\\\text{s}',
                      'ampere': '\\\\text{A}',
                      'mole': '\\\\text{mol}',
                      'candela': '\\\\text{cd}'
                    }
                  },

                  // High-quality SVG output configuration
                  svg: {
                    scale: 1.3,
                    minScale: 0.5,
                    mtextInheritFont: true,
                    merrorInheritFont: true,
                    mathmlSpacing: false,
                    skipAttributes: {},
                    exFactor: 0.5,
                    displayAlign: 'center',
                    displayIndent: '0',
                    fontCache: 'global',
                    localID: null,
                    internalSpeechTitles: true,
                    titleID: 0
                  },

                  // Performance and accessibility options
                  options: {
                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'a'],
                    includeHtmlTags: {
                      br: '\\\\n',
                      wbr: '',
                      '#comment': ''
                    },
                    processHtmlClass: 'tex2jax_process|mathjax_process',
                    ignoreHtmlClass: 'tex2jax_ignore|mathjax_ignore',
                    renderActions: {
                      addMenu: [0, '', '']
                    }
                  },

                  // Enhanced startup configuration
                  startup: {
                    ready: () => {
                      console.log('🚀 Perplexity-level MathJax initializing for VG Kosh...');
                      MathJax.startup.defaultReady();
                    },
                    pageReady: () => {
                      return MathJax.startup.defaultPageReady().then(() => {
                        console.log('✅ Advanced MathJax ready - Perplexity-level rendering enabled');

                        // Add custom CSS for enhanced formula display
                        const style = document.createElement('style');
                        style.textContent = \`
                          mjx-container[display="true"] {
                            margin: 1.5em 0 !important;
                            text-align: center !important;
                            overflow-x: auto;
                            overflow-y: hidden;
                            padding: 0.5em;
                            background: rgba(255, 255, 255, 0.02);
                            border-radius: 8px;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                          }

                          mjx-container {
                            line-height: 1.4 !important;
                            font-size: 110% !important;
                          }

                          .formula-container mjx-container[display="true"] {
                            background: rgba(255, 255, 255, 0.8);
                            border: 1px solid rgba(139, 92, 246, 0.2);
                          }

                          .dark .formula-container mjx-container[display="true"] {
                            background: rgba(0, 0, 0, 0.2);
                            border: 1px solid rgba(139, 92, 246, 0.4);
                          }
                        \`;
                        document.head.appendChild(style);
                      });
                    }
                  },

                  // Loader configuration for dynamic loading
                  loader: {
                    load: ['input/tex', 'output/svg'],
                    failed: (err) => {
                      console.warn('MathJax package loading failed:', err);
                    }
                  }
                };
              `
          }}
        />
        <Script src="https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js" strategy="beforeInteractive" />
        <Script
          id="MathJax-script"
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"
          strategy="lazyOnload"
        />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
