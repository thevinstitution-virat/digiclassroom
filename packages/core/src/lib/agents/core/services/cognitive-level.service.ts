// src/lib/agents/core/services/cognitive-level.service.ts

export class CognitiveLevelService {
    /**
     * Determine Bloom's Taxonomy cognitive level based on student grade
     * Extracted from legacy agents to ensure consistent pedagogical standards
     * 
     * @param gradeLevel The student's class/grade level (1-12)
     * @returns A description of the expected cognitive level for prompting
     */
    public determineCognitiveLevel(gradeLevel: number): string {
        if (gradeLevel <= 3) {
            return "Remember/Understand - Focus on basic recall and simple explanation";
        } else if (gradeLevel <= 6) {
            return "Understand/Apply - Focus on comprehension and basic application";
        } else if (gradeLevel <= 8) {
            return "Apply/Analyze - Focus on using knowledge and finding patterns";
        } else if (gradeLevel <= 10) {
            return "Analyze/Evaluate - Focus on breaking down problems and making judgments";
        } else {
            return "Evaluate/Create - Focus on critical thinking and synthesis";
        }
    }

    /**
     * Determine exact Bloom's Level noun for telemetry/metadata
     */
    public getBloomLevel(gradeLevel: number): string {
        if (gradeLevel <= 3)
  return 'Understand';
        if (gradeLevel <= 8)
  return 'Apply';
        return 'Analyze';
    }
}
