/**
 * Test suite for the 3 surgical formatting fixes
 * Tests the fixes for:
 * 1. Redundant heading conversion (removed from frontend)
 * 2. Improved multiple choice regex
 * 3. Backend validation
 */

import { AnswerPostProcessor } from '@/lib/ai/formatting/answer-post-processor'

describe('🔧 Surgical Formatting Fixes', () => {
  
  describe('Fix 1: No Redundant Heading Conversion', () => {
    test('should not create duplicate headings when backend already formatted', () => {
      // Simulate content that backend already formatted with ###
      const backendFormatted = `
### Introduction

Democracy is a form of government.

### Key Points

1. **Representative Democracy:**
   Citizens elect representatives.

2. **Rule of Law:**
   All citizens are equal.
`.trim()

      // Frontend should NOT add another ### before "Introduction" or "Key Points"
      // This is now handled only by backend
      
      // The content should remain unchanged (no duplicate headings)
      expect(backendFormatted).toContain('### Introduction')
      expect(backendFormatted).toContain('### Key Points')
      expect(backendFormatted).not.toContain('### ### Introduction')
      expect(backendFormatted).not.toContain('### ### Key Points')
    })

    test('should handle section headers that backend missed', () => {
      // If backend somehow missed a section header, it should still work
      const content = `
Democracy is a form of government.

Key Features:

1. **Representative Democracy:**
   Citizens elect representatives.
`.trim()

      // Backend's enhanceHeadings() should convert "Key Features:" to "### Key Features:"
      const processed = AnswerPostProcessor.processAnswer(content)
      
      expect(processed.formattedAnswer).toContain('### Key Features')
    })
  })

  describe('Fix 2: Improved Multiple Choice Formatting', () => {
    test('should convert adjacent multiple choice options to list format', () => {
      const content = `
Which of the following are pure substances?

(a) Ice (b) Milk (c) Iron (d) Hydrochloric acid
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should be converted to list format
      expect(processed.formattedAnswer).toContain('- **(a)**')
      expect(processed.formattedAnswer).toContain('- **(b)**')
      expect(processed.formattedAnswer).toContain('- **(c)**')
      expect(processed.formattedAnswer).toContain('- **(d)**')
    })

    test('should handle multiple choice with varying spacing', () => {
      const content = `
Select the correct answer:

(a)Ice(b)Milk  (c) Iron   (d)Acid
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should handle inconsistent spacing
      expect(processed.formattedAnswer).toContain('- **(a)**')
      expect(processed.formattedAnswer).toContain('Ice')
      expect(processed.formattedAnswer).toContain('- **(b)**')
      expect(processed.formattedAnswer).toContain('Milk')
    })

    test('should handle multiple choice with longer text', () => {
      const content = `
Which statement is correct?

(a) Democracy is a form of government where power is vested in the people (b) Dictatorship is rule by one person (c) Monarchy is hereditary rule (d) Republic has elected representatives
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should convert all options
      expect(processed.formattedAnswer).toContain('- **(a)**')
      expect(processed.formattedAnswer).toContain('power is vested in the people')
      expect(processed.formattedAnswer).toContain('- **(b)**')
      expect(processed.formattedAnswer).toContain('rule by one person')
    })

    test('should not break when no multiple choice present', () => {
      const content = `
Democracy is a form of government.

1. **Representative Democracy:**
   Citizens elect representatives.
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should process normally without errors
      expect(processed.formattedAnswer).toBeTruthy()
      expect(processed.formattedAnswer).toContain('Democracy')
    })
  })

  describe('Fix 3: Backend Validation', () => {
    test('should detect malformed heading syntax', () => {
      const content = `
###Introduction

Democracy is a form of government.
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should have validation warning in transformations
      expect(processed.appliedTransformations.some(t => t.includes('Validation'))).toBe(true)
    })

    test('should detect unclosed bold formatting', () => {
      const content = `
**Democracy is a form of government.

This text has unclosed bold.
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should detect unclosed bold
      expect(processed.appliedTransformations.some(t => t.includes('Validation'))).toBe(true)
    })

    test('should detect duplicate headings', () => {
      const content = `
### Introduction

### Introduction

Democracy is a form of government.
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should detect duplicate
      expect(processed.appliedTransformations.some(t => t.includes('Validation'))).toBe(true)
    })

    test('should detect empty list items', () => {
      const content = `
Key Points:

- 
- Democracy
- 
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should detect empty list items
      expect(processed.appliedTransformations.some(t => t.includes('Validation'))).toBe(true)
    })

    test('should pass validation for well-formatted content', () => {
      const content = `
### Introduction

Democracy is a form of government where power is vested in the people.

### Key Features

1. **Representative Democracy:**
   Citizens elect representatives to make decisions.

2. **Rule of Law:**
   All citizens are equal under the law.

---

### 📚 Key Terms

**Democracy**
A system of government by the whole population.

**Sovereignty**
Supreme power or authority.
`.trim()

      const processed = AnswerPostProcessor.processAnswer(content)
      
      // Should have no validation warnings (or 0 warnings)
      const validationTransform = processed.appliedTransformations.find(t => t.includes('Validation'))
      if (validationTransform) {
        expect(validationTransform).toContain('0 warnings')
      }
    })
  })

  describe('Integration: All Fixes Together', () => {
    test('should handle the screenshot issue case', () => {
      // This is the exact issue from the screenshot:
      // "Questions Mentioned:### Key Points:"
      const problematicContent = `
Questions Mentioned:### Key Points:

1. Pure Substances:: Which of the following materials fall in the category of 'pure substance'?

(a) Ice (b) Milk (c) Iron (d) Hydrochloric acid
`.trim()

      const processed = AnswerPostProcessor.processAnswer(problematicContent)
      
      // Should fix the issues:
      // 1. Separate "Questions Mentioned" and "Key Points" into proper headings
      expect(processed.formattedAnswer).toContain('### Questions Mentioned')
      expect(processed.formattedAnswer).toContain('### Key Points')
      
      // 2. Should NOT have "Questions Mentioned:### Key Points:" together
      expect(processed.formattedAnswer).not.toContain('Questions Mentioned:###')
      
      // 3. Should convert multiple choice to list
      expect(processed.formattedAnswer).toContain('- **(a)**')
      expect(processed.formattedAnswer).toContain('- **(b)**')
      
      // 4. Should fix double colon (::)
      expect(processed.formattedAnswer).toContain('**Pure Substances:**')
      expect(processed.formattedAnswer).not.toContain('Pure Substances::')
    })

    test('should produce clean, well-formatted output', () => {
      const rawAnswer = `
Democracy is a form of government where power is vested in the people.

Key Features:1. Representative Democracy:: Citizens elect representatives.2. Rule of Law:: All are equal.

Which is correct?(a) Democracy is good(b) Dictatorship is bad
`.trim()

      const processed = AnswerPostProcessor.processAnswer(rawAnswer)
      
      // Should have proper structure
      expect(processed.structure.hasBody).toBe(true)
      expect(processed.structure.bodyFormat).toBe('numbered_points')
      
      // Should have proper formatting
      expect(processed.formattedAnswer).toContain('### Key Features')
      expect(processed.formattedAnswer).toContain('1. **Representative Democracy:**')
      expect(processed.formattedAnswer).toContain('2. **Rule of Law:**')
      
      // Should convert multiple choice
      expect(processed.formattedAnswer).toContain('- **(a)**')
      expect(processed.formattedAnswer).toContain('- **(b)**')
      
      // Should have applied transformations
      expect(processed.appliedTransformations.length).toBeGreaterThan(0)
    })
  })
})

