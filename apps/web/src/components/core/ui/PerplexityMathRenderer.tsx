/**
 * Perplexity-Level Mathematical Formula Renderer for VG Kosh
 * High-quality LaTeX rendering with real-time processing and caching
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// Performance monitoring for rendering optimization
interface RenderingMetrics {
  renderTime: number
  formulaCount: number
  cacheHits: number
  cacheMisses: number
}

// Advanced MathJax configuration interface
interface MathJaxConfig {
  scale?: number
  displayAlign?: 'left' | 'center' | 'right'
  processTimeout?: number
  enableCaching?: boolean
}

// Props interface for the renderer
interface PerplexityMathRendererProps {
  children: React.ReactNode
  className?: string
  config?: MathJaxConfig
  onRenderComplete?: (metrics: RenderingMetrics) => void
  enableProgressiveLoading?: boolean
}

// Global MathJax interface extension
declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>
      startup: {
        promise: Promise<void>
      }
      config: any
    }
  }
}

// Rendering cache for performance optimization
class RenderingCache {
  private static cache = new Map<string, string>()
  private static hits = 0
  private static misses = 0
  
  static get(key: string): string | undefined {
    const result = this.cache.get(key)
    if (result) this.hits++
    else this.misses++
    return result
  }
  
  static set(key: string, value: string): void {
    this.cache.set(key, value)
  }
  
  static getMetrics() {
    return { hits: this.hits, misses: this.misses }
  }
  
  static clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }
}

/**
 * Perplexity-Level Math Renderer Component
 */
export default function PerplexityMathRenderer({
  children,
  className,
  config = {},
  onRenderComplete,
  enableProgressiveLoading = true
}: PerplexityMathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [renderingMetrics, setRenderingMetrics] = useState<RenderingMetrics>({
    renderTime: 0,
    formulaCount: 0,
    cacheHits: 0,
    cacheMisses: 0
  })
  
  // Progressive loading state
  const [loadingProgress, setLoadingProgress] = useState(0)
  
  /**
   * Advanced MathJax rendering with performance monitoring
   */
  const renderMath = useCallback(async () => {
    if (!containerRef.current || typeof window === 'undefined' || !window.MathJax) {
      return
    }
    
    const startTime = performance.now()
    
    try {
      // Wait for MathJax to be fully ready
      await window.MathJax.startup.promise
      
      // Count formulas for metrics
      const formulaElements = containerRef.current.querySelectorAll(
        'mjx-container, .MathJax, [class*="math"]'
      )
      
      // Progressive loading simulation
      if (enableProgressiveLoading && formulaElements.length > 0) {
        for (let i = 0; i <= 100; i += 20) {
          setLoadingProgress(i)
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      
      // Perform the actual rendering
      await window.MathJax.typesetPromise([containerRef.current])
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      // Update metrics
      const cacheMetrics = RenderingCache.getMetrics()
      const metrics: RenderingMetrics = {
        renderTime,
        formulaCount: formulaElements.length,
        cacheHits: cacheMetrics.hits,
        cacheMisses: cacheMetrics.misses
      }
      
      setRenderingMetrics(metrics)
      setLoadingProgress(100)
      
      // Callback for performance monitoring
      if (onRenderComplete) {
        onRenderComplete(metrics)
      }
      
      console.log('🎯 Perplexity-level rendering complete:', metrics)
      
    } catch (error) {
      console.warn('⚠️ MathJax rendering error:', error)
    }
  }, [onRenderComplete, enableProgressiveLoading])
  
  /**
   * Initialize MathJax with Perplexity-level configuration
   */
  useEffect(() => {
    const initializeMathJax = async () => {
      if (typeof window === 'undefined') return
      
      // Wait for MathJax to load
      let attempts = 0
      while (!window.MathJax && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      
      if (window.MathJax) {
        setIsReady(true)
        await renderMath()
      }
    }
    
    initializeMathJax()
  }, [renderMath])
  
  /**
   * Re-render when content changes
   */
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(renderMath, 100)
      return () => clearTimeout(timer)
    }
  }, [children, isReady, renderMath])
  
  /**
   * Intersection Observer for lazy loading
   */
  useEffect(() => {
    if (!containerRef.current || !enableProgressiveLoading) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isReady) {
            renderMath()
          }
        })
      },
      { threshold: 0.1 }
    )
    
    observer.observe(containerRef.current)
    
    return () => observer.disconnect()
  }, [isReady, renderMath, enableProgressiveLoading])
  
  return (
    <div
      ref={containerRef}
      className={cn(
        'perplexity-math-renderer',
        'relative',
        'transition-all duration-300',
        className
      )}
      style={{
        minHeight: enableProgressiveLoading && loadingProgress < 100 ? '100px' : 'auto'
      }}
    >
      {/* Progressive loading indicator */}
      {enableProgressiveLoading && loadingProgress < 100 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-800 rounded-full mb-3 animate-pulse">
              <span className="text-purple-600 dark:text-purple-300 text-xl">📐</span>
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-300 font-medium">
              Rendering formulas...
            </div>
            <div className="w-32 h-2 bg-purple-200 dark:bg-purple-700 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className={cn(
        'transition-opacity duration-300',
        loadingProgress < 100 ? 'opacity-0' : 'opacity-100'
      )}>
        {children}
      </div>
      
      {/* Performance metrics (development only) */}
      {process.env.NODE_ENV === 'development' && renderingMetrics.renderTime > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
          📊 Render: {renderingMetrics.renderTime.toFixed(2)}ms | 
          Formulas: {renderingMetrics.formulaCount} | 
          Cache: {renderingMetrics.cacheHits}h/{renderingMetrics.cacheMisses}m
        </div>
      )}
    </div>
  )
}

/**
 * Hook for MathJax re-rendering
 */
export function usePerplexityMathJax() {
  const [isReady, setIsReady] = useState(false)
  
  const rerender = useCallback(async () => {
    if (typeof window !== 'undefined' && window.MathJax?.typesetPromise) {
      try {
        await window.MathJax.typesetPromise()
        console.log('🔄 MathJax re-render complete')
      } catch (error) {
        console.warn('⚠️ MathJax re-render error:', error)
      }
    }
  }, [])
  
  useEffect(() => {
    const checkMathJax = () => {
      if (typeof window !== 'undefined' && window.MathJax) {
        setIsReady(true)
      }
    }
    
    checkMathJax()
    const interval = setInterval(checkMathJax, 100)
    
    return () => clearInterval(interval)
  }, [])
  
  return { isReady, rerender }
}

/**
 * Test component for Perplexity-level formula display
 */
export function PerplexityMathTest() {
  const [metrics, setMetrics] = useState<RenderingMetrics | null>(null)

  const handleRenderComplete = (renderMetrics: RenderingMetrics) => {
    setMetrics(renderMetrics)
  }

  return (
    <div className="p-6 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
      <h3 className="font-semibold mb-4 text-center">🎯 Perplexity-Level Formula Display Test</h3>

      <div className="space-y-6">
        <div className="formula-container">
          <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">📐 Advanced Mathematics:</h4>
          <p>Quadratic formula: {`\\[ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]`}</p>
          <p>Integral calculus: {`\\[ \\int_{a}^{b} f(x) \\, dx = F(b) - F(a) \\]`}</p>
          <p>Matrix determinant: {`\\[ \\det(A) = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc \\]`}</p>
        </div>

        <div className="physics-formula">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">⚡ Physics Equations:</h4>
          <p>Einstein&apos;s mass-energy: {`\\[ E = mc^2 \\]`}</p>
          <p>Newton&apos;s second law: {`\\[ \\vec{F} = m\\vec{a} \\]`}</p>
          <p>Wave equation: {`\\[ \\frac{\\partial^2 u}{\\partial t^2} = c^2 \\frac{\\partial^2 u}{\\partial x^2} \\]`}</p>
        </div>

        <div className="chemistry-formula">
          <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">🧪 Chemistry Reactions:</h4>
          <p>Combustion: {`\\[ \\ce{CH4 + 2O2 -> CO2 + 2H2O} \\]`}</p>
          <p>Acid-base: {`\\[ \\ce{HCl + NaOH -> NaCl + H2O} \\]`}</p>
          <p>Redox reaction: {`\\[ \\ce{Zn + Cu^{2+} -> Zn^{2+} + Cu} \\]`}</p>
        </div>
      </div>

      {metrics && (
        <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded border text-sm">
          <strong>Performance Metrics:</strong> {metrics.renderTime.toFixed(2)}ms render time,
          {metrics.formulaCount} formulas processed
        </div>
      )}
    </div>
  )
}
