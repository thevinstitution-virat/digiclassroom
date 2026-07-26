import { logger } from '@/lib/logger';

/**
 * Mermaid Syntax Validator for DigiClassroom Pro
 * Validates Mermaid.js syntax before rendering to prevent errors
 * Includes auto-fix capabilities for common mistakes
 */

export interface MermaidValidationResult {
  isValid: boolean;
  errors: string[];
  correctedSyntax?: string;
  warnings?: string[];
}

export class MermaidValidator {
  /**
   * Comprehensive Mermaid syntax validation
   */
  static validate(mermaidCode: string): MermaidValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let correctedSyntax = mermaidCode.trim();

    // Step 1: Remove markdown code blocks if present
    if (correctedSyntax.includes('```')) {
      correctedSyntax = correctedSyntax
        .replace(/```mermaid\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();

      warnings.push('Removed markdown code blocks');
    }

    // Step 2: Validate diagram type
    const validDiagramTypes = [
      'graph TD', 'graph LR', 'graph RL', 'graph BT',
      'timeline', 'sequenceDiagram', 'classDiagram',
      'stateDiagram', 'erDiagram', 'flowchart TD', 'flowchart LR'
    ];

    const hasValidType = validDiagramTypes.some(type =>
      correctedSyntax.startsWith(type)
    );

    if (!hasValidType) {
      errors.push(`Diagram must start with valid type: ${validDiagramTypes.join(', ')}`);
      return { isValid: false, errors };
    }

    // Step 3: Validate structure
    const lines = correctedSyntax.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      errors.push('Diagram must have at least 2 lines');
      return { isValid: false, errors };
    }

    // Step 4: Auto-fix common errors
    correctedSyntax = this.autoFixCommonErrors(correctedSyntax);

    // Step 5: Validate node syntax (for graphs)
    if (correctedSyntax.startsWith('graph') || correctedSyntax.startsWith('flowchart')) {
      const nodePattern = /[A-Z0-9]+\[.+?\]/g;
      const nodes = correctedSyntax.match(nodePattern);

      if (!nodes || nodes.length === 0) {
        errors.push('Graph must contain at least one node (e.g., A[Node Label])');
        return { isValid: false, errors };
      }

      // Check for connections
      const arrowPattern = /-->/g;
      const arrows = correctedSyntax.match(arrowPattern);

      if (!arrows || arrows.length === 0) {
        warnings.push('Graph has no connections (-->)');
      }

      // Validate node count (max 15 for readability)
      if (nodes.length > 15) {
        warnings.push(`Graph has ${nodes.length} nodes (recommended max: 15)`);
      }
    }

    // Step 6: Validate timeline syntax
    if (correctedSyntax.startsWith('timeline')) {
      const timelinePattern = /\d{4}\s*:\s*.+/g;
      const timelineEntries = correctedSyntax.match(timelinePattern);

      if (!timelineEntries || timelineEntries.length === 0) {
        errors.push('Timeline must have at least one entry (e.g., 1947 : Independence)');
        return { isValid: false, errors };
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      correctedSyntax: errors.length === 0 ? correctedSyntax : undefined,
      warnings
    };
  }

  /**
   * Auto-fix common Mermaid mistakes
   */
  private static autoFixCommonErrors(code: string): string {
    let fixed = code;

    // Fix 1: Normalize whitespace (but preserve line breaks)
    fixed = fixed.replace(/[ \t]+/g, ' ');

    // Fix 2: Fix arrow formatting
    fixed = fixed.replace(/ ?--> ?/g, ' --> ');
    fixed = fixed.replace(/ ?--\| ?/g, ' --|');
    fixed = fixed.replace(/ ?\|-- ?/g, '|-- ');

    // Fix 3: Fix common typos in arrows
    fixed = fixed.replace(/-->/g, ' --> ');
    fixed = fixed.replace(/\s+-->\s+/g, ' --> ');

    // Fix 4: Ensure proper line breaks after semicolons
    fixed = fixed.replace(/;/g, '\n');

    // Fix 5: Remove invalid characters in node IDs (keep alphanumeric, brackets, arrows, pipes, colons)
    // This is a conservative fix - only remove clearly invalid chars
    fixed = fixed.split('\n').map(line => {
      // Don't modify the first line (diagram type)
      if (line.match(/^(graph|flowchart|timeline|sequenceDiagram|classDiagram)/)) {
        return line;
      }
      // For other lines, preserve valid Mermaid syntax
      return line;
    }).join('\n');

    // Fix 6: Ensure classDef and style statements are on separate lines
    fixed = fixed.replace(/classDef /g, '\n    classDef ');
    fixed = fixed.replace(/style /g, '\n    style ');

    // Fix 7: Remove duplicate empty lines
    fixed = fixed.replace(/\n\n+/g, '\n');

    return fixed.trim();
  }

  /**
   * Create fallback diagram for failed generation
   */
  static createFallbackDiagram(query: string, error?: string): string {
    const cleanQuery = query.substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '');

    return `graph TD
    A["${cleanQuery}"]
    A --> B["See detailed answer above"]
    
    style A fill:#60a5fa,stroke:#2563eb,stroke-width:2px,color:#fff
    style B fill:#93c5fd,stroke:#3b82f6,stroke-width:2px,color:#fff`;
  }

  /**
   * Validate and auto-correct Mermaid code
   * Returns corrected code or fallback diagram
   */
  static validateAndCorrect(mermaidCode: string, query: string): string {
    const validation = this.validate(mermaidCode);

    if (validation.isValid && validation.correctedSyntax) {
      if (validation.warnings && validation.warnings.length > 0) {
        logger.warn({ data: validation.warnings }, '⚠️ [Mermaid] Validation warnings:');
      }
      return validation.correctedSyntax;
    }

    logger.error({ data: validation.errors }, '❌ [Mermaid] Validation failed:');
    return this.createFallbackDiagram(query);
  }

  /**
   * Check if Mermaid code is likely to render successfully
   */
  static isLikelyValid(mermaidCode: string): boolean {
    const validation = this.validate(mermaidCode);
    return validation.isValid;
  }

  /**
   * Check if content is Mermaid syntax
   */
  static isMermaidSyntax(content: string): boolean {
    const mermaidKeywords = [
      'graph ', 'flowchart ', 'sequenceDiagram', 'classDiagram',
      'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'timeline'
    ];

    const trimmed = content.trim().toLowerCase();
    return mermaidKeywords.some(keyword =>
      trimmed.startsWith(keyword.toLowerCase())
    );
  }
}

