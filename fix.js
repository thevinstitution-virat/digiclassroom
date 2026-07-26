const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/rag/visual-element-detector.ts', 'utf8');

const target = \      return {
        hasVisualElements: elements.length > 0,
        elements,
        visualElementCount: elements.length,
        hasCharts,
        hasDiagrams,
        hasMaps,
    let prompt = \\\Analyze this page from an educational textbook (Page \\\).\\\\n\\\\n\\\;\;

const replacement = \      return {
        hasVisualElements: elements.length > 0,
        elements,
        visualElementCount: elements.length,
        hasCharts,
        hasDiagrams,
        hasMaps,
        hasTables,
        hasIllustrations,
        overallConfidence,
        detectionMethod: 'gpt4-vision'
      };
    } catch (error) {
      console.error('Error in detectWithGPT4Vision:', error);
      return this.getFallbackResult();
    }
  }

  /**
   * Build detection prompt
   */
  private buildDetectionPrompt(input: VisualElementDetectionInput): string {
    let prompt = \\\Analyze this page from an educational textbook (Page \\\).\\\\n\\\\n\\\;\;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/lib/ai/rag/visual-element-detector.ts', content);
    console.log("Fixed visual-element-detector.ts");
} else {
    console.log("Target not found!");
}
