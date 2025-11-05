/**
 * Mathematical Content Formatting Engine for AI Tutor Responses
 * Converts mathematical expressions to LaTeX and applies proper formatting
 */

import { PlainTextFormatter } from './plain-text-formatter'

export interface MathExpression {
  original: string
  latex: string
  isInline: boolean
  startIndex: number
  endIndex: number
  confidence: number
}

export interface FormattedMathContent {
  content: string
  mathExpressions: MathExpression[]
  appliedTransformations: string[]
  requiresMathjax: boolean
}

export class MathFormatter {
  // Greek letter mappings
  private static readonly GREEK_LETTERS = new Map([
    ['alpha', 'α'], ['Alpha', 'Α'],
    ['beta', 'β'], ['Beta', 'Β'],
    ['gamma', 'γ'], ['Gamma', 'Γ'],
    ['delta', 'δ'], ['Delta', 'Δ'],
    ['epsilon', 'ε'], ['Epsilon', 'Ε'],
    ['zeta', 'ζ'], ['Zeta', 'Ζ'],
    ['eta', 'η'], ['Eta', 'Η'],
    ['theta', 'θ'], ['Theta', 'Θ'],
    ['iota', 'ι'], ['Iota', 'Ι'],
    ['kappa', 'κ'], ['Kappa', 'Κ'],
    ['lambda', 'λ'], ['Lambda', 'Λ'],
    ['mu', 'μ'], ['Mu', 'Μ'],
    ['nu', 'ν'], ['Nu', 'Ν'],
    ['xi', 'ξ'], ['Xi', 'Ξ'],
    ['omicron', 'ο'], ['Omicron', 'Ο'],
    ['pi', 'π'], ['Pi', 'Π'],
    ['rho', 'ρ'], ['Rho', 'Ρ'],
    ['sigma', 'σ'], ['Sigma', 'Σ'],
    ['tau', 'τ'], ['Tau', 'Τ'],
    ['upsilon', 'υ'], ['Upsilon', 'Υ'],
    ['phi', 'φ'], ['Phi', 'Φ'],
    ['chi', 'χ'], ['Chi', 'Χ'],
    ['psi', 'ψ'], ['Psi', 'Ψ'],
    ['omega', 'ω'], ['Omega', 'Ω']
  ])

  // Mathematical symbol mappings
  private static readonly MATH_SYMBOLS = new Map([
    ['infinity', '∞'], ['infty', '∞'],
    ['sum', '∑'], ['Sum', '∑'],
    ['integral', '∫'], ['int', '∫'],
    ['partial', '∂'],
    ['nabla', '∇'], ['del', '∇'],
    ['sqrt', '√'],
    ['cbrt', '∛'],
    ['pm', '±'], ['plusminus', '±'],
    ['mp', '∓'], ['minusplus', '∓'],
    ['times', '×'], ['cdot', '·'],
    ['div', '÷'], ['divide', '÷'],
    ['neq', '≠'], ['ne', '≠'],
    ['leq', '≤'], ['le', '≤'],
    ['geq', '≥'], ['ge', '≥'],
    ['approx', '≈'],
    ['equiv', '≡'],
    ['propto', '∝'],
    ['therefore', '∴'],
    ['because', '∵'],
    ['angle', '∠'],
    ['degree', '°'],
    ['prime', '′'],
    ['doubleprime', '″']
  ])

  // LaTeX transformation rules
  private static readonly LATEX_RULES = [
    // Fractions
    {
      pattern: /(\d+)\/(\d+)/g,
      replacement: '\\frac{$1}{$2}',
      description: 'Convert simple fractions to LaTeX'
    },
    {
      pattern: /\(([^)]+)\)\/\(([^)]+)\)/g,
      replacement: '\\frac{$1}{$2}',
      description: 'Convert complex fractions to LaTeX'
    },

    // Powers and subscripts
    {
      pattern: /(\w+)\^(\d+)/g,
      replacement: '$1^{$2}',
      description: 'Format simple powers'
    },
    {
      pattern: /(\w+)\^{([^}]+)}/g,
      replacement: '$1^{$2}',
      description: 'Format complex powers'
    },
    {
      pattern: /(\w+)_(\d+)/g,
      replacement: '$1_{$2}',
      description: 'Format simple subscripts'
    },
    {
      pattern: /(\w+)_{([^}]+)}/g,
      replacement: '$1_{$2}',
      description: 'Format complex subscripts'
    },

    // Square roots
    {
      pattern: /sqrt\(([^)]+)\)/g,
      replacement: '\\sqrt{$1}',
      description: 'Convert square roots to LaTeX'
    },
    {
      pattern: /√(\d+)/g,
      replacement: '\\sqrt{$1}',
      description: 'Convert radical symbols to LaTeX'
    },

    // Integrals
    {
      pattern: /integral\s+([^d]+)\s+d([a-zA-Z])/g,
      replacement: '\\int $1 \\, d$2',
      description: 'Format integrals'
    },
    {
      pattern: /∫\s*([^d]+)\s*d([a-zA-Z])/g,
      replacement: '\\int $1 \\, d$2',
      description: 'Format integral symbols'
    },

    // Summations
    {
      pattern: /sum\s*\(([^=]+)=([^,]+),([^)]+)\)\s*([^$]+)/g,
      replacement: '\\sum_{$1=$2}^{$3} $4',
      description: 'Format summations with bounds'
    },
    {
      pattern: /∑\s*\(([^=]+)=([^,]+),([^)]+)\)\s*([^$]+)/g,
      replacement: '\\sum_{$1=$2}^{$3} $4',
      description: 'Format summation symbols with bounds'
    },

    // Limits
    {
      pattern: /lim\s*\(([^→]+)→([^)]+)\)\s*([^$]+)/g,
      replacement: '\\lim_{$1 \\to $2} $3',
      description: 'Format limits'
    },

    // Derivatives
    {
      pattern: /d\/d([a-zA-Z])\s*\(([^)]+)\)/g,
      replacement: '\\frac{d}{d$1}($2)',
      description: 'Format derivatives'
    },
    {
      pattern: /∂\/∂([a-zA-Z])\s*\(([^)]+)\)/g,
      replacement: '\\frac{\\partial}{\\partial $1}($2)',
      description: 'Format partial derivatives'
    },

    // Trigonometric functions
    {
      pattern: /\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\s*\(([^)]+)\)/g,
      replacement: '\\$1($2)',
      description: 'Format trigonometric functions'
    },

    // Logarithms
    {
      pattern: /\blog\s*\(([^)]+)\)/g,
      replacement: '\\log($1)',
      description: 'Format logarithms'
    },
    {
      pattern: /\bln\s*\(([^)]+)\)/g,
      replacement: '\\ln($1)',
      description: 'Format natural logarithms'
    },

    // Matrices (simple 2x2)
    {
      pattern: /\[\s*([^,\]]+),\s*([^,\]]+)\s*;\s*([^,\]]+),\s*([^\]]+)\s*\]/g,
      replacement: '\\begin{pmatrix} $1 & $2 \\\\ $3 & $4 \\end{pmatrix}',
      description: 'Format 2x2 matrices'
    },

    // Vectors
    {
      pattern: /vector\(([^)]+)\)/g,
      replacement: '\\vec{$1}',
      description: 'Format vectors'
    },
    {
      pattern: /\|([^|]+)\|/g,
      replacement: '\\left|$1\\right|',
      description: 'Format absolute values'
    }
  ]

  /**
   * Format mathematical content with LaTeX rendering
   */
  static formatMathContent(content: string, classLevel?: string): FormattedMathContent {
    let formattedContent = content
    const mathExpressions: MathExpression[] = []
    const appliedTransformations: string[] = []
    let requiresMathjax = false

    // First apply plain text formatting
    const plainFormatted = PlainTextFormatter.formatContent(content, classLevel)
    formattedContent = plainFormatted.content

    // Convert Greek letter names to symbols
    this.GREEK_LETTERS.forEach((symbol, name) => {
      const regex = new RegExp(`\\b${name}\\b`, 'g')
      if (regex.test(formattedContent)) {
        formattedContent = formattedContent.replace(regex, symbol)
        appliedTransformations.push(`Converted ${name} to ${symbol}`)
      }
    })

    // Convert mathematical symbols
    this.MATH_SYMBOLS.forEach((symbol, name) => {
      const regex = new RegExp(`\\b${name}\\b`, 'g')
      if (regex.test(formattedContent)) {
        formattedContent = formattedContent.replace(regex, symbol)
        appliedTransformations.push(`Converted ${name} to ${symbol}`)
      }
    })

    // Identify and convert mathematical expressions to LaTeX
    const mathExpressionRegex = /([a-zA-Z]\s*=\s*[^=\n]+|∫[^∫]*d[a-zA-Z]|∑[^∑]*=|√\d+|\d+\/\d+|\w+\^\d+|\w+_\d+)/g
    let match

    while ((match = mathExpressionRegex.exec(formattedContent)) !== null) {
      const originalExpr = match[0]
      let latexExpr = originalExpr

      // Apply LaTeX transformation rules
      for (const rule of this.LATEX_RULES) {
        const beforeTransform = latexExpr
        latexExpr = latexExpr.replace(rule.pattern, rule.replacement)
        
        if (beforeTransform !== latexExpr) {
          appliedTransformations.push(rule.description)
          requiresMathjax = true
        }
      }

      // Determine if inline or display math
      const isInline = originalExpr.length < 30 && !originalExpr.includes('∫') && !originalExpr.includes('∑')

      mathExpressions.push({
        original: originalExpr,
        latex: latexExpr,
        isInline,
        startIndex: match.index,
        endIndex: match.index + originalExpr.length,
        confidence: this.calculateMathConfidence(originalExpr)
      })
    }

    // Replace mathematical expressions with LaTeX markup
    let offset = 0
    for (const expr of mathExpressions) {
      const adjustedStart = expr.startIndex + offset
      const adjustedEnd = expr.endIndex + offset
      
      const latexMarkup = expr.isInline ? `$${expr.latex}$` : `$$${expr.latex}$$`
      
      formattedContent = 
        formattedContent.substring(0, adjustedStart) +
        latexMarkup +
        formattedContent.substring(adjustedEnd)
      
      offset += latexMarkup.length - expr.original.length
    }

    // Apply class-level specific mathematical formatting
    if (classLevel) {
      formattedContent = this.applyClassLevelMathFormatting(formattedContent, classLevel)
    }

    return {
      content: formattedContent,
      mathExpressions,
      appliedTransformations,
      requiresMathjax
    }
  }

  /**
   * Calculate confidence score for mathematical expression detection
   */
  private static calculateMathConfidence(expression: string): number {
    let score = 0.5 // Base score

    // Increase confidence for mathematical indicators
    if (/[=<>≤≥≠]/.test(expression)) score += 0.2
    if (/[+\-×÷]/.test(expression)) score += 0.1
    if (/\d+\/\d+/.test(expression)) score += 0.2 // Fractions
    if (/\w+\^\d+/.test(expression)) score += 0.2 // Powers
    if (/[αβγδεζηθικλμνξοπρστυφχψω]/.test(expression)) score += 0.3 // Greek letters
    if (/∫|∑|∂|∇/.test(expression)) score += 0.4 // Advanced math symbols
    if (/\b(sin|cos|tan|log|ln|sqrt)\b/.test(expression)) score += 0.2 // Functions

    return Math.min(1.0, score)
  }

  /**
   * Apply class-level specific mathematical formatting
   */
  private static applyClassLevelMathFormatting(content: string, classLevel: string): string {
    const classNumber = parseInt(classLevel.replace(/[^0-9]/g, ''))
    
    if (classNumber <= 5) {
      // Primary level - simple arithmetic with visual aids
      content = content.replace(/\$([^$]+)\$/g, '🔢 $$$1$$ 🔢')
    } else if (classNumber <= 8) {
      // Middle school - basic algebra and geometry
      content = content.replace(/\$\$([^$]+)\$\$/g, '📐 $$$$1$$$$ 📐')
    } else if (classNumber <= 10) {
      // Secondary level - advanced algebra and basic calculus
      content = content.replace(/\\int|\\sum/g, '📊 $&')
    } else {
      // Senior secondary - advanced calculus and competitive exam prep
      content = content.replace(/\\frac|\\int|\\sum|\\lim/g, '🎯 $&')
    }

    return content
  }

  /**
   * Generate step-by-step solution formatting
   */
  static formatStepByStepSolution(steps: string[]): string {
    return steps.map((step, index) => {
      const stepNumber = index + 1
      const formattedStep = this.formatMathContent(step).content
      return `**Step ${stepNumber}:** ${formattedStep}`
    }).join('\n\n')
  }

  /**
   * Format mathematical proofs
   */
  static formatMathematicalProof(proof: string): string {
    let formattedProof = proof

    // Format proof structure
    formattedProof = formattedProof.replace(/^(Given|To Prove|Proof|Solution):/gm, '**$1:**')
    formattedProof = formattedProof.replace(/^(Therefore|Hence|Thus|So)/gm, '**$1**')
    formattedProof = formattedProof.replace(/(Q\.E\.D\.|QED)/g, '**$1**')

    // Apply mathematical formatting
    const mathFormatted = this.formatMathContent(formattedProof)
    
    return mathFormatted.content
  }

  /**
   * Format physics equations with units
   */
  static formatPhysicsEquation(equation: string): string {
    let formatted = equation

    // Common physics units
    const units = [
      'm', 'kg', 's', 'A', 'K', 'mol', 'cd', // SI base units
      'Hz', 'N', 'Pa', 'J', 'W', 'C', 'V', 'F', 'Ω', 'S', 'Wb', 'T', 'H', // Derived units
      'km', 'cm', 'mm', 'g', 'mg', 'L', 'mL' // Common variations
    ]

    // Format units in equations
    units.forEach(unit => {
      const regex = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${unit})\\b`, 'g')
      formatted = formatted.replace(regex, '$1\\,\\text{$2}')
    })

    // Format scientific notation
    formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*[×x]\s*10\^([+-]?\d+)/g, '$1 \\times 10^{$2}')

    return this.formatMathContent(formatted).content
  }

  /**
   * Validate LaTeX expressions
   */
  static validateLatex(latex: string): {isValid: boolean, errors: string[]} {
    const errors: string[] = []
    
    // Check for balanced braces
    const openBraces = (latex.match(/{/g) || []).length
    const closeBraces = (latex.match(/}/g) || []).length
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced braces in LaTeX expression')
    }

    // Check for balanced parentheses
    const openParens = (latex.match(/\(/g) || []).length
    const closeParens = (latex.match(/\)/g) || []).length
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in LaTeX expression')
    }

    // Check for valid LaTeX commands
    const invalidCommands = latex.match(/\\[a-zA-Z]+/g)?.filter(cmd => {
      const validCommands = ['frac', 'sqrt', 'int', 'sum', 'lim', 'sin', 'cos', 'tan', 'log', 'ln', 'vec', 'begin', 'end', 'left', 'right', 'text', 'times', 'to', 'partial']
      return !validCommands.includes(cmd.substring(1))
    }) || []

    if (invalidCommands.length > 0) {
      errors.push(`Invalid LaTeX commands: ${invalidCommands.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
