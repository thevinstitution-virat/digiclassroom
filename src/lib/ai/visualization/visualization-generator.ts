import { logger } from '@/lib/logger';

/**
 * Visualization Generator for DigiClassroom Pro AI Tutor
 * Generates educational visualizations (tables, flowcharts, concept maps, timelines, charts, etc.)
 * Maintains NCERT textbook fidelity by extracting data only from retrieved chunks
 */

import { OpenAIService } from '@/lib/services/openai_service';
import { QueryTypeDetector } from './type-detector';
import { MermaidValidator } from './validators/mermaid-validator';
import { EChartsGenerator } from './generators/echarts-generator';

export interface VisualizationRequest {
  query: string;
  answer: string;
  chunks: Array<{
    text: string;
    metadata?: {
      subject?: string;
      class?: string;
      chapter?: string;
      page?: number;
    };
  }>;
  metadata: {
    subject: string;
    class: string;
    chapter?: string;
    queryType?: string;
  };
}

export interface Visualization {
  type: 'comparison_table' | 'concept_map' | 'flowchart' | 'timeline' | 'hierarchical_tree' | 'text_flowchart' | 'bar_chart' | 'pie_chart' | 'line_chart';
  format: 'markdown' | 'mermaid' | 'echarts';
  priority: 1 | 2 | 3;
  content: string | any; // string for markdown/mermaid, object for echarts
  caption: string;
  educationalValue: string;
}

export interface VisualizationResult {
  visualizations: Visualization[];
  generationTime: number;
}

export class VisualizationGenerator {
  private openai: OpenAIService;
  private echartsGenerator: EChartsGenerator;

  // Detection keywords for automatic generation
  private static readonly COMPARISON_KEYWORDS = [
    'difference', 'compare', 'distinguish', 'versus', 'vs', 'vs.',
    'differentiate', 'contrast', 'similarities', 'alike', 'comparison'
  ];

  private static readonly PROCESS_KEYWORDS = [
    'process', 'steps', 'stages', 'how does', 'mechanism', 'procedure',
    'method', 'cycle', 'sequence', 'workflow'
  ];

  private static readonly CLASSIFICATION_KEYWORDS = [
    'classification', 'types of', 'kinds of', 'categories', 'classify',
    'taxonomy', 'hierarchy', 'division', 'groups'
  ];

  constructor() {
    this.openai = OpenAIService.getInstance();
    this.echartsGenerator = new EChartsGenerator();
  }

  /**
   * Main method: Generate all appropriate visualizations for a query
   */
  async generateVisualizations(request: VisualizationRequest): Promise<VisualizationResult> {
    const startTime = Date.now();
    const visualizations: Visualization[] = [];

    logger.info(`🎨 [Visualization] Generating for query: "${request.query.substring(0, 50)}..."`);

    try {
      // Phase 1: Automatic generation based on query patterns
      const detectedTypes = this.detectVisualizationTypes(request.query, request.answer, request.metadata);

      logger.info({ data: detectedTypes }, `🎨 [Visualization] Detected types:`);

      // Generate visualizations in parallel for better performance
      const generationPromises: Promise<Visualization | null>[] = [];

      // Statistical charts (ECharts)
      if (detectedTypes.includes('bar_chart')) {
        generationPromises.push(this.generateBarChart(request));
      }

      if (detectedTypes.includes('pie_chart')) {
        generationPromises.push(this.generatePieChart(request));
      }

      if (detectedTypes.includes('line_chart')) {
        generationPromises.push(this.generateLineChart(request));
      }

      // Diagrams and tables
      if (detectedTypes.includes('comparison_table')) {
        generationPromises.push(this.generateComparisonTable(request));
      }

      if (detectedTypes.includes('text_flowchart')) {
        generationPromises.push(this.generateTextFlowchart(request));
      }

      if (detectedTypes.includes('concept_map')) {
        generationPromises.push(this.generateConceptMap(request));
      }

      // Timeline generation - works for ALL subjects (History, Civics, Science, etc.)
      // Removed subject restriction to allow timelines for constitutional development, scientific discoveries, etc.
      if (detectedTypes.includes('timeline')) {
        generationPromises.push(this.generateTimeline(request));
      }

      if (detectedTypes.includes('hierarchical_tree')) {
        generationPromises.push(this.generateHierarchicalTree(request));
      }

      // Wait for all generations to complete
      const results = await Promise.all(generationPromises);

      // Filter out null results and add to visualizations array
      results.forEach((viz, index) => {
        if (viz) {
          // Additional validation for Mermaid diagrams
          if (viz.format === 'mermaid') {
            const validation = MermaidValidator.validate(viz.content as string);
            if (!validation.isValid) {
              logger.warn({ data: validation.errors }, `⚠️ [Visualization] Skipping invalid Mermaid diagram (${viz.type}):`);
              return; // Skip this visualization
            }
            if (validation.warnings && validation.warnings.length > 0) {
              logger.warn({ data: validation.warnings }, `⚠️ [Visualization] Mermaid warnings for ${viz.type}:`);
            }
          }

          // Additional validation for markdown content
          if (viz.format === 'markdown') {
            if (!viz.content || (viz.content as string).trim().length < 10) {
              logger.warn(`⚠️ [Visualization] Skipping empty markdown content (${viz.type})`);
              return; // Skip this visualization
            }
          }

          visualizations.push(viz);
        } else {
          logger.warn(`⚠️ [Visualization] Generation returned null for type at index ${index}`);
        }
      });

      const generationTime = Date.now() - startTime;
      logger.info(`✅ [Visualization] Generated ${visualizations.length} visualizations in ${generationTime}ms`);

      return {
        visualizations,
        generationTime
      };

    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Generation error:');
      return {
        visualizations: [],
        generationTime: Date.now() - startTime
      };
    }
  }

  /**
   * Detect which visualization types are appropriate for the query
   */
  private detectVisualizationTypes(query: string, answer: string, metadata: any): string[] {
    const types: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Use enhanced QueryTypeDetector for all visualization types
    const detectionResults = QueryTypeDetector.detect(query, answer, metadata);

    // Add ALL detected types with high confidence (>= 0.4)
    // This includes: bar_chart, pie_chart, line_chart, timeline, flowchart, concept_map, comparison_table, hierarchical_tree
    detectionResults.forEach(result => {
      if (result.confidence >= 0.4 && !types.includes(result.visualizationType)) {
        types.push(result.visualizationType);
        logger.info(`🎯 [TypeDetection] Added ${result.visualizationType} (confidence: ${(result.confidence * 100).toFixed(0)}%) - ${result.reasoning}`);
      }
    });

    // PRIORITY 1: Check for explicit on-demand visualization requests
    if (lowerQuery.includes('mind map') || lowerQuery.includes('concept map') ||
      lowerQuery.includes('draw') || lowerQuery.includes('show diagram') ||
      lowerQuery.includes('create map')) {
      types.push('concept_map');
    }

    if (lowerQuery.includes('timeline') || lowerQuery.includes('chronology')) {
      types.push('timeline');
    }

    if (lowerQuery.includes('comparison table') || lowerQuery.includes('compare in table')) {
      types.push('comparison_table');
    }

    if (lowerQuery.includes('flowchart') || lowerQuery.includes('flow chart')) {
      types.push('text_flowchart');
      types.push('concept_map');
    }

    if (lowerQuery.includes('hierarchical tree') || lowerQuery.includes('hierarchy') ||
      lowerQuery.includes('tree diagram')) {
      types.push('hierarchical_tree');
    }

    // PRIORITY 2: Automatic detection based on query patterns
    // Check for comparison queries
    if (VisualizationGenerator.COMPARISON_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
      if (!types.includes('comparison_table')) {
        types.push('comparison_table');
      }
    }

    // Check for process queries
    if (VisualizationGenerator.PROCESS_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
      if (!types.includes('text_flowchart')) {
        types.push('text_flowchart');
      }
      if (!types.includes('concept_map')) {
        types.push('concept_map'); // Processes can also benefit from concept maps
      }
    }

    // Check for classification queries
    if (VisualizationGenerator.CLASSIFICATION_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
      if (!types.includes('hierarchical_tree')) {
        types.push('hierarchical_tree');
      }
    }

    // Check for timeline (History and Civics subjects often have chronological content)
    // Also check for temporal keywords in the answer
    const hasTemporalContent = /\b(1[0-9]{3}|20[0-9]{2})\b/g.test(answer) || // Years like 1946, 1950, 2024
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(answer); // Dates

    if ((metadata.subject === 'History' || metadata.subject === 'Civics' || hasTemporalContent) &&
      !types.includes('timeline')) {
      types.push('timeline');
    }

    // Check for conceptual/hierarchical queries
    if ((lowerQuery.includes('structure') || lowerQuery.includes('organization') ||
      lowerQuery.includes('features') || lowerQuery.includes('characteristics')) &&
      !types.includes('concept_map')) {
      types.push('concept_map');
    }

    return types;
  }

  /**
   * Generate comparison table (Phase 1)
   */
  private async generateComparisonTable(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info(`📊 [Visualization] Generating comparison table...`);

      const prompt = `Extract comparison data from this NCERT textbook answer and format as a clean Markdown table.

IMPORTANT RULES:
1. Extract ONLY information that is explicitly stated in the answer
2. Do NOT add any information from general knowledge
3. Create a clear, well-structured comparison table
4. Include only 3-6 rows maximum for clarity
5. Use clear, concise column headers (NO bold/italic formatting in headers or cells)
6. Add source citation at the bottom
7. Do NOT use ** or * for bold/italic inside table cells
8. Keep cell content concise and readable

Answer:
${request.answer}

Textbook Context (for verification):
${request.chunks.slice(0, 3).map(c => c.text).join('\n\n')}

EXAMPLE FORMAT (follow this exact structure):
| Feature | Item A | Item B |
|---------|--------|--------|
| Definition | Description here | Description here |
| Key Point | Detail here | Detail here |

*Source: NCERT Class ${request.metadata.class} ${request.metadata.subject}${request.metadata.chapter ? `, Chapter: ${request.metadata.chapter}` : ''}*

IMPORTANT: Output ONLY the table and source line. No extra text, no bold formatting inside cells.`;

      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 800
      });

      let content = response.text.trim();

      // Clean up the content: remove markdown code blocks if present
      content = content.replace(/```markdown\n?/g, '').replace(/```\n?/g, '');

      // Remove bold/italic formatting from table cells (but keep it in source line)
      const lines = content.split('\n');
      const cleanedLines = lines.map((line, index) => {
        // If it's a table row (contains |), clean formatting
        if (line.includes('|') && !line.startsWith('*Source:')) {
          // Remove ** and * from table cells, but preserve the pipe structure
          return line.replace(/\*\*/g, '').replace(/\*/g, '');
        }
        return line;
      });
      content = cleanedLines.join('\n').trim();

      // Validate that it's a proper table
      if (!content.includes('|') || !content.includes('---')) {
        logger.warn('⚠️ [Visualization] Generated content is not a valid table, using fallback');
        return this.createFallbackComparisonTable(request.query, request.answer, request.metadata);
      }

      logger.info('✅ [Visualization] Comparison table generated successfully');
      logger.info({ data: content.substring(0, 200) }, '📄 [Visualization] Table preview:');

      return {
        type: 'comparison_table',
        format: 'markdown',
        priority: 1,
        content,
        caption: 'Comparison table extracted from NCERT textbook',
        educationalValue: 'Clarifies differences and similarities for exam questions'
      };

    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Comparison table generation failed:');
      // Return fallback instead of null
      return this.createFallbackComparisonTable(request.query, request.answer, request.metadata);
    }
  }

  /**
   * Create fallback comparison table when LLM generation fails
   */
  private createFallbackComparisonTable(query: string, answer: string, metadata: any): Visualization {
    logger.info('⚠️ [Visualization] Using fallback comparison table');

    // Try to extract two items being compared from the query
    const comparisonMatch = query.match(/(?:between|of)\s+([^,]+)\s+(?:and|&|vs\.?|versus)\s+(.+)/i) ||
      query.match(/differentiate\s+(?:between\s+)?([^,]+)\s+(?:and|&|from)\s+(.+)/i) ||
      query.match(/compare\s+([^,]+)\s+(?:and|&|with|to)\s+(.+)/i) ||
      query.match(/([^,]+)\s+vs\.?\s+(.+)/i);

    let itemA = 'Concept A';
    let itemB = 'Concept B';

    if (comparisonMatch) {
      itemA = comparisonMatch[1].trim().substring(0, 40);
      itemB = comparisonMatch[2].trim().replace(/[?.!]$/, '').substring(0, 40);
    }

    // Extract key points from answer for the table
    const points = this.extractComparisonPoints(answer);

    // Build the comparison table
    let tableContent = `| Feature | ${itemA} | ${itemB} |\n`;
    tableContent += `|---------|---------|----------|\n`;

    points.forEach(point => {
      tableContent += `| ${point.feature} | ${point.valueA} | ${point.valueB} |\n`;
    });

    tableContent += `\n*Source: NCERT Class ${metadata.class} ${metadata.subject}${metadata.chapter ? `, Chapter: ${metadata.chapter}` : ''}*`;

    return {
      type: 'comparison_table',
      format: 'markdown',
      priority: 1,
      content: tableContent,
      caption: `Comparison: ${itemA} vs ${itemB}`,
      educationalValue: 'Clarifies differences and similarities for exam questions'
    };
  }

  /**
   * Extract comparison points from answer text
   */
  private extractComparisonPoints(answer: string): Array<{ feature: string; valueA: string; valueB: string }> {
    const points: Array<{ feature: string; valueA: string; valueB: string }> = [];

    // Common comparison features to look for
    const featurePatterns = [
      { pattern: /definition|meaning|what is/i, feature: 'Definition' },
      { pattern: /based on|basis|measure/i, feature: 'Basis/Criteria' },
      { pattern: /focus|emphasis|main point/i, feature: 'Focus' },
      { pattern: /advantage|benefit/i, feature: 'Advantages' },
      { pattern: /disadvantage|limitation|drawback/i, feature: 'Limitations' },
      { pattern: /example/i, feature: 'Examples' },
      { pattern: /scope|coverage/i, feature: 'Scope' },
      { pattern: /method|approach|technique/i, feature: 'Method' },
    ];

    // Try to extract structured points
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 10);

    // Add at least 3 generic rows if we can't extract specifics
    if (sentences.length >= 2) {
      points.push({
        feature: 'Definition',
        valueA: this.truncateText(sentences[0], 50),
        valueB: sentences.length > 2 ? this.truncateText(sentences[Math.floor(sentences.length / 2)], 50) : 'See detailed explanation'
      });

      points.push({
        feature: 'Key Characteristic',
        valueA: sentences.length > 1 ? this.truncateText(sentences[1], 50) : 'Refer to text',
        valueB: sentences.length > 3 ? this.truncateText(sentences[3], 50) : 'Refer to text'
      });

      points.push({
        feature: 'Application/Usage',
        valueA: 'See details above',
        valueB: 'See details above'
      });
    } else {
      // Minimal fallback
      points.push({ feature: 'Definition', valueA: 'See explanation above', valueB: 'See explanation above' });
      points.push({ feature: 'Key Features', valueA: 'Refer to answer', valueB: 'Refer to answer' });
      points.push({ feature: 'Differences', valueA: 'Check detailed text', valueB: 'Check detailed text' });
    }

    return points.slice(0, 5); // Max 5 rows
  }

  /**
   * Truncate text to max length
   */
  private truncateText(text: string, maxLength: number): string {
    const cleaned = text.trim().replace(/^\W+/, '');
    if (cleaned.length <= maxLength)
  return cleaned;
    return cleaned.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate text-based flowchart (Phase 1)
   */
  private async generateTextFlowchart(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info(`🔄 [Visualization] Generating text flowchart...`);

      const prompt = `Extract the process steps from this NCERT textbook answer and create a simple text-based flowchart.

IMPORTANT RULES:
1. Extract ONLY steps that are explicitly mentioned in the answer
2. Do NOT add any steps from general knowledge
3. Keep it simple and linear
4. Maximum 6-8 steps
5. Use clear, concise descriptions

Answer:
${request.answer}

Format:
Step 1: [Description]
   ↓
Step 2: [Description]
   ↓
Step 3: [Description]
   ↓
...

Keep it simple and educational.`;

      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 400
      });

      const content = response.text.trim();

      // Validate that it contains steps
      if (!content.toLowerCase().includes('step')) {
        logger.warn('⚠️ [Visualization] Generated content is not a valid flowchart');
        return null;
      }

      return {
        type: 'text_flowchart',
        format: 'markdown',
        priority: 2,
        content,
        caption: 'Process flowchart from NCERT textbook',
        educationalValue: 'Helps understand multi-step processes for exam preparation'
      };

    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Text flowchart generation failed:');
      return null;
    }
  }

  /**
   * Generate Mermaid.js concept map (Phase 2)
   */
  private async generateConceptMap(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info(`🗺️ [Visualization] Generating concept map...`);

      const prompt = `You are an expert Mermaid.js diagram generator for NCERT educational content.

TASK: Create a valid Mermaid.js concept map showing relationships between concepts.

CRITICAL RULES - MUST FOLLOW:
1. OUTPUT ONLY VALID MERMAID SYNTAX (NO markdown blocks, NO text, NO explanations)
2. MUST start with "graph TD" (top-down layout)
3. Use proper node syntax: A[Node Label]
4. Use arrows: --> (NOT → or any other symbol)
5. Extract ONLY concepts explicitly stated in the answer below
6. Do NOT add information from general knowledge
7. Maximum 12 nodes for clarity
8. Node labels maximum 40 characters
9. Add styling for visual appeal

VALID MERMAID EXAMPLE:
graph TD
    A[Village Palampur Economy]
    B[Farming Activities]
    C[Non-Farm Activities]
    D[Fixed Capital]
    E[Working Capital]
    F[Small Scale Manufacturing]
    G[Dairy]
    H[Transport]

    A --> B
    A --> C
    B --> D
    B --> E
    C --> F
    C --> G
    C --> H

    style A fill:#a78bfa,stroke:#7c3aed,stroke-width:3px,color:#fff
    style B fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style C fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff

NCERT CONTENT:
Topic: ${request.query}
Answer: ${request.answer.substring(0, 1500)}

OUTPUT MERMAID SYNTAX ONLY (start with "graph TD"):`;

      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Lower temperature for consistency
        maxTokens: 800
      });

      let content = response.text.trim();

      logger.info({ data: content.substring(0, 200) }, '📝 [ConceptMap] Raw LLM output (first 200 chars):');

      // Check for text arrow format (indicates LLM ignored instructions)
      if (content.includes('→') || (content.includes('[') && !content.startsWith('graph'))) {
        logger.error('❌ [ConceptMap] LLM generated text format instead of Mermaid syntax');
        logger.error({ data: content.substring(0, 150) }, 'Invalid output:');
        return this.createFallbackConceptMap(request.query);
      }

      // Check if empty or too short
      if (!content || content.length < 30) {
        logger.error('❌ [ConceptMap] Generated empty or too short content');
        return this.createFallbackConceptMap(request.query);
      }

      // Validate and auto-correct Mermaid syntax
      const validation = MermaidValidator.validate(content);

      if (!validation.isValid) {
        logger.warn({ data: validation.errors }, '⚠️ [ConceptMap] Validation failed, attempting auto-fix:');
        content = MermaidValidator.validateAndCorrect(content, request.query);

        // Re-validate after correction
        const revalidation = MermaidValidator.validate(content);
        if (!revalidation.isValid) {
          logger.error('❌ [ConceptMap] Auto-fix failed, using fallback');
          return this.createFallbackConceptMap(request.query);
        }
      }

      logger.info('✅ [ConceptMap] Valid Mermaid syntax generated');

      return {
        type: 'concept_map',
        format: 'mermaid',
        priority: 1,
        content,
        caption: `Concept map: ${request.metadata.chapter || request.query.substring(0, 50)}`,
        educationalValue: 'Shows hierarchical relationships and helps understand topic structure'
      };

    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Concept map generation failed:');
      return this.createFallbackConceptMap(request.query);
    }
  }

  /**
   * Create fallback concept map when generation fails
   */
  private createFallbackConceptMap(query: string): Visualization {
    const title = query.substring(0, 45).replace(/[^a-zA-Z0-9\s]/g, '');

    const fallbackContent = `graph TD
    A["${title}"]
    B["Core Concept 1"]
    C["Core Concept 2"]
    D["Core Concept 3"]
    E["See detailed explanation"]

    A --> B
    A --> C
    A --> D
    B --> E
    C --> E
    D --> E

    style A fill:#a78bfa,stroke:#7c3aed,stroke-width:3px,color:#fff
    style B fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style C fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style D fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style E fill:#93c5fd,stroke:#3b82f6,stroke-width:1px,color:#1e3a8a`;

    logger.info('⚠️ [ConceptMap] Using fallback diagram');

    return {
      type: 'concept_map',
      format: 'mermaid',
      priority: 1,
      content: fallbackContent,
      caption: `Concept map: ${query.substring(0, 50)}`,
      educationalValue: 'Shows hierarchical relationships and helps understand topic structure'
    };
  }

  /**
   * Generate Mermaid.js timeline (Phase 2)
   */
  private async generateTimeline(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info(`📅 [Visualization] Generating timeline...`);

      // Get subject name for context (defaults to 'textbook' if not specified)
      const subjectContext = request.metadata.subject
        ? `${request.metadata.subject} textbook`
        : 'textbook';

      const prompt = `Extract chronological events from this NCERT ${subjectContext} answer and create a Mermaid timeline.

IMPORTANT RULES:
1. Extract ONLY events and dates explicitly mentioned in the answer
2. Do NOT add any events from general knowledge
3. Keep events concise (max 10 events)
4. Use exact dates/years from the textbook
5. Maintain chronological order
6. Works for ANY subject: History, Civics, Science, Geography, etc.

Answer:
${request.answer}

Format:
timeline
    title [Topic Name]
    [Year] : [Event 1]
           : [Event 2]
    [Year] : [Event 3]

Generate ONLY the Mermaid timeline code, no explanations.`;

      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 500
      });

      let content = response.text.trim();

      // Validate and auto-correct Mermaid syntax
      content = MermaidValidator.validateAndCorrect(content, request.query);

      // Generate subject-appropriate caption and educational value
      const topicName = request.metadata.chapter || request.query.substring(0, 50);
      const caption = `Timeline: ${topicName}`;
      const educationalValue = request.metadata.subject === 'History'
        ? 'Helps remember chronological order of historical events for exams'
        : `Helps visualize chronological sequence of events in ${request.metadata.subject || 'this topic'}`;

      return {
        type: 'timeline',
        format: 'mermaid',
        priority: 1,
        content,
        caption,
        educationalValue
      };

    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Timeline generation failed:');
      return null;
    }
  }

  /**
   * Generate hierarchical tree (Phase 2)
   */
  private async generateHierarchicalTree(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info(`🌳 [Visualization] Generating hierarchical tree...`);

      const prompt = `You are an expert Mermaid.js diagram generator for NCERT educational content.

TASK: Create a valid Mermaid.js hierarchical tree showing classification/categorization.

CRITICAL RULES - MUST FOLLOW:
1. OUTPUT ONLY VALID MERMAID SYNTAX (NO markdown blocks, NO text, NO explanations)
2. MUST start with "graph TD" (top-down layout)
3. Use proper node syntax: A[Node Label]
4. Use arrows: --> (NOT → or any other symbol)
5. Extract ONLY classification explicitly stated in the answer below
6. Do NOT add categories from general knowledge
7. Maximum 3 levels deep
8. Maximum 12 nodes total
9. Node labels maximum 35 characters

VALID MERMAID EXAMPLE:
graph TD
    A[Economic Activities]
    B[Primary Sector]
    C[Secondary Sector]
    D[Tertiary Sector]
    E[Agriculture]
    F[Mining]
    G[Manufacturing]
    H[Construction]
    I[Services]
    J[Trade]

    A --> B
    A --> C
    A --> D
    B --> E
    B --> F
    C --> G
    C --> H
    D --> I
    D --> J

    style A fill:#a78bfa,stroke:#7c3aed,stroke-width:3px,color:#fff
    style B fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style C fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style D fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff

NCERT CONTENT:
Topic: ${request.query}
Answer: ${request.answer.substring(0, 1500)}

OUTPUT MERMAID SYNTAX ONLY (start with "graph TD"):`;

      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Lower temperature for consistency
        maxTokens: 800
      });

      let content = response.text.trim();

      logger.info({ data: content.substring(0, 200) }, '📝 [HierarchicalTree] Raw LLM output (first 200 chars):');

      // Check for text arrow format
      if (content.includes('→') || (content.includes('[') && !content.startsWith('graph'))) {
        logger.error('❌ [HierarchicalTree] LLM generated text format instead of Mermaid');
        return this.createFallbackHierarchicalTree(request.query);
      }

      // Check if empty
      if (!content || content.length < 30) {
        logger.error('❌ [HierarchicalTree] Generated empty content');
        return this.createFallbackHierarchicalTree(request.query);
      }

      // Validate and auto-correct Mermaid syntax
      const validation = MermaidValidator.validate(content);

      if (!validation.isValid) {
        logger.warn('⚠️ [HierarchicalTree] Validation failed, attempting auto-fix');
        content = MermaidValidator.validateAndCorrect(content, request.query);

        const revalidation = MermaidValidator.validate(content);
        if (!revalidation.isValid) {
          logger.error('❌ [HierarchicalTree] Auto-fix failed, using fallback');
          return this.createFallbackHierarchicalTree(request.query);
        }
      }

      logger.info('✅ [HierarchicalTree] Valid Mermaid syntax generated');

      return {
        type: 'hierarchical_tree',
        format: 'mermaid',
        priority: 2,
        content,
        caption: 'Classification hierarchy from NCERT textbook',
        educationalValue: 'Helps understand classification systems for Biology/Geography topics'
      };

    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Hierarchical tree generation failed:');
      return this.createFallbackHierarchicalTree(request.query);
    }
  }

  /**
   * Create fallback hierarchical tree when generation fails
   */
  private createFallbackHierarchicalTree(query: string): Visualization {
    const title = query.substring(0, 40).replace(/[^a-zA-Z0-9\s]/g, '');

    const fallbackContent = `graph TD
    A["${title}"]
    B["Category 1"]
    C["Category 2"]
    D["Subcategory 1.1"]
    E["Subcategory 1.2"]
    F["Subcategory 2.1"]
    G["Subcategory 2.2"]

    A --> B
    A --> C
    B --> D
    B --> E
    C --> F
    C --> G

    style A fill:#a78bfa,stroke:#7c3aed,stroke-width:3px,color:#fff
    style B fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style C fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff`;

    logger.info('⚠️ [HierarchicalTree] Using fallback diagram');

    return {
      type: 'hierarchical_tree',
      format: 'mermaid',
      priority: 2,
      content: fallbackContent,
      caption: 'Classification hierarchy from NCERT textbook',
      educationalValue: 'Helps understand classification systems for Biology/Geography topics'
    };
  }

  /**
   * Parse on-demand visualization request from user query
   */
  static parseOnDemandRequest(query: string): {
    isOnDemand: boolean;
    visualizationType?: string;
    topic?: string;
  } {
    const lowerQuery = query.toLowerCase();

    // Check for explicit visualization requests
    if (lowerQuery.includes('generate') || lowerQuery.includes('create') ||
      lowerQuery.includes('show') || lowerQuery.includes('draw')) {

      if (lowerQuery.includes('concept map')) {
        return {
          isOnDemand: true,
          visualizationType: 'concept_map',
          topic: this.extractTopic(query, 'concept map')
        };
      }

      if (lowerQuery.includes('timeline')) {
        return {
          isOnDemand: true,
          visualizationType: 'timeline',
          topic: this.extractTopic(query, 'timeline')
        };
      }

      if (lowerQuery.includes('comparison table') || lowerQuery.includes('table')) {
        return {
          isOnDemand: true,
          visualizationType: 'comparison_table',
          topic: this.extractTopic(query, 'table')
        };
      }

      if (lowerQuery.includes('flowchart')) {
        return {
          isOnDemand: true,
          visualizationType: 'flowchart',
          topic: this.extractTopic(query, 'flowchart')
        };
      }

      if (lowerQuery.includes('hierarchical tree') || lowerQuery.includes('tree')) {
        return {
          isOnDemand: true,
          visualizationType: 'hierarchical_tree',
          topic: this.extractTopic(query, 'tree')
        };
      }
    }

    return { isOnDemand: false };
  }

  /**
   * Extract topic from on-demand request
   */
  private static extractTopic(query: string, visualizationType: string): string {
    // Remove the visualization type and command words
    const topic = query
      .toLowerCase()
      .replace(/generate|create|show|draw|make/g, '')
      .replace(visualizationType, '')
      .replace(/for|of|about/g, '')
      .trim();

    return topic || query;
  }

  /**
   * Add visual indicators to comparison tables (Phase 2 enhancement)
   */
  static enhanceComparisonTable(tableContent: string): string {
    return tableContent
      .replace(/\byes\b/gi, '✅ Yes')
      .replace(/\bno\b/gi, '❌ No')
      .replace(/\bhigh\b/gi, '🔴 High')
      .replace(/\bmedium\b/gi, '🟡 Medium')
      .replace(/\blow\b/gi, '🟢 Low')
      .replace(/\bpresent\b/gi, '✅ Present')
      .replace(/\babsent\b/gi, '❌ Absent')
      .replace(/\bstrong\b/gi, '🔴 Strong')
      .replace(/\bweak\b/gi, '🟢 Weak');
  }

  /**
   * Generate bar chart using ECharts
   */
  private async generateBarChart(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info('📊 [Visualization] Generating bar chart...');

      const config = await this.echartsGenerator.generateBarChart({
        query: request.query,
        answer: request.answer,
        chunks: request.chunks,
        metadata: request.metadata
      });

      return {
        type: 'bar_chart',
        format: 'echarts',
        priority: 1,
        content: config,
        caption: `Source: NCERT Class ${request.metadata.class} ${request.metadata.subject}`,
        educationalValue: 'Compare data visually with bar chart'
      };
    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Bar chart generation failed:');
      return null;
    }
  }

  /**
   * Generate pie chart using ECharts
   */
  private async generatePieChart(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info('🥧 [Visualization] Generating pie chart...');

      const config = await this.echartsGenerator.generatePieChart({
        query: request.query,
        answer: request.answer,
        chunks: request.chunks,
        metadata: request.metadata
      });

      return {
        type: 'pie_chart',
        format: 'echarts',
        priority: 1,
        content: config,
        caption: `Source: NCERT Class ${request.metadata.class} ${request.metadata.subject}`,
        educationalValue: 'Understand proportions and distribution'
      };
    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Pie chart generation failed:');
      return null;
    }
  }

  /**
   * Generate line chart using ECharts
   */
  private async generateLineChart(request: VisualizationRequest): Promise<Visualization | null> {
    try {
      logger.info('📈 [Visualization] Generating line chart...');

      const config = await this.echartsGenerator.generateLineChart({
        query: request.query,
        answer: request.answer,
        chunks: request.chunks,
        metadata: request.metadata
      });

      return {
        type: 'line_chart',
        format: 'echarts',
        priority: 1,
        content: config,
        caption: `Source: NCERT Class ${request.metadata.class} ${request.metadata.subject}`,
        educationalValue: 'Track trends and changes over time'
      };
    } catch (error) {
      logger.error({ error: error }, '❌ [Visualization] Line chart generation failed:');
      return null;
    }
  }
}
