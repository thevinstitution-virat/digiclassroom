/**
 * Enhanced MathJax Configuration for VG Kosh Formula Display
 * Supports mathematics, physics, and chemistry formulas with Indian educational context
 */

export const ENHANCED_MATHJAX_CONFIG = {
  tex: {
    // Input processors
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    processEscapes: true,
    processEnvironments: true,
    
    // Enhanced packages for comprehensive formula support
    packages: {
      '[+]': [
        'mhchem',        // Chemistry formulas
        'ams',           // Advanced math symbols
        'boldsymbol',    // Bold symbols
        'physics',       // Physics notation
        'cancel',        // Cancellation notation
        'color',         // Colored formulas
        'bbox',          // Boxing formulas
        'enclose'        // Enclosing notation
      ]
    },
    
    // Custom macros for Indian educational context
    macros: {
      // Common Indian mathematical notation
      'Rs': '\\text{₹}',
      'rupees': '\\text{rupees}',
      'metres': '\\text{m}',
      'litres': '\\text{L}',
      'kilometres': '\\text{km}',
      
      // Physics vectors (common in CBSE)
      'vF': '\\vec{F}',
      'va': '\\vec{a}',
      'vv': '\\vec{v}',
      'vr': '\\vec{r}',
      'vp': '\\vec{p}',
      
      // Chemistry shortcuts
      'water': '\\ce{H2O}',
      'oxygen': '\\ce{O2}',
      'hydrogen': '\\ce{H2}',
      'carbondioxide': '\\ce{CO2}',
      
      // Common mathematical functions
      'logten': '\\log_{10}',
      'loge': '\\ln',
      'antilog': '\\text{antilog}',
      
      // Grade-specific notation
      'classix': '\\text{Class IX}',
      'classx': '\\text{Class X}',
      'classxi': '\\text{Class XI}',
      'classxii': '\\text{Class XII}'
    },
    
    // Tags and equation numbering
    tags: 'ams',
    tagSide: 'right',
    tagIndent: '0.8em',
    
    // Error handling
    formatError: (jax: any, err: any) => {
      console.warn('MathJax Error:', err);
      return jax.formatError(err);
    }
  },
  
  // SVG output configuration (preferred for quality)
  svg: {
    scale: 1.25,              // 125% scaling for better readability
    minScale: 0.5,
    mtextInheritFont: true,
    merrorInheritFont: true,
    mathmlSpacing: false,
    skipAttributes: {},
    exFactor: 0.5,
    displayAlign: 'center',
    displayIndent: '0',
    fontCache: 'global',
    
    // Enhanced styling for Indian context
    internalSpeechTitles: true,
    titleID: 0
  },
  
  // CommonHTML fallback configuration
  'CommonHTML': {
    scale: 125,               // 125% scaling
    minScaleAdjust: 50,
    mtextInheritFont: true,
    merrorInheritFont: true,
    mathmlSpacing: false,
    skipAttributes: {},
    exFactor: 0.5,
    displayAlign: 'center',
    displayIndent: '0'
  },
  
  // Accessibility features
  options: {
    enableMenu: true,
    menuOptions: {
      settings: {
        zoom: 'Click',
        zscale: '150%'
      }
    },
    renderActions: {
      addMenu: [150, '', '']
    }
  },
  
  // Startup configuration
  startup: {
    pageReady: () => {
        // @ts-ignore
      return MathJax.startup.defaultPageReady().then(() => {
        // Add custom CSS for enhanced formula display
        const style = document.createElement('style');
        style.textContent = `
          /* Enhanced MathJax Display Styles for VG Kosh */
          .MathJax_Display {
            margin: 1.5em 0 !important;
            text-align: center !important;
            overflow-x: auto;
            overflow-y: hidden;
          }
          
          .MathJax {
            font-size: 110% !important;
            line-height: 1.4 !important;
          }
          
          mjx-container[display="true"] {
            margin: 1.5em 0 !important;
            text-align: center !important;
            overflow-x: auto;
            overflow-y: hidden;
          }
          
          /* Formula container styling */
          .formula-container {
            background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);
            border: 1px solid #e9d5ff;
            border-radius: 12px;
            padding: 1.5rem;
            margin: 1rem 0;
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
            position: relative;
          }
          
          .formula-container::before {
            content: "📐";
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            font-size: 1.2em;
            opacity: 0.6;
          }
          
          /* Chemistry formula styling */
          .chemistry-formula {
            background: linear-gradient(135deg, #f0fff4 0%, #dcfce7 100%);
            border-color: #bbf7d0;
          }
          
          .chemistry-formula::before {
            content: "🧪";
          }
          
          /* Physics formula styling */
          .physics-formula {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-color: #bfdbfe;
          }
          
          .physics-formula::before {
            content: "⚡";
          }
          
          /* Dark mode support */
          .dark .formula-container {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
            border-color: rgba(139, 92, 246, 0.3);
          }
          
          .dark .chemistry-formula {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
            border-color: rgba(34, 197, 94, 0.3);
          }
          
          .dark .physics-formula {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
            border-color: rgba(59, 130, 246, 0.3);
          }
          
          /* Mobile responsiveness */
          @media (max-width: 768px) {
            .MathJax_Display, mjx-container[display="true"] {
              margin: 1em 0 !important;
            }
            
            .formula-container {
              padding: 1rem;
              margin: 0.75rem 0;
            }
            
            .MathJax {
              font-size: 105% !important;
            }
          }
          
          /* High contrast mode for accessibility */
          @media (prefers-contrast: high) {
            .formula-container {
              border-width: 2px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
          }
          
          /* Print styles - consolidated in globals.css */
        `;
        document.head.appendChild(style);
        
        console.log('✅ Enhanced MathJax configuration loaded for VG Kosh');
      });
    }
  },
  
  // Loader configuration
  loader: {
    load: [
      '[tex]/mhchem',
      '[tex]/ams',
      '[tex]/physics',
      '[tex]/cancel',
      '[tex]/color',
      '[tex]/bbox',
      '[tex]/enclose'
    ]
  }
};

// MathJax initialization function
export function initializeMathJax() {
  if (typeof window !== 'undefined') {
    // Set global MathJax configuration
    (window as any).MathJax = ENHANCED_MATHJAX_CONFIG;
    
    // Load MathJax script directly (ES6 support is now standard)
    const mathJaxScript = document.createElement('script');
    mathJaxScript.id = 'MathJax-script';
    mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    mathJaxScript.async = true;
    document.head.appendChild(mathJaxScript);
  }
}

// Re-render MathJax for dynamic content
export function rerenderMathJax(element?: HTMLElement) {
  if (typeof window !== 'undefined' && (window as any).MathJax) {
    const MathJax = (window as any).MathJax;
    if (MathJax.typesetPromise) {
      return MathJax.typesetPromise(element ? [element] : undefined);
    }
  }
  return Promise.resolve();
}

// Check if MathJax is loaded
export function isMathJaxLoaded(): boolean {
  return typeof window !== 'undefined' && !!(window as any).MathJax?.typesetPromise;
}
