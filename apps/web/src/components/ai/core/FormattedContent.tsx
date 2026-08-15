'use client'

import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { IntelligentFormatter, IntelligentFormattingResult, FormattingOptions } from '@/lib/ai/formatting/intelligent-formatter'
import { Card, CardContent } from '@/components/core/ui/card'
import { Badge } from '@/components/core/ui/badge'
import { Button } from '@/components/core/ui/button'
import {
  Eye,
  EyeOff,
  Code,
  Calculator,
  Beaker,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

/**
 * Simple markdown sanitizer - ONLY fixes critical rendering issues
 * NO re-formatting, NO structure changes, NO content analysis
 * All formatting is handled by backend UnifiedFormatter
 */
function sanitizeMarkdown(content: string): string {
  let sanitized = content
    // Normalize line endings (Windows -> Unix)
    .replace(/\r\n/g, '\n')
    // Fix broken heading syntax (### text ### -> ### text)
    .replace(/###\s*([^#\n]+?)###/g, '### $1')
    .replace(/##\s*([^#\n]+?)##/g, '## $1')
    // Fix unclosed bold markers (** text -> **text)
    .replace(/\*\*\s+/g, '**')
    .replace(/\s+\*\*/g, '**')
    // CRITICAL: DO NOT reduce excessive whitespace - we need blank lines for paragraph breaks
    // .replace(/\n{4,}/g, '\n\n\n')  // REMOVED - this was collapsing our paragraph spacing!
    .trim()

  // We removed the HTML div wrapping because it breaks react-markdown's ability
  // to parse markdown inside the block.
  // The key terms section will now just render as standard markdown headings/paragraphs.
  
  return sanitized
}

interface FormattedContentProps {
  content: string
  options?: FormattingOptions
  showMetadata?: boolean
  enableInteractiveFeatures?: boolean
  className?: string
}

function FormattedContent({
  content,
  options = {},
  showMetadata = false,
  enableInteractiveFeatures = true,
  className = ''
}: FormattedContentProps) {
  const [formattingResult, setFormattingResult] = useState<IntelligentFormattingResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Enhanced markdown renderer for fallback
  const renderMarkdownToHTML = (text: string): string => {
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-foreground mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-foreground mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-foreground mt-8 mb-4">$1</h1>')

      // Bold and Italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em class="font-bold italic">$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-foreground">$1</em>')

      // Lists
      .replace(/^\d+\.\s+(.*$)/gim, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^[-*]\s+(.*$)/gim, '<li class="ml-4 mb-1 list-disc">$1</li>')

      // Code blocks
      .replace(/```(.*?)```/gs, '<pre class="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto"><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')

      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br>')

      // Wrap in paragraph tags
      .replace(/^(.*)$/gm, '<p class="mb-3">$1</p>')

      // Clean up empty paragraphs
      .replace(/<p class="mb-3"><\/p>/g, '')

      // Wrap lists properly
      .replace(/(<li.*?<\/li>)/gs, '<ul class="list-disc ml-6 mb-4">$1</ul>')
      .replace(/<\/ul>\s*<ul class="list-disc ml-6 mb-4">/g, '');

    return html;
  }

  useEffect(() => {
    const formatContent = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await IntelligentFormatter.formatContent(content, {
          enableAdvancedFormatting: true,
          enableAccessibilityFeatures: false,  // DISABLED: ReactMarkdown handles markdown rendering, not HTML
          enableDiagramGeneration: true,
          maxFormattingComplexity: 'advanced',
          ...options
        })

        // Debug logging
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('✅ IntelligentFormatter succeeded')
          console.log('📊 Applied formatters:', result.appliedFormatters)
        }

        // Check if formatting result has errors but still has content
        if (result.qualityAssurance.errors.length > 0 && result.formattedContent === content) {
          console.warn('Formatting had errors, using simple fallback:', result.qualityAssurance.errors)
          // Create a simple fallback result
          const fallbackResult = {
            ...result,
            formattedContent: content,
            appliedFormatters: ['Simple Text Display'],
            qualityAssurance: {
              ...result.qualityAssurance,
              warnings: [...result.qualityAssurance.warnings, 'Using simple text display due to formatting errors']
            }
          }
          setFormattingResult(fallbackResult)
        } else {
          setFormattingResult(result)
        }
      } catch (err) {
        console.error('Content formatting error:', err)
        // Create a minimal fallback result instead of showing error
        const fallbackResult = {
          originalContent: content,
          formattedContent: content,
          contentAnalysis: {
            contentType: 'plain' as const,
            confidence: 0.5,
            detectedElements: {
              hasEquations: false,
              hasChemicalFormulas: false,
              hasGreekSymbols: false,
              hasCodeBlocks: false,
              hasDiagrams: false,
              hasProperNouns: false,
              hasDefinitions: false,
              hasQuotations: false,
              hasDates: false
            },
            subjectHints: []
          },
          appliedFormatters: ['Simple Text Display (Error Fallback)'],
          formattingMetadata: {
            requiresMathjax: false,
            requiresChemicalRendering: false,
            hasCodeBlocks: false,
            hasDiagrams: false,
            accessibilityScore: 0.5
          },
          performanceMetrics: {
            analysisTime: 0,
            formattingTime: 0,
            totalTime: 0
          },
          qualityAssurance: {
            errors: [],
            warnings: ['Formatting failed, displaying content as plain text'],
            suggestions: []
          }
        }
        setFormattingResult(fallbackResult)
      } finally {
        setIsLoading(false)
      }
    }

    if (content.trim()) {
      formatContent()
    } else {
      setIsLoading(false)
    }
  }, [content, options])

  // Loading state — only on the FIRST format (no prior result yet).
  // On re-formats we keep the previous content visible instead of flashing
  // this spinner, which otherwise causes whole-screen flicker when the parent
  // re-renders (e.g. on every keystroke in the chat input).
  if (isLoading && !formattingResult) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Clock className="h-5 w-5 animate-spin" />
          <span>Formatting content...</span>
        </div>
      </div>
    )
  }

  // Error state - use ReactMarkdown directly instead of HTML fallback
  // CRITICAL: Never use dangerouslySetInnerHTML as it bypasses ReactMarkdown
  // and causes key terms to render as raw <strong> tags
  if (error || !formattingResult) {
    const sanitized = sanitizeMarkdown(content)

    return (
      <div className="space-y-2">
        {error && (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2">
            ⚠️ Formatting error: {error}. Displaying with basic formatting.
          </div>
        )}
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {sanitized}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  const {
    formattedContent,
    contentAnalysis,
    appliedFormatters,
    formattingMetadata,
    performanceMetrics,
    qualityAssurance
  } = formattingResult

  // Check if we're in development mode more reliably
  const isDevelopment = typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    : process.env.NODE_ENV === 'development'

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Content Type Badge - Only in development */}
      {isDevelopment && (
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <ContentTypeBadge contentType={contentAnalysis.contentType} />
            {contentAnalysis.confidence > 0.8 && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                High Confidence
              </Badge>
            )}
          </div>

          {enableInteractiveFeatures && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOriginal(!showOriginal)}
                className="text-xs"
              >
                {showOriginal ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                {showOriginal ? 'Hide' : 'Show'} Original
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Original Content (if toggled) - Only in development */}
      {isDevelopment && showOriginal && (
        <Card className="bg-muted/40 border-border">
          <CardContent className="p-4">
            <h4 className="font-medium mb-2 text-foreground">Original Content:</h4>
            <div className="bg-white p-3 rounded border text-sm font-mono">
              {content}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teacher-friendly view with section cards when content looks like a lesson plan */}
      {/* We leave base renderer as is; page.tsx can switch to this container where needed */}

      {/* Export/Share actions (appear above content) */}
      <div className="no-print flex flex-wrap gap-2">
        {/* Buttons are provided by LessonActionBar in new lesson UI; here we keep simple hooks */}
      </div>

      {/* Formatted Content - Clean display in production */}
      <div className="bg-transparent">
        <FormattedContentRenderer
          content={formattedContent}
          metadata={formattingMetadata}
        />
      </div>

      {/* Metadata Panel - Only in development */}
      {isDevelopment && showMetadata && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-medium mb-3 text-blue-800">Formatting Metadata</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Applied Formatters */}
              <div>
                <h5 className="font-medium mb-2">Applied Formatters:</h5>
                <div className="space-y-1">
                  {appliedFormatters.map((formatter, index) => (
                    <Badge key={index} variant="secondary" className="mr-1 mb-1">
                      {formatter}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div>
                <h5 className="font-medium mb-2">Performance:</h5>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>Analysis: {performanceMetrics.analysisTime}ms</div>
                  <div>Formatting: {performanceMetrics.formattingTime}ms</div>
                  <div>Total: {performanceMetrics.totalTime}ms</div>
                  <div>Accessibility Score: {formattingMetadata.accessibilityScore}/100</div>
                </div>
              </div>

              {/* Quality Assurance */}
              {(qualityAssurance.errors.length > 0 || qualityAssurance.warnings.length > 0) && (
                <div className="md:col-span-2">
                  <h5 className="font-medium mb-2">Quality Assurance:</h5>

                  {qualityAssurance.errors.length > 0 && (
                    <div className="mb-2">
                      <h6 className="text-red-600 font-medium text-xs mb-1">Errors:</h6>
                      {qualityAssurance.errors.map((error, index) => (
                        <div key={index} className="text-xs text-red-600 mb-1">
                          • {error}
                        </div>
                      ))}
                    </div>
                  )}

                  {qualityAssurance.warnings.length > 0 && (
                    <div>
                      <h6 className="text-yellow-600 font-medium text-xs mb-1">Warnings:</h6>
                      {qualityAssurance.warnings.slice(0, 3).map((warning, index) => (
                        <div key={index} className="text-xs text-yellow-600 mb-1">
                          • {warning}
                        </div>
                      ))}
                      {qualityAssurance.warnings.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {qualityAssurance.warnings.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Memoized so an unchanged message subtree does not re-render (and re-run the
// async format effect) when the parent page re-renders on every keystroke.
// Relies on the parent passing a stable `options` object (see AITutorPage).
export default React.memo(FormattedContent)

// Content Type Badge Component - Hidden in production
function ContentTypeBadge({ contentType }: { contentType: string }) {
  // Check if we're in development mode
  const isDevelopment = typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    : process.env.NODE_ENV === 'development'

  // Don't render anything in production
  if (!isDevelopment) {
    return null
  }

  const configs = {
    mathematical: { icon: Calculator, color: 'bg-blue-100 text-blue-800', label: 'Mathematical' },
    chemical: { icon: Beaker, color: 'bg-green-100 text-green-800', label: 'Chemical' },
    mixed: { icon: Code, color: 'bg-purple-100 text-purple-800', label: 'Mixed Content' },
    plain: { icon: FileText, color: 'bg-muted text-foreground', label: 'Plain Text' }
  }

  const config = configs[contentType as keyof typeof configs] || configs.plain
  const Icon = config.icon

  return (
    <Badge className={`${config.color} border-0`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  )
}



// Formatted Content Renderer Component
function FormattedContentRenderer({
  content,
  metadata
}: {
  content: string
  metadata: IntelligentFormattingResult['formattingMetadata']
}) {
  const [renderedContent, setRenderedContent] = useState<string>('')

  useEffect(() => {
    // Apply simple sanitization only - all formatting done in backend
    const sanitized = sanitizeMarkdown(content)
    setRenderedContent(sanitized)
  }, [content, metadata])

  return (
    <>
      {/* Custom styling for Key Terms section */}
      <style jsx>{`
        .key-terms-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          background: linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 0.75rem;
          padding: 1.5rem;
          border: 1px solid #e2e8f0;
        }

        .key-terms-section h3 {
          color: #1e40af !important;
          font-size: 1.25rem !important;
          margin-bottom: 1.5rem !important;
          padding-bottom: 0.75rem !important;
          border-bottom: 2px solid #93c5fd !important;
          background: linear-gradient(to right, #dbeafe, #e0e7ff) !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0.5rem !important;
          margin-top: 0 !important;
        }

        .key-terms-section hr {
          display: none;
        }

        /* CRITICAL: Ensure all paragraphs have proper spacing */
        .key-terms-section p {
          margin-bottom: 1.5rem !important;
          margin-top: 0.5rem !important;
          display: block !important;
        }

        /* Term names (bold text) - styled as prominent boxes */
        .key-terms-section strong {
          display: block !important;
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          color: #1e3a8a !important;
          font-weight: 700 !important;
          font-size: 1.05rem !important;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid #bfdbfe;
          box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.08);
          margin-bottom: 0.75rem !important;
          margin-top: 0.5rem !important;
          width: fit-content;
          max-width: 100%;
        }

        /* Paragraphs containing term names */
        .key-terms-section p:has(strong) {
          margin-bottom: 0.5rem !important;
          margin-top: 1rem !important;
        }

        /* Definition paragraphs (without bold) */
        .key-terms-section p:not(:has(strong)) {
          color: #374151 !important;
          line-height: 1.8 !important;
          margin-top: 0.75rem !important;
          margin-bottom: 2rem !important;
          padding-left: 0.5rem;
          font-size: 0.95rem !important;
        }

        /* Add visual separator between terms */
        .key-terms-section p:not(:has(strong)) + p:has(strong) {
          margin-top: 2rem !important;
          padding-top: 1rem !important;
          border-top: 1px dashed #cbd5e1;
        }
      `}</style>

      <div className="formatted-content prose prose-base max-w-none prose-headings:font-bold prose-headings:text-foreground prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-6 prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-5 prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4 prose-p:mb-4 prose-p:leading-7 prose-p:text-foreground prose-li:mb-2 prose-li:leading-7 prose-ul:my-4 prose-ul:space-y-2 prose-ol:my-4 prose-ol:space-y-2 prose-strong:text-foreground prose-strong:font-semibold overflow-hidden break-words">
        <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Enhanced heading rendering with better spacing
          h1: ({node, ...props}) => (
            <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 border-b-2 border-border pb-2" {...props} />
          ),
          h2: ({node, ...props}) => (
            <h2 className="text-xl font-bold text-foreground mb-3 mt-5 border-b border-border pb-1" {...props} />
          ),
          h3: ({node, ...props}) => (
            <h3 className="text-lg font-bold text-foreground mb-2 mt-4" {...props} />
          ),

          // Enhanced paragraph rendering
          p: ({node, ...props}) => (
            <p className="mb-4 leading-7 text-foreground text-[15px]" {...props} />
          ),

          // Enhanced list rendering with better spacing
          ul: ({node, ...props}) => (
            <ul className="my-4 space-y-2 pl-6 list-disc" {...props} />
          ),
          ol: ({node, ...props}) => (
            <ol className="my-4 space-y-2 pl-6 list-decimal" {...props} />
          ),
          li: ({node, ...props}) => (
            <li className="leading-7 text-foreground pl-2" {...props} />
          ),

          // Prevent tables from causing horizontal overflow
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse" {...props} />
            </div>
          ),
          // Enhanced blockquote formatting
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-4 border-blue-400 pl-4 py-2 my-4 bg-blue-50 rounded-r-lg italic text-foreground" {...props} />
          ),
          // Enhanced strong (bold) text
          strong: ({node, ...props}) => (
            <strong className="font-bold text-foreground" {...props} />
          ),
          // Enhanced emphasis (italic) text
          em: ({node, ...props}) => (
            <em className="italic text-foreground" {...props} />
          ),
          // Prevent code blocks from causing horizontal overflow
          pre: ({node, ...props}) => (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-gray-900 text-green-400 p-4 rounded-lg my-4" {...props} />
          ),
          // Enhanced code formatting (inline and block)
          code: ({node, inline, className, children, ...props}: any) => {
            if (inline) {
              return (
                <code className="bg-blue-50 px-2 py-0.5 rounded text-sm font-mono text-blue-700 border border-blue-200" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="block bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono" {...props}>
                {children}
              </code>
            )
          },
          // Enhanced horizontal rule
          hr: ({node, ...props}) => (
            <hr className="my-6 border-t-2 border-border" {...props} />
          )
        }}
        >
          {renderedContent}
        </ReactMarkdown>
      </div>
    </>
  )
}
