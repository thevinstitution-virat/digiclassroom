import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

const inter = Inter({ subsets: ["latin"] });

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
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>",
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
        {/* Google Fonts - Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
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
      <body className={inter.className}>
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
