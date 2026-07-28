export interface NormalizedQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

export interface NormalizedResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passed: boolean | null;
  breakdown: {
    questionId: string;
    questionText: string;
    selectedOptionId: string | null;
    correctOptionId: string;
    explanation?: string | null;
    isCorrect: boolean;
  }[];
}
