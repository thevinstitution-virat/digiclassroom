/**
 * Continuous Quality Monitor
 * 🎯 QUALITY MONITORING: Real-time quality assessment and reporting
 */

import { VerifiedCitation } from '../citations/accurate-citation-generator';
import { QualityIssue } from './golden-set-validator';

export interface QualityMetrics {
  dailyResponses: number;
  hallucinationRate: number;
  citationAccuracy: number;
  averageResponseTime: number;
  userSatisfactionScore: number;
  averageQualityScore: number;
  fidelityScore: number;
}

export interface ProcessingMetrics {
  responseTimeMs: number;
  retrievalTimeMs: number;
  generationTimeMs: number;
  verificationTimeMs: number;
  totalChunksProcessed: number;
  fidelityScore: number;
}

export interface QualityAssessment {
  sessionId: string;
  query: string;
  response: string;
  overallScore: number;
  hasCriticalIssues: boolean;
  issues: QualityIssue[];
  metrics: {
    contentQuality: number;
    citationQuality: number;
    responseTime: number;
    fidelityScore: number;
  };
  timestamp: Date;
}

export interface DailyQualityReport {
  date: string;
  totalResponses: number;
  averageQualityScore: number;
  hallucinationRate: number;
  citationAccuracy: number;
  responseTimeP95: number;
  fidelityScore: number;
  
  qualityBreakdown: {
    excellent: number;    // >0.9 score
    good: number;         // 0.7-0.9 score
    acceptable: number;   // 0.5-0.7 score
    poor: number;         // <0.5 score
  };
  
  commonIssues: IssueFrequency[];
  recommendations: string[];
  trendsFromPreviousDay: QualityTrends;
}

export interface IssueFrequency {
  issueType: string;
  count: number;
  percentage: number;
  severity: string;
}

export interface QualityTrends {
  qualityScoreChange: number;
  hallucinationRateChange: number;
  citationAccuracyChange: number;
  responseTimeChange: number;
  fidelityScoreChange: number;
}

export interface QualityAlert {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'quality_degradation' | 'high_hallucination_rate' | 'citation_accuracy_drop' | 'response_time_spike';
  message: string;
  metrics: any;
  timestamp: Date;
  resolved: boolean;
}

export class ContinuousQualityMonitor {
  private qualityMetrics: QualityMetrics = {
    dailyResponses: 0,
    hallucinationRate: 0,
    citationAccuracy: 0,
    averageResponseTime: 0,
    userSatisfactionScore: 0,
    averageQualityScore: 0,
    fidelityScore: 0
  };

  private qualityHistory: QualityAssessment[] = [];
  private alertHistory: QualityAlert[] = [];

  // Quality thresholds for alerts
  private readonly ALERT_THRESHOLDS = {
    QUALITY_SCORE: 0.7,
    HALLUCINATION_RATE: 0.05, // 5%
    CITATION_ACCURACY: 0.85,
    RESPONSE_TIME_P95: 15000, // 15 seconds
    FIDELITY_SCORE: 0.75
  };

  /**
   * 🎯 MAIN MONITORING METHOD: Monitor response quality in real-time
   */
  async monitorResponseQuality(
    sessionId: string,
    query: string,
    response: string,
    citations: VerifiedCitation[],
    processingMetrics: ProcessingMetrics
  ): Promise<void> {
    console.log('📊 Monitoring response quality...');

    try {
      // Real-time quality assessment
      const qualityAssessment = await this.assessResponseQuality(
        sessionId,
        query,
        response,
        citations,
        processingMetrics
      );

      // Update running metrics
      await this.updateQualityMetrics(qualityAssessment);

      // Store assessment for analysis
      this.qualityHistory.push(qualityAssessment);

      // Log for analysis if quality issues detected
      if (qualityAssessment.overallScore < this.ALERT_THRESHOLDS.QUALITY_SCORE) {
        await this.logQualityIssue(qualityAssessment);
      }

      // Trigger alerts for critical issues
      if (qualityAssessment.hasCriticalIssues) {
        await this.triggerQualityAlert(qualityAssessment);
      }

      console.log(`📊 Quality monitoring completed: ${(qualityAssessment.overallScore * 100).toFixed(1)}% score`);

    } catch (error) {
      console.error('❌ Quality monitoring failed:', error);
    }
  }

  /**
   * Assess response quality across multiple dimensions
   */
  private async assessResponseQuality(
    sessionId: string,
    query: string,
    response: string,
    citations: VerifiedCitation[],
    processingMetrics: ProcessingMetrics
  ): Promise<QualityAssessment> {
    const issues: QualityIssue[] = [];

    // Content quality assessment
    const contentQuality = await this.assessContentQuality(response, issues);

    // Citation quality assessment
    const citationQuality = await this.assessCitationQuality(citations, issues);

    // Response time assessment
    const responseTimeScore = this.assessResponseTime(processingMetrics.responseTimeMs);

    // Fidelity score from processing metrics
    const fidelityScore = processingMetrics.fidelityScore;

    // Calculate overall score
    const overallScore = this.calculateOverallQualityScore({
      contentQuality,
      citationQuality,
      responseTimeScore,
      fidelityScore
    });

    // Check for critical issues
    const hasCriticalIssues = issues.some(issue => issue.severity === 'critical') ||
                             overallScore < 0.5;

    return {
      sessionId,
      query,
      response,
      overallScore,
      hasCriticalIssues,
      issues,
      metrics: {
        contentQuality,
        citationQuality,
        responseTime: processingMetrics.responseTimeMs,
        fidelityScore
      },
      timestamp: new Date()
    };
  }

  /**
   * Generate daily quality report
   */
  async generateDailyQualityReport(): Promise<DailyQualityReport> {
    const today = new Date().toISOString().split('T')[0];
    console.log(`📈 Generating daily quality report for ${today}...`);

    const todayAssessments = this.qualityHistory.filter(
      assessment => assessment.timestamp.toISOString().split('T')[0] === today
    );

    if (todayAssessments.length === 0) {
      return this.getEmptyDailyReport(today);
    }

    const qualityData = this.aggregateDailyMetrics(todayAssessments);
    const trendsFromPreviousDay = await this.calculateQualityTrends(today);

    const report: DailyQualityReport = {
      date: today,
      totalResponses: qualityData.totalResponses,
      averageQualityScore: qualityData.averageQualityScore,
      hallucinationRate: qualityData.hallucinationRate,
      citationAccuracy: qualityData.citationAccuracy,
      responseTimeP95: qualityData.responseTimeP95,
      fidelityScore: qualityData.fidelityScore,

      qualityBreakdown: {
        excellent: qualityData.excellentResponses,
        good: qualityData.goodResponses,
        acceptable: qualityData.acceptableResponses,
        poor: qualityData.poorResponses
      },

      commonIssues: qualityData.topIssues.slice(0, 10),
      recommendations: this.generateImprovementRecommendations(qualityData),
      trendsFromPreviousDay
    };

    console.log(`📈 Daily quality report generated: ${report.totalResponses} responses, ${(report.averageQualityScore * 100).toFixed(1)}% avg quality`);
    return report;
  }

  /**
   * Update running quality metrics
   */
  private async updateQualityMetrics(assessment: QualityAssessment): Promise<void> {
    this.qualityMetrics.dailyResponses++;
    
    // Update running averages
    const alpha = 0.1; // Exponential moving average factor
    this.qualityMetrics.averageQualityScore = 
      (1 - alpha) * this.qualityMetrics.averageQualityScore + alpha * assessment.overallScore;
    
    this.qualityMetrics.averageResponseTime = 
      (1 - alpha) * this.qualityMetrics.averageResponseTime + alpha * assessment.metrics.responseTime;
    
    this.qualityMetrics.fidelityScore = 
      (1 - alpha) * this.qualityMetrics.fidelityScore + alpha * assessment.metrics.fidelityScore;

    // Update hallucination rate
    const hasHallucinationIssues = assessment.issues.some(issue => 
      issue.type.includes('hallucination') || issue.type.includes('external_knowledge')
    );
    this.qualityMetrics.hallucinationRate = 
      (1 - alpha) * this.qualityMetrics.hallucinationRate + alpha * (hasHallucinationIssues ? 1 : 0);

    // Update citation accuracy
    this.qualityMetrics.citationAccuracy = 
      (1 - alpha) * this.qualityMetrics.citationAccuracy + alpha * assessment.metrics.citationQuality;
  }

  /**
   * Trigger quality alert for critical issues
   */
  private async triggerQualityAlert(assessment: QualityAssessment): Promise<void> {
    const criticalIssues = assessment.issues.filter(issue => issue.severity === 'critical');
    
    for (const issue of criticalIssues) {
      const alert: QualityAlert = {
        alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        severity: 'critical',
        type: this.mapIssueTypeToAlertType(issue.type),
        message: `Critical quality issue detected: ${issue.description}`,
        metrics: {
          sessionId: assessment.sessionId,
          overallScore: assessment.overallScore,
          issueType: issue.type,
          query: assessment.query.substring(0, 100)
        },
        timestamp: new Date(),
        resolved: false
      };

      this.alertHistory.push(alert);
      console.warn(`🚨 CRITICAL QUALITY ALERT: ${alert.message}`);
    }
  }

  /**
   * Assess content quality
   */
  private async assessContentQuality(response: string, issues: QualityIssue[]): Promise<number> {
    let score = 1.0;

    // Check for placeholder content
    const placeholderPatterns = [
      /\[placeholder\]/gi,
      /\[insert.*\]/gi,
      /\[todo.*\]/gi,
      /\[tbd\]/gi
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(response)) {
        score -= 0.3;
        issues.push({
          type: 'placeholder_content',
          severity: 'critical',
          description: 'Response contains placeholder content',
          location: 'content',
          recommendation: 'Replace placeholders with actual content'
        });
      }
    }

    // Check for appropriate length
    const wordCount = response.split(/\s+/).length;
    if (wordCount < 20) {
      score -= 0.2;
      issues.push({
        type: 'too_short',
        severity: 'medium',
        description: `Response too short: ${wordCount} words`,
        location: 'content',
        recommendation: 'Provide more comprehensive answer'
      });
    } else if (wordCount > 500) {
      score -= 0.1;
      issues.push({
        type: 'too_long',
        severity: 'low',
        description: `Response too long: ${wordCount} words`,
        location: 'content',
        recommendation: 'Consider making response more concise'
      });
    }

    return Math.max(0, score);
  }

  /**
   * Assess citation quality
   */
  private async assessCitationQuality(citations: VerifiedCitation[], issues: QualityIssue[]): Promise<number> {
    if (citations.length === 0) {
      issues.push({
        type: 'no_citations',
        severity: 'high',
        description: 'Response lacks textbook citations',
        location: 'citations',
        recommendation: 'Add appropriate textbook references'
      });
      return 0.3;
    }

    let score = 1.0;
    let validCitations = 0;

    for (const citation of citations) {
      if (citation.verification.isVerified && citation.verification.accuracy > 0.8) {
        validCitations++;
      } else {
        score -= 0.2;
        issues.push({
          type: 'invalid_citation',
          severity: 'medium',
          description: `Citation validation failed: Chapter ${citation.chapter.number}`,
          location: 'citations',
          recommendation: 'Verify citation accuracy against textbook'
        });
      }
    }

    return Math.max(0.1, score * (validCitations / citations.length));
  }

  /**
   * Assess response time performance
   */
  private assessResponseTime(responseTimeMs: number): number {
    if (responseTimeMs < 5000) return 1.0;      // Excellent: < 5s
    if (responseTimeMs < 10000) return 0.8;     // Good: 5-10s
    if (responseTimeMs < 15000) return 0.6;     // Acceptable: 10-15s
    return 0.3;                                 // Poor: > 15s
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallQualityScore(metrics: {
    contentQuality: number;
    citationQuality: number;
    responseTimeScore: number;
    fidelityScore: number;
  }): number {
    const weights = {
      contentQuality: 0.4,
      citationQuality: 0.3,
      fidelityScore: 0.2,
      responseTimeScore: 0.1
    };

    return Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (metrics[key as keyof typeof metrics] * weight);
    }, 0);
  }

  // Helper methods
  private aggregateDailyMetrics(assessments: QualityAssessment[]): any {
    const totalResponses = assessments.length;
    const averageQualityScore = assessments.reduce((sum, a) => sum + a.overallScore, 0) / totalResponses;
    
    const qualityBreakdown = {
      excellentResponses: assessments.filter(a => a.overallScore > 0.9).length,
      goodResponses: assessments.filter(a => a.overallScore > 0.7 && a.overallScore <= 0.9).length,
      acceptableResponses: assessments.filter(a => a.overallScore > 0.5 && a.overallScore <= 0.7).length,
      poorResponses: assessments.filter(a => a.overallScore <= 0.5).length
    };

    const responseTimes = assessments.map(a => a.metrics.responseTime).sort((a, b) => a - b);
    const responseTimeP95 = responseTimes[Math.floor(responseTimes.length * 0.95)];

    const hallucinationRate = assessments.filter(a => 
      a.issues.some(issue => issue.type.includes('hallucination'))
    ).length / totalResponses;

    const citationAccuracy = assessments.reduce((sum, a) => sum + a.metrics.citationQuality, 0) / totalResponses;
    const fidelityScore = assessments.reduce((sum, a) => sum + a.metrics.fidelityScore, 0) / totalResponses;

    // Aggregate common issues
    const issueFrequency = new Map<string, number>();
    assessments.forEach(a => {
      a.issues.forEach(issue => {
        issueFrequency.set(issue.type, (issueFrequency.get(issue.type) || 0) + 1);
      });
    });

    const topIssues = Array.from(issueFrequency.entries())
      .map(([type, count]) => ({
        issueType: type,
        count,
        percentage: (count / totalResponses) * 100,
        severity: 'medium' // Simplified for now
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalResponses,
      averageQualityScore,
      hallucinationRate,
      citationAccuracy,
      responseTimeP95,
      fidelityScore,
      ...qualityBreakdown,
      topIssues
    };
  }

  private async calculateQualityTrends(today: string): Promise<QualityTrends> {
    const yesterday = new Date(Date.parse(today) - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const todayAssessments = this.qualityHistory.filter(
      a => a.timestamp.toISOString().split('T')[0] === today
    );
    const yesterdayAssessments = this.qualityHistory.filter(
      a => a.timestamp.toISOString().split('T')[0] === yesterday
    );

    if (yesterdayAssessments.length === 0) {
      return {
        qualityScoreChange: 0,
        hallucinationRateChange: 0,
        citationAccuracyChange: 0,
        responseTimeChange: 0,
        fidelityScoreChange: 0
      };
    }

    const todayMetrics = this.aggregateDailyMetrics(todayAssessments);
    const yesterdayMetrics = this.aggregateDailyMetrics(yesterdayAssessments);

    return {
      qualityScoreChange: todayMetrics.averageQualityScore - yesterdayMetrics.averageQualityScore,
      hallucinationRateChange: todayMetrics.hallucinationRate - yesterdayMetrics.hallucinationRate,
      citationAccuracyChange: todayMetrics.citationAccuracy - yesterdayMetrics.citationAccuracy,
      responseTimeChange: todayMetrics.responseTimeP95 - yesterdayMetrics.responseTimeP95,
      fidelityScoreChange: todayMetrics.fidelityScore - yesterdayMetrics.fidelityScore
    };
  }

  private generateImprovementRecommendations(qualityData: any): string[] {
    const recommendations = [];

    if (qualityData.averageQualityScore < 0.7) {
      recommendations.push('Overall quality below target - review generation parameters');
    }

    if (qualityData.hallucinationRate > 0.05) {
      recommendations.push('High hallucination rate detected - strengthen source verification');
    }

    if (qualityData.citationAccuracy < 0.85) {
      recommendations.push('Citation accuracy needs improvement - verify textbook references');
    }

    if (qualityData.responseTimeP95 > 15000) {
      recommendations.push('Response times too high - optimize processing pipeline');
    }

    return recommendations;
  }

  private getEmptyDailyReport(date: string): DailyQualityReport {
    return {
      date,
      totalResponses: 0,
      averageQualityScore: 0,
      hallucinationRate: 0,
      citationAccuracy: 0,
      responseTimeP95: 0,
      fidelityScore: 0,
      qualityBreakdown: { excellent: 0, good: 0, acceptable: 0, poor: 0 },
      commonIssues: [],
      recommendations: ['No data available for analysis'],
      trendsFromPreviousDay: {
        qualityScoreChange: 0,
        hallucinationRateChange: 0,
        citationAccuracyChange: 0,
        responseTimeChange: 0,
        fidelityScoreChange: 0
      }
    };
  }

  private async logQualityIssue(assessment: QualityAssessment): Promise<void> {
    console.warn(`⚠️ Quality issue detected: Score ${(assessment.overallScore * 100).toFixed(1)}% for query: "${assessment.query.substring(0, 50)}..."`);
  }

  private mapIssueTypeToAlertType(issueType: string): QualityAlert['type'] {
    if (issueType.includes('hallucination')) return 'high_hallucination_rate';
    if (issueType.includes('citation')) return 'citation_accuracy_drop';
    if (issueType.includes('response_time')) return 'response_time_spike';
    return 'quality_degradation';
  }
}
