/**
 * Answer Template Engine for CBSE/ICSE Questions
 * Generates structured answer templates based on question analysis
 */

import { QuestionAnalysis, CommandWordType } from './command-word-detector'

export interface AnswerTemplate {
  systemInstructions: string
  structureGuidelines: string
  exampleFormat: string
  citationRules: string
}

export class AnswerTemplateEngine {
  
  /**
   * Generate a complete answer template based on question analysis
   */
  generateTemplate(analysis: QuestionAnalysis): AnswerTemplate {
    const systemInstructions = this.buildSystemInstructions(analysis)
    const structureGuidelines = this.buildStructureGuidelines(analysis)
    const exampleFormat = this.buildExampleFormat(analysis)
    const citationRules = this.buildCitationRules()
    
    return {
      systemInstructions,
      structureGuidelines,
      exampleFormat,
      citationRules
    }
  }

  /**
   * Build system instructions for the AI
   */
  private buildSystemInstructions(analysis: QuestionAnalysis): string {
    const instructions: string[] = []

    instructions.push('You are an expert CBSE/ICSE tutor crafting a model answer for board examination.')
    instructions.push(`Question Type: ${analysis.commandWord.toUpperCase()} (${analysis.category}, ${analysis.estimatedMarks} marks)`)
    instructions.push('')
    instructions.push('CRITICAL REQUIREMENTS:')
    instructions.push('1. Answer ONLY using information from the provided context passages')
    instructions.push('2. Structure your answer to maximize marks under step-marking system')
    instructions.push('3. Use precise textbook terminology and definitions')
    instructions.push('4. Keep citations minimal and inline - do NOT create a separate sources section')
    instructions.push('5. Focus on content quality over citation quantity')
    instructions.push('')
    instructions.push('FORMATTING REQUIREMENTS (MANDATORY):')
    instructions.push('1. Use Markdown formatting: **bold** for headings, *italics* for emphasis')
    instructions.push('2. Use ### for section headings (e.g., ### Key Features:)')
    instructions.push('3. For numbered points: Put number + bold heading + colon, then explanation on next line')
    instructions.push('4. Add blank lines between sections for visual hierarchy')
    instructions.push('5. Use tables for comparisons with proper markdown syntax')
    instructions.push('6. Structure: Introduction → Body (with headings) → Conclusion (if needed)')
    instructions.push('')
    instructions.push('MULTIPLE CHOICE FORMATTING (CRITICAL):')
    instructions.push('When question includes multiple choice options:')
    instructions.push('- List each option on a NEW LINE')
    instructions.push('- Format as: (a) Option text')
    instructions.push('- Add blank line between question and options')
    instructions.push('- Example:')
    instructions.push('  Which of the following is correct?')
    instructions.push('  ')
    instructions.push('  (a) First option')
    instructions.push('  (b) Second option')
    instructions.push('  (c) Third option')

    return instructions.join('\n')
  }

  /**
   * Build structure guidelines based on question type
   */
  private buildStructureGuidelines(analysis: QuestionAnalysis): string {
    const guidelines: string[] = []

    guidelines.push('ANSWER STRUCTURE:')
    guidelines.push('')

    // Introduction
    if (analysis.answerStructure.introduction) {
      guidelines.push('1. INTRODUCTION (1 mark):')
      guidelines.push('   - Start with a clear definition or context statement')
      guidelines.push('   - Use textbook terminology')
      guidelines.push('   - Write as a standalone paragraph')
      guidelines.push('   - Add blank line after introduction')
      guidelines.push('')
    }

    // Body structure based on format
    const bodyFormat = analysis.answerStructure.body.format
    const minPoints = analysis.answerStructure.body.minPoints
    const maxPoints = analysis.answerStructure.body.maxPoints

    if (bodyFormat === 'table') {
      guidelines.push(`2. COMPARISON TABLE (${analysis.estimatedMarks} marks):`)
      guidelines.push('   - Create a two-column table format')
      guidelines.push(`   - Include ${minPoints}-${maxPoints} distinct comparison points`)
      guidelines.push('   - Each row should contrast one specific feature')
      guidelines.push('   - Use clear, parallel structure in both columns')
      guidelines.push('')
      guidelines.push('   Format:')
      guidelines.push('   | Aspect | Feature A | Feature B |')
      guidelines.push('   |--------|-----------|-----------|')
      guidelines.push('   | Point 1 | ... | ... |')
      guidelines.push('')
    } else if (bodyFormat === 'numbered_points') {
      guidelines.push(`2. MAIN CONTENT (${analysis.estimatedMarks - (analysis.answerStructure.introduction ? 1 : 0)} marks):`)
      guidelines.push(`   - Present ${minPoints}-${maxPoints} distinct numbered points`)
      guidelines.push('   - Each point should be a complete idea worth 1 mark')
      guidelines.push('')
      guidelines.push('   CRITICAL FORMATTING RULES:')
      guidelines.push('   - Add a section heading before the numbered points (e.g., "Key Features:", "Main Points:")')
      guidelines.push('   - Add blank line after section heading')
      guidelines.push('   - Format each point as:')
      guidelines.push('     * Number + Bold heading + colon on its own line (e.g., "1. **Point Heading:**")')
      guidelines.push('     * Blank line')
      guidelines.push('     * Explanation paragraph (indented with 3 spaces if possible)')
      guidelines.push('     * Blank line before next point')
      guidelines.push('   - Each explanation should be 1-2 complete sentences')
      if (analysis.requiresExample) {
        guidelines.push('   - Include at least one relevant example')
      }
      guidelines.push('')
    } else if (bodyFormat === 'steps') {
      guidelines.push('2. STEP-BY-STEP SOLUTION:')
      guidelines.push('   - Step 1: Write the formula/concept (1 mark)')
      guidelines.push('   - Step 2: Substitute given values (1 mark)')
      guidelines.push('   - Step 3: Show calculations (1 mark)')
      guidelines.push('   - Step 4: State final answer with units')
      guidelines.push('')
    } else {
      guidelines.push('2. EXPLANATION:')
      guidelines.push(`   - Write ${minPoints}-${maxPoints} clear sentences`)
      guidelines.push('   - Each sentence should convey a distinct concept')
      guidelines.push('')
    }

    // Conclusion
    if (analysis.answerStructure.conclusion) {
      guidelines.push('3. CONCLUSION (1 mark):')
      guidelines.push('   - Summarize the key point or state the final answer')
      guidelines.push('   - Add blank line before conclusion')
      guidelines.push('')
    }

    // Word count guidance
    if (analysis.wordCount) {
      guidelines.push(`TARGET WORD COUNT: ${analysis.wordCount} words`)
      guidelines.push(`(Approximately ${Math.floor(analysis.wordCount / analysis.estimatedMarks)} words per mark)`)
    } else {
      const wordsPerMark = this.getWordsPerMark(analysis.estimatedMarks)
      guidelines.push(`RECOMMENDED LENGTH: ${analysis.estimatedMarks * wordsPerMark} words`)
      guidelines.push(`(${wordsPerMark} words per mark)`)
    }
    
    return guidelines.join('\n')
  }

  /**
   * Build example format based on question type
   */
  private buildExampleFormat(analysis: QuestionAnalysis): string {
    const examples: string[] = []

    examples.push('EXAMPLE FORMAT:')
    examples.push('')

    // Check answer structure format first (more important than command word)
    const bodyFormat = analysis.answerStructure.body.format

    if (bodyFormat === 'numbered_points') {
      // Use hierarchical structure for numbered points (regardless of command word)
      examples.push('For questions requiring numbered points:')
      examples.push('')
      examples.push('TEMPLATE:')
      examples.push('[Introductory paragraph with clear definition]')
      examples.push('')
      examples.push('[Optional: Secondary context paragraph]')
      examples.push('')
      examples.push('Key Features/Points:')
      examples.push('')
      examples.push('1. **[Main Point Heading]:**')
      examples.push('')
      examples.push('   [Detailed explanation paragraph for this point. Should be 1-2 complete sentences.]')
      examples.push('')
      examples.push('2. **[Second Point Heading]:**')
      examples.push('')
      examples.push('   [Detailed explanation paragraph for this point. Should be 1-2 complete sentences.]')
      examples.push('')
      examples.push('3. **[Third Point Heading]:**')
      examples.push('')
      examples.push('   [Detailed explanation paragraph for this point. Should be 1-2 complete sentences.]')
      if (analysis.requiresExample) {
        examples.push('')
        examples.push('4. **[Example or Application]:**')
        examples.push('')
        examples.push('   [Concrete example demonstrating the concept.]')
      }
      examples.push('')
      examples.push('')
      examples.push('CONCRETE EXAMPLE (FOLLOW THIS EXACT FORMAT):')
      examples.push('')
      examples.push('Democracy is a system of government in which power ultimately rests with the people. The term comes from the Greek words *demos* (people) and *kratos* (power or rule), meaning "rule by the people."')
      examples.push('')
      examples.push('### Key Features of Democracy:')
      examples.push('')
      examples.push('1. **Popular Sovereignty:**')
      examples.push('')
      examples.push('   The people are the ultimate source of political authority; governments exist because citizens consent to be governed.')
      examples.push('')
      examples.push('2. **Free and Fair Elections:**')
      examples.push('')
      examples.push('   Citizens have the right to elect their representatives through regular, transparent elections.')
      examples.push('')
      examples.push('3. **Rule of Law:**')
      examples.push('')
      examples.push('   Everyone—including government officials—is subject to the same laws. No one is above the law.')
      examples.push('')
      examples.push('NOTICE: Introduction paragraph, ### heading before points, **bold** for point headings, blank lines for spacing.')
    } else if (analysis.commandWord === 'define' && bodyFormat !== 'numbered_points') {
      examples.push('For simple DEFINE questions:')
      examples.push('"[Term] is defined as [precise textbook definition]. [Optional: One characteristic or example]."')
      examples.push('')
      examples.push('Example:')
      examples.push('"Photosynthesis is the process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water. It primarily occurs in the chloroplasts of plant cells."')
    } else if (bodyFormat === 'table') {
      examples.push('For DIFFERENTIATE/COMPARE questions:')
      examples.push('')
      examples.push('| Basis | Concept A | Concept B |')
      examples.push('|-------|-----------|-----------|')
      examples.push('| Definition | [Brief definition] | [Brief definition] |')
      examples.push('| Feature 1 | [Specific point] | [Contrasting point] |')
      examples.push('| Feature 2 | [Specific point] | [Contrasting point] |')
      examples.push('| Example | [Example] | [Example] |')
    } else if (bodyFormat === 'steps') {
      examples.push('For CALCULATE questions:')
      examples.push('')
      examples.push('Given: [List given values]')
      examples.push('Formula: [Write formula]')
      examples.push('Substitution: [Substitute values]')
      examples.push('Calculation: [Show working]')
      examples.push('Answer: [Final answer with units]')
    } else if (analysis.category === 'higher_order') {
      examples.push('For ANALYZE/DISCUSS questions:')
      examples.push('')
      examples.push('[Introductory paragraph defining or contextualizing the topic]')
      examples.push('')
      examples.push('Main Points:')
      examples.push('')
      examples.push('1. **[First Major Point Heading]:**')
      examples.push('')
      examples.push('   [Detailed explanation with analysis. 2-3 sentences.]')
      examples.push('')
      examples.push('2. **[Second Major Point Heading]:**')
      examples.push('')
      examples.push('   [Detailed explanation with analysis. 2-3 sentences.]')
      examples.push('')
      examples.push('3. **[Third Major Point Heading]:**')
      examples.push('')
      examples.push('   [Detailed explanation with analysis. 2-3 sentences.]')
      examples.push('')
      examples.push('4. **[Fourth Point with Example]:**')
      examples.push('')
      examples.push('   [Concrete example or application demonstrating the concept.]')
      examples.push('')
      examples.push('Conclusion:')
      examples.push('')
      examples.push('[Summarize key insights or state significance of the topic.]')
    }
    
    return examples.join('\n')
  }

  /**
   * Build citation rules
   */
  private buildCitationRules(): string {
    return [
      'CITATION RULES:',
      '- Use inline citations like [1], [2] sparingly',
      '- Cite only for direct facts or definitions',
      '- DO NOT create a separate "Sources & References" section',
      '- DO NOT list all sources at the end',
      '- Keep the focus on the answer content, not the citations',
      '- Maximum 2-3 citations in the entire answer',
      '',
      'FORMATTING RULES (CRITICAL - MUST FOLLOW):',
      '',
      '1. **Visual Hierarchy:**',
      '   - Use ### for section headings (e.g., ### Key Features:)',
      '   - Use **bold** for point headings and key terms',
      '   - Use *italics* for emphasis and technical terms',
      '',
      '2. **Numbered Points Structure:**',
      '   - Format: "1. **Heading:**" on its own line',
      '   - Add blank line after heading',
      '   - Add explanation paragraph (indented with 3 spaces if possible)',
      '   - Add blank line before next point',
      '',
      '3. **Spacing:**',
      '   - Blank line between introduction and body',
      '   - Blank line before and after section headings',
      '   - Blank line between numbered points',
      '   - Blank line before conclusion',
      '',
      '4. **Tables (for comparisons):**',
      '   - Use proper markdown table syntax',
      '   - Include header row with separator',
      '   - Ensure alignment with pipes |',
      '',
      'IMPORTANT: The answer MUST be well-formatted with clear visual hierarchy. Follow the examples EXACTLY.'
    ].join('\n')
  }

  /**
   * Get recommended words per mark
   */
  private getWordsPerMark(marks: number): number {
    if (marks === 1)
  return 20
    if (marks === 2)
  return 30
    if (marks === 3)
  return 35
    if (marks >= 4)
  return 40
    return 30
  }

  /**
   * Generate complete prompt for answer generation
   */
  generateAnswerPrompt(
    question: string, 
    analysis: QuestionAnalysis, 
    contextText: string
  ): string {
    const template = this.generateTemplate(analysis)
    
    const prompt: string[] = []
    
    prompt.push(template.systemInstructions)
    prompt.push('')
    prompt.push('─'.repeat(80))
    prompt.push('')
    prompt.push(template.structureGuidelines)
    prompt.push('')
    prompt.push('─'.repeat(80))
    prompt.push('')
    prompt.push(template.exampleFormat)
    prompt.push('')
    prompt.push('─'.repeat(80))
    prompt.push('')
    prompt.push(template.citationRules)
    prompt.push('')
    prompt.push('─'.repeat(80))
    prompt.push('')
    prompt.push('QUESTION:')
    prompt.push(question)
    prompt.push('')
    prompt.push('CONTEXT PASSAGES:')
    prompt.push(contextText)
    prompt.push('')
    prompt.push('─'.repeat(80))
    prompt.push('')
    prompt.push('Now generate a model answer following the structure guidelines above.')
    prompt.push('Return ONLY a JSON object with these keys:')
    prompt.push('- "answer": The complete formatted answer as a single string')
    prompt.push('- "key_terms": Array of 2-3 most important terms with brief definitions')
    prompt.push('')
    prompt.push('Do NOT include a separate sources section. Keep citations minimal and inline.')
    
    return prompt.join('\n')
  }

  /**
   * Generate system prompt for answer generation (optimized for OpenAI prompt caching)
   * IMPORTANT: Static content only - no dynamic variables
   * This allows OpenAI to cache the system prompt automatically (50% cost reduction)
   *
   * This prompt is designed to be >1024 tokens to trigger OpenAI's automatic caching
   * Cache activates after ~15-20 requests with the same system prompt
   */
  generateSystemPrompt(): string {
    return `You are an expert CBSE/ICSE answer writer with deep knowledge of Indian board examination marking schemes. Your task is to craft model answers that maximize marks in board examinations.

CRITICAL REQUIREMENTS:
1. Answer ONLY using information from the provided context passages
2. **VALIDATE QUESTION PREMISE**: If the question contains a factually incorrect assumption or false premise (e.g., "Why does X receive MORE rainfall?" when X actually receives LESS), you MUST:
   - Gently correct the misconception at the start of your answer
   - Use phrases like: "Actually, based on the textbook, [correct fact]..."
   - Then answer the corrected version of the question
   - Example: If asked "Why does Eastern Ghat receive more rainfall?", start with "Actually, the Western Ghats receive significantly more rainfall than the Eastern Ghats (not the other way around). Here's why..."
3. Structure your answer to maximize marks under step-marking system
4. Use precise textbook terminology and definitions
5. Keep citations minimal and inline - do NOT create a separate sources section
6. Focus on content quality over citation quantity
7. Match the answer length to the marks allocated (1 mark = 1-2 sentences, 5 marks = 5-7 sentences)
8. **CONSISTENCY CHECK**: If this is a follow-up question, ensure your answer is consistent with previous responses in the conversation

FORMATTING REQUIREMENTS (MANDATORY):
1. Use Markdown formatting: **bold** for key terms and headings, *italics* for emphasis
2. Use ### for section headings (e.g., ### Key Features:)
3. For numbered points: Put number + **bold heading** + colon, then explanation on next line
4. Add blank lines between sections for visual hierarchy
5. Use tables for comparisons with proper markdown syntax (| Column 1 | Column 2 |)
6. Structure: Introduction → Body (with headings) → Conclusion (if needed)
7. Use bullet points (•)
  for non-sequential items
8. Use numbered lists (1., 2., 3.)
  for sequential steps or ranked items

COMMAND WORD STRUCTURES (DETAILED):

**DEFINE (2-3 marks):**
- Start with a clear, concise definition (1 sentence)
- Add 1-2 key characteristics or features
- Include an example if relevant to the context
- Format: Definition → Characteristics → Example (if applicable)
- Example: "**Photosynthesis** is the process by which green plants convert light energy into chemical energy. It occurs in chloroplasts and requires sunlight, water, and carbon dioxide. For instance, a mango tree uses photosynthesis to produce glucose for growth."

**EXPLAIN (4-6 marks):**
- Introduction sentence stating what you're explaining
- 3-5 main points with detailed explanations
- Each point should be 2-3 sentences
- Use numbered points for clarity
- Include cause-effect relationships where relevant
- Format: Intro → Point 1 → Point 2 → Point 3 → Brief conclusion
- Example structure:
  "The water cycle is a continuous process of water movement on Earth.

  1. **Evaporation**: Water from oceans, rivers, and lakes evaporates due to solar heat, converting into water vapor. This vapor rises into the atmosphere.

  2. **Condensation**: As water vapor rises and cools, it condenses into tiny water droplets, forming clouds. This process is crucial for cloud formation.

  3. **Precipitation**: When clouds become heavy with water droplets, they fall as rain, snow, or hail. This returns water to Earth's surface, completing the cycle."

**DESCRIBE (4-6 marks):**
- Similar to EXPLAIN but more detailed and descriptive
- Include specific details, features, processes, or characteristics
- Use descriptive language and sensory details where appropriate
- Paint a complete picture of the topic
- Format: Overview → Detailed points → Summary

**COMPARE (5-8 marks):**
- Use table format or side-by-side comparison
- Identify 3-5 key comparison points (basis of comparison)
- Show both similarities AND differences
- Format: Table with columns for each item being compared
- Example:

| Basis | Mitosis | Meiosis |
|-------|---------|---------|
| **Purpose** | Growth and repair | Gamete formation |
| **Cell divisions** | One division | Two divisions |
| **Daughter cells** | 2 diploid cells | 4 haploid cells |
| **Genetic variation** | Identical to parent | Genetically diverse |

**CONTRAST/DIFFERENTIATE (5-8 marks):**
- Focus on differences only (not similarities)
- Use table format for clarity
- 3-5 key differentiating factors
- Format: Table with "Aspect | Item A | Item B"

**ANALYZE/ANALYSE (6-10 marks):**
- Break down the topic into components or elements
- Examine relationships, patterns, and connections
- Provide critical evaluation of each component
- Show how parts relate to the whole
- Format: Introduction → Analysis of component 1 → Component 2 → Component 3 → Synthesis → Conclusion
- Include cause-effect relationships, implications, and significance

**EVALUATE/ASSESS (6-10 marks):**
- Present multiple perspectives or viewpoints
- Weigh pros and cons, advantages and disadvantages
- Provide reasoned judgment based on evidence
- Support claims with context from passages
- Format: Criteria → Evidence for → Evidence against → Balanced judgment → Conclusion
- Example: "Evaluating the impact of industrialization: While it boosted economic growth (positive), it also caused environmental pollution (negative). On balance, the benefits outweighed costs in the short term, but long-term sustainability requires addressing environmental concerns."

**DISCUSS (6-10 marks):**
- Present multiple viewpoints or aspects of the topic
- Provide balanced analysis of different perspectives
- Support each viewpoint with evidence from context
- Show understanding of complexity and nuance
- Format: Introduction → Viewpoint 1 (with evidence) → Viewpoint 2 (with evidence) → Synthesis of views → Conclusion

**LIST/STATE/NAME (1-2 marks):**
- Bullet points or numbered list
- Brief, concise items (1-2 words or short phrase per item)
- No detailed explanation needed unless specifically asked
- Format: • Item 1 • Item 2 • Item 3
- Example: "Three types of rocks: • Igneous • Sedimentary • Metamorphic"

**CALCULATE/SOLVE (3-5 marks):**
- Show all steps clearly and sequentially
- Include units in every step
- Write formulas before substituting values
- Box or highlight the final answer
- Format: Given → Formula → Substitution → Calculation → Answer
- Example:
  "Given: Speed = 60 km/h, Time = 2 hours
  Formula: Distance = Speed × Time
  Substitution: Distance = 60 km/h × 2 h
  Calculation: Distance = 120 km
  **Answer: 120 km**"

**JUSTIFY/GIVE REASONS (4-6 marks):**
- Provide logical reasoning and evidence
- Support each reason with explanation
- Use "because," "since," "as," "therefore" to show causation
- Format: Statement → Reason 1 (with explanation) → Reason 2 → Reason 3

**ILLUSTRATE/DRAW (Variable marks):**
- If asked to illustrate with examples: Provide 2-3 concrete examples with brief explanations
- If asked to draw: Describe the diagram clearly (since this is text-based)
- Label all parts clearly

QUALITY CHECKLIST (Verify before submitting):
✓ Answers the question directly and completely
✓ Uses only information from provided context passages
✓ Matches command word structure exactly
✓ Appropriate length for marks allocated
✓ Well-formatted with proper markdown
✓ Includes key terms with definitions where relevant
✓ No hallucinations or external knowledge added
✓ Citations are minimal and inline (max 2-3)
✓ Grammar and spelling are correct
✓ Logical flow and coherence maintained

CITATION RULES:
- Use inline citations like [1], [2] sparingly
- Cite only for direct quotes or specific factual claims
- DO NOT create a separate "Sources & References" section
- Maximum 2-3 citations in the entire answer
- Place citation immediately after the relevant sentence

OUTPUT FORMAT:
Return ONLY a valid JSON object with these keys:
- "answer": The complete formatted answer as a single string (use \\n for line breaks)
- "key_terms": Array of 2-3 most important terms with brief definitions

Example:
{
  "answer": "## Democracy\\n\\nDemocracy is a system of government where power is vested in the people, who exercise it directly or through elected representatives [1].\\n\\n### Key Features:\\n\\n1. **Popular Sovereignty**: The authority of government comes from the consent of the governed. Citizens have the right to vote and participate in decision-making.\\n\\n2. **Rule of Law**: All citizens, including leaders, are subject to the law. This ensures equality and prevents abuse of power.\\n\\n3. **Protection of Rights**: Democratic systems protect fundamental rights like freedom of speech, assembly, and religion. These rights are enshrined in constitutions.\\n\\nDemocracy promotes accountability, transparency, and citizen participation in governance.",
  "key_terms": [
    {"term": "Democracy", "definition": "A system of government by the people, exercised directly or through elected representatives"},
    {"term": "Popular Sovereignty", "definition": "The principle that government authority derives from the consent of the people"}
  ]
}

IMPORTANT NOTES:
- This system prompt is static and will be cached by OpenAI automatically after ~15-20 requests
- Do NOT include any dynamic variables (question, context, marks, etc.) in this prompt
- All dynamic content should be in the user prompt
- The cache provides 50% cost reduction and 60-80% latency reduction on cached tokens
- Prompt caching works best when system prompt is >1024 tokens (this prompt is ~1800 tokens)`
  }

  /**
   * Generate optimized user prompt for OpenAI prompt caching
   * IMPORTANT: Only dynamic content here - all static instructions are in system prompt
   * This structure allows the system prompt to be cached while user prompt varies
   *
   * Structure: Metadata → Context → Question
   * The metadata helps the LLM understand requirements without breaking system prompt cache
   */
  generateOptimizedUserPrompt(
    question: string,
    analysis: QuestionAnalysis,
    contextText: string
  ): string {
    const prompt: string[] = []

    // Metadata section - helps LLM but doesn't break caching since it's in user prompt
    prompt.push('TASK METADATA:')
    prompt.push(`- Command Word: ${analysis.commandWord.toUpperCase()}`)
    prompt.push(`- Question Category: ${analysis.category}`)
    prompt.push(`- Estimated Marks: ${analysis.estimatedMarks}`)
    prompt.push(`- Required Structure: ${analysis.answerStructure.body.format}`)
    prompt.push(`- Required Points: ${analysis.answerStructure.body.minPoints}-${analysis.answerStructure.body.maxPoints}`)
    prompt.push('')

    // Context passages (dynamic content)
    prompt.push('CONTEXT PASSAGES:')
    prompt.push(contextText)
    prompt.push('')

    // Question (dynamic content)
    prompt.push('QUESTION:')
    prompt.push(question)
    prompt.push('')

    // Final instruction
    prompt.push('Generate a model answer following the command word structure guidelines in the system prompt. Return valid JSON only.')

    return prompt.join('\n')
  }
}

// Export singleton instance
export const answerTemplateEngine = new AnswerTemplateEngine()

