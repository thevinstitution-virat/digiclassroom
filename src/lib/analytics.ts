export function computeEngagementScore(data: {
  completionPct: number;
  quizParticipationRate: number;
  studyConsistencyScore: number;
  interactionDepth: number;
}): number {
  return Math.min(100, Math.round(
    data.completionPct          * 0.30 +
    data.quizParticipationRate  * 0.25 +
    data.studyConsistencyScore  * 0.25 +
    data.interactionDepth       * 0.20
  ));
}

export function computeRiskScore(engagementScore: number, daysSinceLastActive: number): number {
  const decayMultiplier = Math.min(2, 1 + (daysSinceLastActive / 14));
  return Math.min(100, Math.round((100 - engagementScore) * decayMultiplier));
}
