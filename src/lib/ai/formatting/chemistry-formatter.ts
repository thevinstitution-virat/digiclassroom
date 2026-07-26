/**
 * Chemical Content Formatting Engine for AI Tutor Responses
 * Formats chemical formulas, equations, and nomenclature
 */

import { PlainTextFormatter } from './plain-text-formatter'

export interface ChemicalFormula {
  original: string
  formatted: string
  type: 'molecular' | 'ionic' | 'structural' | 'empirical'
  startIndex: number
  endIndex: number
  confidence: number
}

export interface ChemicalEquation {
  original: string
  formatted: string
  balanced: boolean
  reactants: string[]
  products: string[]
  startIndex: number
  endIndex: number
}

export interface FormattedChemicalContent {
  content: string
  formulas: ChemicalFormula[]
  equations: ChemicalEquation[]
  appliedTransformations: string[]
  requiresChemicalRendering: boolean
}

export class ChemistryFormatter {
  // Common chemical elements with their properties
  private static readonly ELEMENTS = new Map([
    ['H', { name: 'Hydrogen', atomicNumber: 1 }],
    ['He', { name: 'Helium', atomicNumber: 2 }],
    ['Li', { name: 'Lithium', atomicNumber: 3 }],
    ['Be', { name: 'Beryllium', atomicNumber: 4 }],
    ['B', { name: 'Boron', atomicNumber: 5 }],
    ['C', { name: 'Carbon', atomicNumber: 6 }],
    ['N', { name: 'Nitrogen', atomicNumber: 7 }],
    ['O', { name: 'Oxygen', atomicNumber: 8 }],
    ['F', { name: 'Fluorine', atomicNumber: 9 }],
    ['Ne', { name: 'Neon', atomicNumber: 10 }],
    ['Na', { name: 'Sodium', atomicNumber: 11 }],
    ['Mg', { name: 'Magnesium', atomicNumber: 12 }],
    ['Al', { name: 'Aluminum', atomicNumber: 13 }],
    ['Si', { name: 'Silicon', atomicNumber: 14 }],
    ['P', { name: 'Phosphorus', atomicNumber: 15 }],
    ['S', { name: 'Sulfur', atomicNumber: 16 }],
    ['Cl', { name: 'Chlorine', atomicNumber: 17 }],
    ['Ar', { name: 'Argon', atomicNumber: 18 }],
    ['K', { name: 'Potassium', atomicNumber: 19 }],
    ['Ca', { name: 'Calcium', atomicNumber: 20 }],
    ['Fe', { name: 'Iron', atomicNumber: 26 }],
    ['Cu', { name: 'Copper', atomicNumber: 29 }],
    ['Zn', { name: 'Zinc', atomicNumber: 30 }],
    ['Br', { name: 'Bromine', atomicNumber: 35 }],
    ['I', { name: 'Iodine', atomicNumber: 53 }],
    ['Ag', { name: 'Silver', atomicNumber: 47 }],
    ['Au', { name: 'Gold', atomicNumber: 79 }]
  ])

  // Common chemical compounds and their names
  private static readonly COMMON_COMPOUNDS = new Map([
    ['H2O', 'Water'],
    ['CO2', 'Carbon dioxide'],
    ['NaCl', 'Sodium chloride (Salt)'],
    ['CaCO3', 'Calcium carbonate'],
    ['H2SO4', 'Sulfuric acid'],
    ['HCl', 'Hydrochloric acid'],
    ['NaOH', 'Sodium hydroxide'],
    ['CH4', 'Methane'],
    ['C2H6', 'Ethane'],
    ['C6H12O6', 'Glucose'],
    ['NH3', 'Ammonia'],
    ['O2', 'Oxygen gas'],
    ['N2', 'Nitrogen gas'],
    ['Cl2', 'Chlorine gas'],
    ['CaO', 'Calcium oxide (Lime)'],
    ['Ca(OH)2', 'Calcium hydroxide'],
    ['MgO', 'Magnesium oxide'],
    ['Al2O3', 'Aluminum oxide'],
    ['SiO2', 'Silicon dioxide (Silica)']
  ])

  // Chemical reaction arrows and their meanings
  private static readonly REACTION_ARROWS = new Map([
    ['->', '→'],
    ['-->', '→'],
    ['<->', '⇌'],
    ['<-->', '⇌'],
    ['<=>', '⇌'],
    ['=>', '⇒'],
    ['==>', '⇒']
  ])

  // Ionic charges formatting
  private static readonly IONIC_CHARGES = [
    { pattern: /([A-Z][a-z]?)(\d*)(\+)(\d*)/g, replacement: '$1$2<sup>$4$3</sup>' },
    { pattern: /([A-Z][a-z]?)(\d*)(-)(\d*)/g, replacement: '$1$2<sup>$4$3</sup>' },
    { pattern: /\(([^)]+)\)(\+)(\d*)/g, replacement: '($1)<sup>$3$2</sup>' },
    { pattern: /\(([^)]+)\)(-)(\d*)/g, replacement: '($1)<sup>$3$2</sup>' }
  ]

  /**
   * Detect if content requires structural formula generation
   * Enhanced with context awareness to prevent false positives
   */
  static needsStructuralFormula(content: string, subject?: string, classLevel?: string): Array<{compound: string, context: string}> {
    const compounds = []
    const lowerContent = content.toLowerCase()

    // Only proceed if this is clearly chemistry content
    if (!this.isChemistryContext(content, subject, classLevel)) {
      return compounds
    }

    const structuralKeywords = [
      'structure', 'structural formula', 'draw', 'show', 'diagram', 'representation',
      'bond', 'molecular structure', 'arrangement', 'geometry', 'shape',
      'chemical structure', 'molecular geometry', 'lewis structure'
    ]

    // Check for structural keywords
    const hasStructuralKeyword = structuralKeywords.some(keyword => lowerContent.includes(keyword))

    if (hasStructuralKeyword) {
      // Extract compound names - only explicit chemical compounds
      const compoundPatterns = [
        /\b(methanol|ethanol|propanol|butanol)\b/gi,
        /\b(methane|ethane|propane|butane|pentane)\b/gi,
        /\b(ethene|propene|ethyne|propyne)\b/gi,
        /\b(benzene|toluene|phenol|aniline)\b/gi,
        /\b(formaldehyde|acetaldehyde|acetone)\b/gi,
        /\b(acetic acid|formic acid|citric acid)\b/gi,
        /\b(glycine|alanine|valine)\b/gi
        // Removed common words like 'water', 'ammonia', 'carbon dioxide' that cause issues in biology
      ]

      compoundPatterns.forEach(pattern => {
        const matches = content.match(pattern)
        if (matches) {
          matches.forEach(match => {
            // Additional validation to ensure it's in chemical context
            const matchContext = content.substring(Math.max(0, content.indexOf(match) - 50), content.indexOf(match) + match.length + 50)
            if (this.isValidChemicalContext(matchContext)) {
              compounds.push({
                compound: match.toLowerCase(),
                context: matchContext
              })
            }
          })
        }
      })
    }

    return compounds
  }

  /**
   * Check if the content is in a chemistry context
   */
  private static isChemistryContext(content: string, subject?: string, classLevel?: string): boolean {
    if (subject?.toLowerCase() === 'chemistry')
  return true
    if (classLevel?.toLowerCase().includes('chemistry'))
  return true

    const lowerContent = content.toLowerCase()
    const chemistryIndicators = [
      'chemical formula', 'molecular formula', 'chemical equation', 'chemical reaction',
      'organic chemistry', 'inorganic chemistry', 'chemical bond', 'chemical structure',
      'synthesis', 'catalyst', 'reagent', 'chemical properties'
    ]

    return chemistryIndicators.some(indicator => lowerContent.includes(indicator))
  }

  /**
   * Validate if the context around a match is truly chemical
   */
  private static isValidChemicalContext(context: string): boolean {
    const lowerContext = context.toLowerCase()

    // Biological context indicators that should exclude chemical processing
    const biologicalExclusions = [
      'tissue', 'cell', 'organ', 'plant', 'animal', 'living', 'organism',
      'biological', 'photosynthesis', 'respiration', 'digestion', 'metabolism'
    ]

    // If surrounded by biological terms, likely not chemical
    if (biologicalExclusions.some(term => lowerContext.includes(term))) {
      return false
    }

    // Chemical context indicators
    const chemicalIndicators = [
      'formula', 'structure', 'bond', 'molecule', 'compound', 'reaction',
      'synthesis', 'chemical', 'organic', 'inorganic'
    ]

    return chemicalIndicators.some(indicator => lowerContext.includes(indicator))
  }

  /**
   * Format chemical content with proper subscripts, superscripts, and nomenclature
   */
  static formatChemicalContent(content: string, classLevel?: string): FormattedChemicalContent {
    let formattedContent = content
    const formulas: ChemicalFormula[] = []
    const equations: ChemicalEquation[] = []
    const appliedTransformations: string[] = []
    let requiresChemicalRendering = false

    // First apply plain text formatting
    const plainFormatted = PlainTextFormatter.formatContent(content, classLevel)
    formattedContent = plainFormatted.content

    // Convert reaction arrows
    this.REACTION_ARROWS.forEach((symbol, arrow) => {
      const regex = new RegExp(arrow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      if (regex.test(formattedContent)) {
        formattedContent = formattedContent.replace(regex, symbol)
        appliedTransformations.push(`Converted ${arrow} to ${symbol}`)
        requiresChemicalRendering = true
      }
    })

    // Format chemical formulas with subscripts
    const formulaRegex = /\b([A-Z][a-z]?)(\d+)/g
    formattedContent = formattedContent.replace(formulaRegex, (match, element, number) => {
      if (this.ELEMENTS.has(element)) {
        appliedTransformations.push(`Formatted subscript in ${match}`)
        requiresChemicalRendering = true
        return `${element}<sub>${number}</sub>`
      }
      return match
    })

    // Format complex chemical formulas with parentheses
    const complexFormulaRegex = /\b([A-Z][a-z]?)(\d*)\(([A-Z][a-z]?\d*)+\)(\d+)/g
    formattedContent = formattedContent.replace(complexFormulaRegex, (match, element, count1, group, count2) => {
      appliedTransformations.push(`Formatted complex formula ${match}`)
      requiresChemicalRendering = true
      return `${element}${count1 ? `<sub>${count1}</sub>` : ''}(${group})<sub>${count2}</sub>`
    })

    // Format ionic charges
    this.IONIC_CHARGES.forEach(rule => {
      const originalContent = formattedContent
      formattedContent = formattedContent.replace(rule.pattern, rule.replacement)
      if (originalContent !== formattedContent) {
        appliedTransformations.push('Formatted ionic charges')
        requiresChemicalRendering = true
      }
    })

    // Identify and format chemical equations
    const equationRegex = /([A-Z][a-zA-Z0-9\s+()]*)\s*[→⇌⇄↔]\s*([A-Z][a-zA-Z0-9\s+()]*)/g
    let match

    while ((match = equationRegex.exec(formattedContent)) !== null) {
      const reactants = match[1].split('+').map(r => r.trim())
      const products = match[2].split('+').map(p => p.trim())
      
      equations.push({
        original: match[0],
        formatted: match[0], // Already formatted above
        balanced: this.checkEquationBalance(reactants, products),
        reactants,
        products,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      })
    }

    // Add compound names as tooltips or explanations
    this.COMMON_COMPOUNDS.forEach((name, formula) => {
      const regex = new RegExp(`\\b${formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
      if (regex.test(formattedContent)) {
        formattedContent = formattedContent.replace(regex, `**${formula}** (*${name}*)`)
        appliedTransformations.push(`Added name for ${formula}`)
      }
    })

    // Format organic chemistry nomenclature
    formattedContent = this.formatOrganicNomenclature(formattedContent)

    // Check if structural formulas are needed and generate them
    const structuralNeeds = this.needsStructuralFormula(content)
    if (structuralNeeds.length > 0) {
      structuralNeeds.forEach(({ compound, context }) => {
        const structuralFormula = this.generateStructuralFormula(compound, classLevel)

        // Insert structural formula after the compound mention
        const compoundRegex = new RegExp(`\\b${compound}\\b`, 'gi')
        formattedContent = formattedContent.replace(compoundRegex, (match) => {
          appliedTransformations.push(`Generated structural formula for ${compound}`)
          requiresChemicalRendering = true
          return `${match}\n\n${structuralFormula}`
        })
      })
    }

    // Apply class-level specific chemical formatting
    if (classLevel) {
      formattedContent = this.applyClassLevelChemicalFormatting(formattedContent, classLevel)
    }

    return {
      content: formattedContent,
      formulas,
      equations,
      appliedTransformations,
      requiresChemicalRendering
    }
  }

  /**
   * Format organic chemistry nomenclature
   */
  private static formatOrganicNomenclature(content: string): string {
    let formatted = content

    // IUPAC naming patterns
    const iupacPatterns = [
      { pattern: /\b(meth|eth|prop|but|pent|hex|hept|oct|non|dec)ane\b/g, type: 'alkane' },
      { pattern: /\b(meth|eth|prop|but|pent|hex|hept|oct|non|dec)ene\b/g, type: 'alkene' },
      { pattern: /\b(meth|eth|prop|but|pent|hex|hept|oct|non|dec)yne\b/g, type: 'alkyne' },
      { pattern: /\b(meth|eth|prop|but|pent|hex|hept|oct|non|dec)anol\b/g, type: 'alcohol' },
      { pattern: /\b(meth|eth|prop|but|pent|hex|hept|oct|non|dec)anoic acid\b/g, type: 'carboxylic acid' }
    ]

    iupacPatterns.forEach(({ pattern, type }) => {
      formatted = formatted.replace(pattern, (match) => `*${match}* (${type})`)
    })

    // Functional groups
    const functionalGroups = [
      'hydroxyl', 'carbonyl', 'carboxyl', 'amino', 'sulfhydryl', 'phosphate',
      'aldehyde', 'ketone', 'ester', 'ether', 'amine', 'amide'
    ]

    functionalGroups.forEach(group => {
      const regex = new RegExp(`\\b${group}\\b`, 'gi')
      formatted = formatted.replace(regex, `**${group}**`)
    })

    return formatted
  }

  /**
   * Check if a chemical equation is balanced
   */
  private static checkEquationBalance(reactants: string[], products: string[]): boolean {
    // Simplified balance check - count atoms on both sides
    const countAtoms = (compounds: string[]): Map<string, number> => {
      const atomCount = new Map<string, number>()
      
      compounds.forEach(compound => {
        // Remove HTML tags for counting
        const cleanCompound = compound.replace(/<[^>]*>/g, '')
        
        // Extract elements and their counts
        const elementMatches = cleanCompound.match(/([A-Z][a-z]?)(\d*)/g) || []
        
        elementMatches.forEach(match => {
          const elementMatch = match.match(/([A-Z][a-z]?)(\d*)/)
          if (elementMatch) {
            const element = elementMatch[1]
            const count = parseInt(elementMatch[2] || '1')
            atomCount.set(element, (atomCount.get(element) || 0) + count)
          }
        })
      })
      
      return atomCount
    }

    const reactantAtoms = countAtoms(reactants)
    const productAtoms = countAtoms(products)

    // Check if atom counts match
    for (const [element, count] of reactantAtoms) {
      if (productAtoms.get(element) !== count) {
        return false
      }
    }

    for (const [element, count] of productAtoms) {
      if (reactantAtoms.get(element) !== count) {
        return false
      }
    }

    return true
  }

  /**
   * Apply class-level specific chemical formatting
   */
  private static applyClassLevelChemicalFormatting(content: string, classLevel: string): string {
    const classNumber = parseInt(classLevel.replace(/[^0-9]/g, ''))
    
    if (classNumber <= 8) {
      // Middle school - basic chemistry with simple explanations
      content = content.replace(/\*\*([^*]+)\*\*/g, '🧪 **$1**')
    } else if (classNumber <= 10) {
      // Secondary level - more detailed chemical concepts
      content = content.replace(/→|⇌/g, '⚗️ $&')
    } else {
      // Senior secondary - advanced chemistry for competitive exams
      content = content.replace(/\b(IUPAC|organic|inorganic|physical chemistry)\b/gi, '🎯 **$&**')
    }

    return content
  }

  /**
   * Generate chemical equation balancing steps
   */
  static generateBalancingSteps(equation: string): string[] {
    const steps: string[] = []
    
    steps.push(`**Original equation:** ${equation}`)
    steps.push('**Step 1:** Count atoms of each element on both sides')
    steps.push('**Step 2:** Identify which elements are unbalanced')
    steps.push('**Step 3:** Add coefficients to balance the equation')
    steps.push('**Step 4:** Verify that all elements are balanced')
    steps.push('**Step 5:** Ensure coefficients are in lowest terms')
    
    return steps
  }

  /**
   * Format chemical reaction mechanisms
   */
  static formatReactionMechanism(mechanism: string): string {
    let formatted = mechanism

    // Format electron movement arrows
    formatted = formatted.replace(/-->/g, '→')
    formatted = formatted.replace(/<-->/g, '⇌')
    
    // Format electron pairs and lone pairs
    formatted = formatted.replace(/:\s*([A-Z][a-z]?)/g, ': $1')
    formatted = formatted.replace(/\.\s*([A-Z][a-z]?)/g, '• $1')
    
    // Format intermediate steps
    formatted = formatted.replace(/^(Step \d+):/gm, '**$1:**')
    formatted = formatted.replace(/^(Intermediate|Transition state):/gm, '**$1:**')
    
    return formatted
  }

  /**
   * Format chemical properties and characteristics
   */
  static formatChemicalProperties(properties: string): string {
    let formatted = properties

    // Physical properties
    const physicalProps = [
      'melting point', 'boiling point', 'density', 'solubility', 'color', 'odor',
      'state', 'crystalline', 'amorphous', 'conductivity', 'hardness'
    ]

    physicalProps.forEach(prop => {
      const regex = new RegExp(`\\b${prop}\\b`, 'gi')
      formatted = formatted.replace(regex, `**${prop}**`)
    })

    // Chemical properties
    const chemicalProps = [
      'reactivity', 'stability', 'oxidation', 'reduction', 'acidity', 'basicity',
      'pH', 'electronegativity', 'ionization energy', 'electron affinity'
    ]

    chemicalProps.forEach(prop => {
      const regex = new RegExp(`\\b${prop}\\b`, 'gi')
      formatted = formatted.replace(regex, `*${prop}*`)
    })

    return formatted
  }

  /**
   * Validate chemical formulas
   */
  static validateChemicalFormula(formula: string): {isValid: boolean, errors: string[]} {
    const errors: string[] = []
    
    // Remove HTML tags for validation
    const cleanFormula = formula.replace(/<[^>]*>/g, '')
    
    // Check for valid element symbols
    const elementMatches = cleanFormula.match(/([A-Z][a-z]?)/g) || []
    const invalidElements = elementMatches.filter(element => !this.ELEMENTS.has(element))
    
    if (invalidElements.length > 0) {
      errors.push(`Invalid element symbols: ${invalidElements.join(', ')}`)
    }

    // Check for balanced parentheses
    const openParens = (cleanFormula.match(/\(/g) || []).length
    const closeParens = (cleanFormula.match(/\)/g) || []).length
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in chemical formula')
    }

    // Check for valid number format
    if (/\d[A-Z]/.test(cleanFormula)) {
      errors.push('Numbers should come after element symbols, not before')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate comprehensive molecular structure representation (ASCII)
   */
  static generateStructuralFormula(compound: string, classLevel?: string): string {
    const normalizedCompound = compound.toLowerCase().trim()
    const classNumber = classLevel ? parseInt(classLevel.replace(/[^0-9]/g, '')) : 10

    // Comprehensive structure database
    const structures = new Map([
      // Simple inorganic molecules
      ['h2o', {
        simple: `H-O-H`,
        detailed: `
    H
     \\
      O
     /
    H`,
        name: 'Water'
      }],
      ['co2', {
        simple: `O=C=O`,
        detailed: `O = C = O`,
        name: 'Carbon dioxide'
      }],
      ['nh3', {
        simple: `H-N-H-H`,
        detailed: `
      H
      |
  H - N
      |
      H`,
        name: 'Ammonia'
      }],
      ['ch4', {
        simple: `H-C-H-H-H`,
        detailed: `
      H
      |
  H - C - H
      |
      H`,
        name: 'Methane'
      }],

      // Alcohols
      ['methanol', {
        simple: `H-C-O-H`,
        detailed: `
    H
    |
H - C - O - H
    |
    H`,
        name: 'Methanol (CH₃OH)'
      }],
      ['ethanol', {
        simple: `H-C-C-O-H`,
        detailed: `
    H   H
    |   |
H - C - C - O - H
    |   |
    H   H`,
        name: 'Ethanol (C₂H₅OH)'
      }],
      ['propanol', {
        simple: `H-C-C-C-O-H`,
        detailed: `
    H   H   H
    |   |   |
H - C - C - C - O - H
    |   |   |
    H   H   H`,
        name: '1-Propanol (C₃H₇OH)'
      }],

      // Alkanes
      ['ethane', {
        simple: `H-C-C-H`,
        detailed: `
    H   H
    |   |
H - C - C - H
    |   |
    H   H`,
        name: 'Ethane (C₂H₆)'
      }],
      ['propane', {
        simple: `H-C-C-C-H`,
        detailed: `
    H   H   H
    |   |   |
H - C - C - C - H
    |   |   |
    H   H   H`,
        name: 'Propane (C₃H₈)'
      }],
      ['butane', {
        simple: `H-C-C-C-C-H`,
        detailed: `
    H   H   H   H
    |   |   |   |
H - C - C - C - C - H
    |   |   |   |
    H   H   H   H`,
        name: 'Butane (C₄H₁₀)'
      }],

      // Alkenes
      ['ethene', {
        simple: `H-C=C-H`,
        detailed: `
    H     H
     \\   /
      C = C
     /   \\
    H     H`,
        name: 'Ethene (C₂H₄)'
      }],
      ['propene', {
        simple: `H-C=C-C-H`,
        detailed: `
    H     H   H
     \\   /    |
      C = C - C - H
     /        |
    H         H`,
        name: 'Propene (C₃H₆)'
      }],

      // Alkynes
      ['ethyne', {
        simple: `H-C≡C-H`,
        detailed: `H - C ≡ C - H`,
        name: 'Ethyne (C₂H₂)'
      }],
      ['propyne', {
        simple: `H-C≡C-C-H`,
        detailed: `
        H
        |
H - C ≡ C - C - H
        |
        H`,
        name: 'Propyne (C₃H₄)'
      }],

      // Aromatic compounds
      ['benzene', {
        simple: `C6H6 ring`,
        detailed: `
        H
        |
    H - C     C - H
       / \\   / \\
      /   \\ /   \\
     C     C     C
      \\   / \\   /
       \\ /   \\ /
    H - C     C - H
        |
        H`,
        name: 'Benzene (C₆H₆)'
      }],
      ['toluene', {
        simple: `C6H5-CH3`,
        detailed: `
        H
        |
    H - C     C - H
       / \\   / \\
      /   \\ /   \\
     C     C     C
      \\   / \\   /
       \\ /   \\ /
    H - C     C - CH₃
        |
        H`,
        name: 'Toluene (C₇H₈)'
      }],
      ['phenol', {
        simple: `C6H5-OH`,
        detailed: `
        H
        |
    H - C     C - H
       / \\   / \\
      /   \\ /   \\
     C     C     C
      \\   / \\   /
       \\ /   \\ /
    H - C     C - OH
        |
        H`,
        name: 'Phenol (C₆H₅OH)'
      }],

      // Functional groups
      ['formaldehyde', {
        simple: `H-C=O`,
        detailed: `
    H
    |
    C = O
    |
    H`,
        name: 'Formaldehyde (HCHO)'
      }],
      ['acetaldehyde', {
        simple: `H-C-C=O`,
        detailed: `
    H   H
    |   |
H - C - C = O
    |
    H`,
        name: 'Acetaldehyde (CH₃CHO)'
      }],
      ['acetone', {
        simple: `H-C-C-C-H with C=O`,
        detailed: `
    H       H
    |       |
H - C - C - C - H
    |   ‖   |
    H   O   H`,
        name: 'Acetone (CH₃COCH₃)'
      }],
      ['acetic acid', {
        simple: `H-C-COOH`,
        detailed: `
    H     O
    |     ‖
H - C - C - OH
    |
    H`,
        name: 'Acetic acid (CH₃COOH)'
      }],

      // Carbohydrates
      ['glucose', {
        simple: `C6H12O6 (ring form)`,
        detailed: `
        CH₂OH
         |
    H - C - O - H
         |     \\
    HO - C - H   C - H
         |       |
    H - C - OH  C - OH
         |       |
    HO - C - H  C - H
         |     /
         C - H
         |
        OH`,
        name: 'Glucose (C₆H₁₂O₆)'
      }],

      // Amino acids
      ['glycine', {
        simple: `H2N-CH2-COOH`,
        detailed: `
    H     H     O
    |     |     ‖
H - N - C - C - OH
    |     |
    H     H`,
        name: 'Glycine (NH₂CH₂COOH)'
      }],
      ['alanine', {
        simple: `H2N-CH(CH3)-COOH`,
        detailed: `
    H     H     O
    |     |     ‖
H - N - C - C - OH
    |     |
    H    CH₃`,
        name: 'Alanine (NH₂CH(CH₃)COOH)'
      }]
    ])

    const structure = structures.get(normalizedCompound)
    if (!structure) {
      return this.generateGenericStructure(compound)
    }

    // Choose appropriate complexity based on class level
    let display = ''
    if (classNumber <= 8) {
      // Middle school - simple representation
      display = structure.simple
    } else {
      // High school and above - detailed representation
      display = structure.detailed
    }

    return `**${structure.name}**\n\`\`\`\n${display}\n\`\`\``
  }

  /**
   * Generate generic structure for unknown compounds
   */
  private static generateGenericStructure(compound: string): string {
    // Try to parse basic molecular formula
    const formulaMatch = compound.match(/([A-Z][a-z]?\d*)+/)
    if (formulaMatch) {
      return `**${compound}**\n\nStructural formula not available in database.\nMolecular formula: ${formulaMatch[0]}`
    }

    return `**${compound}**\n\nStructural representation not available.`
  }

  /**
   * Generate bond representation guide
   */
  static generateBondGuide(): string {
    return `
**Chemical Bond Representations:**

\`\`\`
Single Bond:    C - C    or    C—C
Double Bond:    C = C    or    C═C
Triple Bond:    C ≡ C    or    C≡C

Aromatic Ring:
        C
       / \\
      C   C
       \\ /
        C

Functional Groups:
Alcohol:        -OH
Aldehyde:       -CHO  or  -C=O
                           |
                           H
Ketone:         >C=O  or  -CO-
Carboxyl:       -COOH or  -C=O
                           |
                           OH
Amino:          -NH₂
\`\`\`

**Stereochemistry Indicators:**
- **Wedge (●)**: Bond coming out of the page
- **Dash (○)**: Bond going into the page
- **Wavy (~)**: Unknown or mixed stereochemistry
`
  }

  /**
   * Generate functional group highlighting
   */
  static highlightFunctionalGroups(structure: string): string {
    let highlighted = structure

    // Highlight common functional groups
    const functionalGroups = [
      { pattern: /-OH\b/g, replacement: '**-OH**', name: 'hydroxyl' },
      { pattern: /=O\b/g, replacement: '**=O**', name: 'carbonyl' },
      { pattern: /-COOH\b/g, replacement: '**-COOH**', name: 'carboxyl' },
      { pattern: /-NH₂\b/g, replacement: '**-NH₂**', name: 'amino' },
      { pattern: /-CHO\b/g, replacement: '**-CHO**', name: 'aldehyde' },
      { pattern: /CH₃/g, replacement: '*CH₃*', name: 'methyl' }
    ]

    functionalGroups.forEach(group => {
      highlighted = highlighted.replace(group.pattern, group.replacement)
    })

    return highlighted
  }

  /**
   * Generate 3D structure representation (simplified)
   */
  static generate3DStructure(compound: string): string {
    const structures3D = new Map([
      ['methane', `
**Methane (CH₄) - Tetrahedral Geometry**
\`\`\`
      H
      |
  H - C - H  (109.5° bond angles)
      |
      H
\`\`\`
*3D Shape: Tetrahedral*
*Bond Angle: 109.5°*
*Hybridization: sp³*`],

      ['ethene', `
**Ethene (C₂H₄) - Planar Geometry**
\`\`\`
    H     H
     \\   /   (120° bond angles)
      C = C
     /   \\
    H     H
\`\`\`
*3D Shape: Planar*
*Bond Angle: 120°*
*Hybridization: sp²*`],

      ['ethyne', `
**Ethyne (C₂H₂) - Linear Geometry**
\`\`\`
H - C ≡ C - H  (180° bond angle)
\`\`\`
*3D Shape: Linear*
*Bond Angle: 180°*
*Hybridization: sp*`],

      ['water', `
**Water (H₂O) - Bent Geometry**
\`\`\`
    H
     \\   (104.5° bond angle)
      O
     /
    H
\`\`\`
*3D Shape: Bent/Angular*
*Bond Angle: 104.5°*
*Hybridization: sp³*`],

      ['ammonia', `
**Ammonia (NH₃) - Pyramidal Geometry**
\`\`\`
      H
      |
  H - N   (107° bond angles)
      |
      H
\`\`\`
*3D Shape: Trigonal Pyramidal*
*Bond Angle: 107°*
*Hybridization: sp³*`]
    ])

    return structures3D.get(compound.toLowerCase()) ||
           `3D structure representation not available for ${compound}`
  }
}
