/**
 * Learning Analytics Service
 * Analyzes learning patterns and provides progressive adaptation recommendations
 */

import { UserContext, ComplexityLevel } from './user-profile-service';
import { executeQuery, executeQuerySingle, executeUpdate } from '@/lib/db/connection';

export interface LearningInsights {
  learningVelocity: number; // Rate of learning progress (0-1)
  conceptMastery: { [concept: string]: number }; // Mastery levels per concept
  difficultyPreferences: {
    optimal: ComplexityLevel;
    comfortable: ComplexityLevel;
    challenging: ComplexityLevel;
  };
  engagementPatterns: {
    averageEngagement: number;
    peakEngagementTime: string;
    preferredInteractionLength: number;
    dropoffPoints: string[];
  };
  recommendedAdjustments: AdaptationRecommendation[];
}

export interface AdaptationRecommendation {
  type: 'complexity' | 'style' | 'pacing' | 'scaffolding' | 'content_type';
  current: string;
  recommended: string;
  confidence: number;
  reason: string;
}

export interface AdaptationParameters {
  difficultyAdjustment: number; // -1 to 1 (decrease to increase difficulty)
  styleAdaptations: {
    increaseVisual: boolean;
    increaseAuditory: boolean;
    increaseKinesthetic: boolean;
    increaseScaffolding: boolean;
  };
  scaffoldingLevel: 'minimal' | 'low' | 'moderate' | 'high';
  personalizedExamples: string[];
  motivationalElements: {
    encouragementLevel: 'low' | 'moderate' | 'high';
    celebrationTriggers: string[];
    progressIndicators: boolean;
  };
}

export interface InteractionRecord {
  id: string;
  user_id: string;
  session_id: string;
  query_text: string;
  response_quality_score: number;
  interaction_duration_seconds: number;
  difficulty_level: ComplexityLevel;
  concept_mastery_score: number;
  engagement_score: number;
  learning_velocity: number;
  subject: string;
  grade_level: number;
  menu_action: string;
  created_at: Date;
}

export class LearningAnalyticsService {
  constructor() {
    // Database connection is handled by the connection utility functions
  }

  /**
   * Analyze interaction patterns and learning insights
   */
  async analyzeInteractionPatterns(userId: string, days: number = 30): Promise<LearningInsights> {
    const interactions = await this.getInteractionHistory(userId, days);
    
    if (interactions.length === 0) {
      return this.getDefaultInsights();
    }

    return {
      learningVelocity: this.calculateLearningVelocity(interactions),
      conceptMastery: this.assessConceptMastery(interactions),
      difficultyPreferences: this.analyzeDifficultyPreferences(interactions),
      engagementPatterns: this.analyzeEngagementPatterns(interactions),
      recommendedAdjustments: this.generateAdjustmentRecommendations(interactions)
    };
  }

  /**
   * Adapt response based on learning progress
   */
  async adaptResponseBasedOnProgress(
    userContext: UserContext,
    currentQuery: string,
    learningInsights: LearningInsights
  ): Promise<AdaptationParameters> {
    
    // Real-time difficulty adjustment
    const currentDifficulty = this.assessQueryDifficulty(currentQuery);
    const optimalDifficulty = this.calculateOptimalDifficulty(
      learningInsights.learningVelocity,
      learningInsights.conceptMastery,
      currentDifficulty
    );
    
    // Learning style adaptation
    const styleAdaptations = this.generateStyleAdaptations(
      userContext.learningPreferences,
      learningInsights.engagementPatterns
    );
    
    // Scaffolding adjustments
    const scaffoldingLevel = this.determineScaffoldingLevel(
      learningInsights.conceptMastery,
      currentDifficulty,
      userContext.role
    );
    
    return {
      difficultyAdjustment: optimalDifficulty,
      styleAdaptations,
      scaffoldingLevel,
      personalizedExamples: this.generatePersonalizedExamples(learningInsights, userContext),
      motivationalElements: this.generateMotivationalElements(userContext, learningInsights)
    };
  }

  /**
   * Record interaction for analytics
   */
  async recordInteraction(
    userId: string,
    sessionId: string,
    queryText: string,
    responseData: any,
    userContext: UserContext
  ): Promise<void> {
    try {
        // @ts-ignore
      if (!this.db) return;

      const query = `
        INSERT INTO learning_analytics (
          user_id, session_id, query_text, response_quality_score,
          interaction_duration_seconds, difficulty_level, concept_mastery_score,
          engagement_score, learning_velocity, subject, grade_level, menu_action
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        userId,
        sessionId,
        queryText,
        responseData.qualityScore || 0.8,
        responseData.duration || 0,
        userContext.complexityLevel,
        responseData.masteryScore || 0.7,
        responseData.engagementScore || 0.8,
        responseData.learningVelocity || 0.5,
        userContext.educationalLevel.subjects[0] || 'general',
        userContext.educationalLevel.grade || 9,
        responseData.menuAction || 'general_query'
      ];

      await executeUpdate(query, values);
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  }

  /**
   * Get interaction history
   */
  private async getInteractionHistory(userId: string, days: number): Promise<InteractionRecord[]> {
    try {
        // @ts-ignore
      if (!this.db)
  return [];

      const query = `
        SELECT * FROM learning_analytics 
        WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY created_at DESC
        LIMIT 100
      `;
      
      const rows = await executeQuery(query, [userId, days]);
      return rows || [];
    } catch (error) {
      console.error('Error fetching interaction history:', error);
      return [];
    }
  }

  /**
   * Calculate learning velocity
   */
  private calculateLearningVelocity(interactions: InteractionRecord[]): number {
    if (interactions.length < 2)
  return 0.5;

    // Calculate improvement over time
    const recentInteractions = interactions.slice(0, 10);
    const olderInteractions = interactions.slice(-10);

    const recentAvgMastery = recentInteractions.reduce((sum, i) => sum + i.concept_mastery_score, 0) / recentInteractions.length;
    const olderAvgMastery = olderInteractions.reduce((sum, i) => sum + i.concept_mastery_score, 0) / olderInteractions.length;

    const improvement = recentAvgMastery - olderAvgMastery;
    return Math.max(0, Math.min(1, 0.5 + improvement));
  }

  /**
   * Assess concept mastery
   */
  private assessConceptMastery(interactions: InteractionRecord[]): { [concept: string]: number } {
    const conceptMastery: { [concept: string]: number } = {};
    
    // Group interactions by subject/concept
    const subjectGroups = interactions.reduce((groups, interaction) => {
      const subject = interaction.subject || 'general';
      if (!groups[subject]) groups[subject] = [];
      groups[subject].push(interaction);
      return groups;
    }, {} as { [subject: string]: InteractionRecord[] });

    // Calculate mastery for each subject
    Object.entries(subjectGroups).forEach(([subject, subjectInteractions]) => {
      const avgMastery = subjectInteractions.reduce((sum, i) => sum + i.concept_mastery_score, 0) / subjectInteractions.length;
      conceptMastery[subject] = avgMastery;
    });

    return conceptMastery;
  }

  /**
   * Analyze difficulty preferences
   */
  private analyzeDifficultyPreferences(interactions: InteractionRecord[]): LearningInsights['difficultyPreferences'] {
    const difficultyEngagement: { [key in ComplexityLevel]: number[] } = {
      'basic': [],
      'intermediate': [],
      'advanced': []
    };

    interactions.forEach(interaction => {
      const difficulty = interaction.difficulty_level;
      const engagement = interaction.engagement_score;
      if (difficultyEngagement[difficulty]) {
        difficultyEngagement[difficulty].push(engagement);
      }
    });

    // Calculate average engagement for each difficulty
    const avgEngagement: { [key in ComplexityLevel]: number } = {
      'basic': 0,
      'intermediate': 0,
      'advanced': 0
    };

    Object.entries(difficultyEngagement).forEach(([level, scores]) => {
      if (scores.length > 0) {
        avgEngagement[level as ComplexityLevel] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      }
    });

    // Determine preferences based on engagement
    const sortedByEngagement = Object.entries(avgEngagement)
      .sort(([,a], [,b]) => b - a)
      .map(([level]) => level as ComplexityLevel);

    return {
      optimal: sortedByEngagement[0] || 'intermediate',
      comfortable: sortedByEngagement[1] || 'basic',
      challenging: sortedByEngagement[2] || 'advanced'
    };
  }

  /**
   * Analyze engagement patterns
   */
  private analyzeEngagementPatterns(interactions: InteractionRecord[]): LearningInsights['engagementPatterns'] {
    const avgEngagement = interactions.reduce((sum, i) => sum + i.engagement_score, 0) / interactions.length;
    
    // Analyze time patterns (simplified)
    const hourlyEngagement: { [hour: number]: number[] } = {};
    interactions.forEach(interaction => {
      const hour = new Date(interaction.created_at).getHours();
      if (!hourlyEngagement[hour]) hourlyEngagement[hour] = [];
      hourlyEngagement[hour].push(interaction.engagement_score);
    });

    let peakHour = 14; // Default to 2 PM
    let maxEngagement = 0;
    Object.entries(hourlyEngagement).forEach(([hour, scores]) => {
      const avgHourEngagement = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      if (avgHourEngagement > maxEngagement) {
        maxEngagement = avgHourEngagement;
        peakHour = parseInt(hour);
      }
    });

    return {
      averageEngagement: avgEngagement,
      peakEngagementTime: `${peakHour}:00`,
      preferredInteractionLength: this.calculatePreferredInteractionLength(interactions),
      dropoffPoints: this.identifyDropoffPoints(interactions)
    };
  }

  /**
   * Generate adjustment recommendations
   */
  private generateAdjustmentRecommendations(interactions: InteractionRecord[]): AdaptationRecommendation[] {
    const recommendations: AdaptationRecommendation[] = [];
    
    const avgEngagement = interactions.reduce((sum, i) => sum + i.engagement_score, 0) / interactions.length;
    const avgMastery = interactions.reduce((sum, i) => sum + i.concept_mastery_score, 0) / interactions.length;

    // Low engagement recommendations
    if (avgEngagement < 0.6) {
      recommendations.push({
        type: 'style',
        current: 'current_approach',
        recommended: 'more_interactive',
        confidence: 0.8,
        reason: 'Low engagement detected, suggesting more interactive content'
      });
    }

    // Low mastery recommendations
    if (avgMastery < 0.6) {
      recommendations.push({
        type: 'scaffolding',
        current: 'current_level',
        recommended: 'increased_scaffolding',
        confidence: 0.9,
        reason: 'Low mastery scores suggest need for more scaffolding'
      });
    }

    return recommendations;
  }

  /**
   * Calculate optimal difficulty adjustment
   */
  private calculateOptimalDifficulty(
    learningVelocity: number,
    conceptMastery: { [concept: string]: number },
    currentDifficulty: number
  ): number {
    const avgMastery = Object.values(conceptMastery).reduce((sum, mastery) => sum + mastery, 0) / Object.values(conceptMastery).length || 0.5;
    
    let adjustment = 0;
    
    // If learning velocity is high and mastery is good, increase difficulty
    if (learningVelocity > 0.7 && avgMastery > 0.8) {
      adjustment = 0.1;
    }
    // If learning velocity is low or mastery is poor, decrease difficulty
    else if (learningVelocity < 0.4 || avgMastery < 0.5) {
      adjustment = -0.1;
    }
    
    return Math.max(-1, Math.min(1, adjustment));
  }

  /**
   * Generate style adaptations
   */
  private generateStyleAdaptations(
    preferences: UserContext['learningPreferences'],
    engagementPatterns: LearningInsights['engagementPatterns']
  ): AdaptationParameters['styleAdaptations'] {
    return {
      increaseVisual: preferences.visualLearning && engagementPatterns.averageEngagement < 0.7,
      increaseAuditory: preferences.primaryStyle === 'auditory' && engagementPatterns.averageEngagement < 0.7,
      increaseKinesthetic: preferences.handsonLearning && engagementPatterns.averageEngagement < 0.7,
      increaseScaffolding: preferences.needsScaffolding || engagementPatterns.averageEngagement < 0.6
    };
  }

  /**
   * Determine scaffolding level
   */
  private determineScaffoldingLevel(
    conceptMastery: { [concept: string]: number },
    currentDifficulty: number,
    role: string
  ): AdaptationParameters['scaffoldingLevel'] {
    const avgMastery = Object.values(conceptMastery).reduce((sum, mastery) => sum + mastery, 0) / Object.values(conceptMastery).length || 0.5;
    
    if (role === 'student') {
      if (avgMastery < 0.4 || currentDifficulty > 0.8)
  return 'high';
      if (avgMastery < 0.6 || currentDifficulty > 0.6)
  return 'moderate';
      if (avgMastery > 0.8 && currentDifficulty < 0.4)
  return 'minimal';
      return 'low';
    }
    
    return 'low'; // Default for teachers and parents
  }

  /**
   * Generate personalized examples
   */
  private generatePersonalizedExamples(insights: LearningInsights, context: UserContext): string[] {
    const examples = [];
    
    // Based on engagement patterns
    if (insights.engagementPatterns.averageEngagement > 0.8) {
      examples.push('challenging real-world scenarios');
    } else {
      examples.push('familiar everyday examples');
    }
    
    // Based on concept mastery
    const avgMastery = Object.values(insights.conceptMastery).reduce((sum, mastery) => sum + mastery, 0) / Object.values(insights.conceptMastery).length || 0.5;
    if (avgMastery > 0.8) {
      examples.push('advanced applications');
    } else {
      examples.push('basic foundational examples');
    }
    
    return examples;
  }

  /**
   * Generate motivational elements
   */
  private generateMotivationalElements(context: UserContext, insights: LearningInsights): AdaptationParameters['motivationalElements'] {
    const avgEngagement = insights.engagementPatterns.averageEngagement;
    
    return {
      encouragementLevel: avgEngagement < 0.5 ? 'high' : avgEngagement < 0.7 ? 'moderate' : 'low',
      celebrationTriggers: [
        'concept_mastery_improvement',
        'consistent_engagement',
        'difficulty_progression'
      ],
      progressIndicators: context.role === 'student' && (context.educationalLevel.grade || 9) <= 10
    };
  }

  /**
   * Helper methods
   */
  private assessQueryDifficulty(query: string): number {
    // Simplified difficulty assessment
    const complexWords = ['analyze', 'evaluate', 'synthesize', 'compare', 'contrast'];
    const simpleWords = ['what', 'who', 'when', 'where', 'list'];
    
    const queryLower = query.toLowerCase();
    let difficulty = 0.5;
    
    if (complexWords.some(word => queryLower.includes(word))) difficulty += 0.3;
    if (simpleWords.some(word => queryLower.includes(word))) difficulty -= 0.2;
    
    return Math.max(0.1, Math.min(1.0, difficulty));
  }

  private calculatePreferredInteractionLength(interactions: InteractionRecord[]): number {
    const avgDuration = interactions.reduce((sum, i) => sum + i.interaction_duration_seconds, 0) / interactions.length;
    return avgDuration || 120; // Default 2 minutes
  }

  private identifyDropoffPoints(interactions: InteractionRecord[]): string[] {
    // Simplified dropoff analysis
    const dropoffs = [];
    
    const lowEngagementInteractions = interactions.filter(i => i.engagement_score < 0.4);
    if (lowEngagementInteractions.length > interactions.length * 0.3) {
      dropoffs.push('low_engagement_threshold');
    }
    
    return dropoffs;
  }

  private getDefaultInsights(): LearningInsights {
    return {
      learningVelocity: 0.5,
      conceptMastery: {},
      difficultyPreferences: {
        optimal: 'intermediate',
        comfortable: 'basic',
        challenging: 'advanced'
      },
      engagementPatterns: {
        averageEngagement: 0.7,
        peakEngagementTime: '14:00',
        preferredInteractionLength: 120,
        dropoffPoints: []
      },
      recommendedAdjustments: []
    };
  }
}

// Export singleton instance
export const learningAnalyticsService = new LearningAnalyticsService();
