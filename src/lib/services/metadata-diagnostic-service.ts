/**
 * Metadata Diagnostic Service
 * 🔧 CRITICAL: Diagnoses and repairs vector database metadata issues
 */

import { QdrantClient } from '@qdrant/js-client-rest';

export interface MetadataDiagnosticReport {
  totalPoints: number;
  metadataFields: {
    [fieldName: string]: {
      present: number;
      missing: number;
      uniqueValues: string[];
      sampleValues: any[];
    };
  };
  subjectAnalysis: {
    expectedSubjects: string[];
    foundSubjects: string[];
    missingSubjects: string[];
    caseVariations: { [subject: string]: string[] };
  };
  recommendations: string[];
  criticalIssues: string[];
}

export interface MetadataRepairPlan {
  reindexRequired: boolean;
  metadataUpdates: Array<{
    pointId: string;
    updates: { [key: string]: any };
  }>;
  canonicalizationRules: { [field: string]: { [oldValue: string]: string } };
}

export class MetadataDiagnosticService {
  private qdrantClient: QdrantClient;
  private collectionName = 'ncert-books-enhanced';

  // Expected metadata schema
  private readonly REQUIRED_METADATA_FIELDS = [
    'subject',
    'board',
    'class_level',
    'chapter',
    'section'
  ];

  private readonly EXPECTED_SUBJECTS = [
    'Geography',
    'History',
    'Political Science',
    'Economics',
    'Mathematics',
    'Science',
    'English'
  ];

  private readonly EXPECTED_BOARDS = ['CBSE', 'ICSE', 'State'];
  private readonly EXPECTED_CLASS_LEVELS = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

  constructor() {
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
  }

  /**
   * 🔧 CRITICAL: Comprehensive metadata diagnostic
   */
  async runComprehensiveDiagnostic(): Promise<MetadataDiagnosticReport> {
    console.log('🔍 Starting comprehensive metadata diagnostic...');

    try {
      // Get all points with metadata
      const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
        limit: 1000, // Analyze up to 1000 points
        with_payload: true,
        with_vector: false // We don't need vectors for metadata analysis
      });

      const points = scrollResult.points;
      console.log(`📊 Analyzing ${points.length} points for metadata quality`);

      // Analyze metadata fields
      const metadataFields: { [fieldName: string]: any } = {};
      const subjectVariations: { [subject: string]: Set<string> } = {};
      const allSubjects = new Set<string>();

      // Initialize field analysis
      for (const field of this.REQUIRED_METADATA_FIELDS) {
        metadataFields[field] = {
          present: 0,
          missing: 0,
          uniqueValues: new Set(),
          sampleValues: []
        };
      }

      // Analyze each point
      for (const point of points) {
        const payload = point.payload || {};

        // Check each required field
        for (const field of this.REQUIRED_METADATA_FIELDS) {
          if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
            metadataFields[field].present++;
            metadataFields[field].uniqueValues.add(String(payload[field]));
            
            if (metadataFields[field].sampleValues.length < 10) {
              metadataFields[field].sampleValues.push(payload[field]);
            }
          } else {
            metadataFields[field].missing++;
          }
        }

        // Special analysis for subjects
        if (payload.subject) {
          const subject = String(payload.subject);
          allSubjects.add(subject);
          
          // Check for case variations
          const normalizedSubject = subject.toLowerCase();
          if (!subjectVariations[normalizedSubject]) {
            subjectVariations[normalizedSubject] = new Set();
          }
          subjectVariations[normalizedSubject].add(subject);
        }
      }

      // Convert sets to arrays for serialization
      for (const field of this.REQUIRED_METADATA_FIELDS) {
        metadataFields[field].uniqueValues = Array.from(metadataFields[field].uniqueValues);
      }

      // Analyze subject variations
      const caseVariations: { [subject: string]: string[] } = {};
      for (const [normalized, variations] of Object.entries(subjectVariations)) {
        if (variations.size > 1) {
          caseVariations[normalized] = Array.from(variations);
        }
      }

      // Generate recommendations and identify critical issues
      const recommendations: string[] = [];
      const criticalIssues: string[] = [];

      // Check for missing metadata
      for (const field of this.REQUIRED_METADATA_FIELDS) {
        const missingPercentage = (metadataFields[field].missing / points.length) * 100;
        if (missingPercentage > 10) {
          criticalIssues.push(`${field}: ${missingPercentage.toFixed(1)}% of points missing this field`);
          recommendations.push(`Re-index content to ensure all points have ${field} metadata`);
        }
      }

      // Check for subject case variations
      if (Object.keys(caseVariations).length > 0) {
        criticalIssues.push(`Subject case variations detected: ${Object.keys(caseVariations).length} subjects have multiple cases`);
        recommendations.push('Canonicalize subject names to consistent casing');
      }

      // Check for unexpected subjects
      const foundSubjects = Array.from(allSubjects);
      const missingSubjects = this.EXPECTED_SUBJECTS.filter(s => !foundSubjects.includes(s));
      const unexpectedSubjects = foundSubjects.filter(s => !this.EXPECTED_SUBJECTS.includes(s));

      if (unexpectedSubjects.length > 0) {
        criticalIssues.push(`Unexpected subjects found: ${unexpectedSubjects.join(', ')}`);
        recommendations.push('Review and standardize subject naming conventions');
      }

      const report: MetadataDiagnosticReport = {
        totalPoints: points.length,
        metadataFields,
        subjectAnalysis: {
          expectedSubjects: this.EXPECTED_SUBJECTS,
          foundSubjects,
          missingSubjects,
          caseVariations
        },
        recommendations,
        criticalIssues
      };

      this.logDiagnosticReport(report);
      return report;

    } catch (error) {
      console.error('❌ Metadata diagnostic failed:', error);
      throw error;
    }
  }

  /**
   * Generate metadata repair plan
   */
  async generateRepairPlan(diagnosticReport: MetadataDiagnosticReport): Promise<MetadataRepairPlan> {
    console.log('🔧 Generating metadata repair plan...');

    const repairPlan: MetadataRepairPlan = {
      reindexRequired: false,
      metadataUpdates: [],
      canonicalizationRules: {}
    };

    // Check if reindexing is required
    const criticalMissingThreshold = 20; // 20% missing metadata requires reindex
    for (const field of this.REQUIRED_METADATA_FIELDS) {
      const fieldData = diagnosticReport.metadataFields[field];
      const missingPercentage = (fieldData.missing / diagnosticReport.totalPoints) * 100;
      
      if (missingPercentage > criticalMissingThreshold) {
        repairPlan.reindexRequired = true;
        console.log(`⚠️ Field ${field} missing in ${missingPercentage.toFixed(1)}% of points - reindex required`);
      }
    }

    // Generate canonicalization rules for subjects
    if (Object.keys(diagnosticReport.subjectAnalysis.caseVariations).length > 0) {
      repairPlan.canonicalizationRules.subject = {};
      
      for (const [normalized, variations] of Object.entries(diagnosticReport.subjectAnalysis.caseVariations)) {
        // Choose the most common capitalization or default to title case
        const canonical = this.chooseCanonicalForm(variations);
        
        for (const variation of variations) {
          if (variation !== canonical) {
            repairPlan.canonicalizationRules.subject[variation] = canonical;
          }
        }
      }
    }

    console.log('✅ Repair plan generated:', {
      reindexRequired: repairPlan.reindexRequired,
      canonicalizationRules: Object.keys(repairPlan.canonicalizationRules).length,
      metadataUpdates: repairPlan.metadataUpdates.length
    });

    return repairPlan;
  }

  /**
   * Execute metadata repairs
   */
  async executeRepairs(repairPlan: MetadataRepairPlan): Promise<void> {
    console.log('🔧 Executing metadata repairs...');

    if (repairPlan.reindexRequired) {
      console.log('⚠️ CRITICAL: Full reindexing required - this should be done during maintenance');
      console.log('   Run the content upload pipeline again with fixed metadata extraction');
      return;
    }

    // Apply canonicalization rules
    if (Object.keys(repairPlan.canonicalizationRules).length > 0) {
      await this.applyCanonicalizationRules(repairPlan.canonicalizationRules);
    }

    // Apply individual metadata updates
    if (repairPlan.metadataUpdates.length > 0) {
      await this.applyMetadataUpdates(repairPlan.metadataUpdates);
    }

    console.log('✅ Metadata repairs completed');
  }

  /**
   * Apply canonicalization rules to fix case variations
   */
  private async applyCanonicalizationRules(rules: { [field: string]: { [oldValue: string]: string } }): Promise<void> {
    console.log('🔧 Applying canonicalization rules...');

    for (const [field, fieldRules] of Object.entries(rules)) {
      for (const [oldValue, newValue] of Object.entries(fieldRules)) {
        try {
          // Update all points with the old value
          await this.qdrantClient.setPayload(this.collectionName, {
            payload: { [field]: newValue },
            filter: {
              must: [{ key: field, match: { value: oldValue } }]
            }
          });

          console.log(`✅ Updated ${field}: "${oldValue}" → "${newValue}"`);
        } catch (error) {
          console.error(`❌ Failed to update ${field}: "${oldValue}" → "${newValue}"`, error);
        }
      }
    }
  }

  /**
   * Apply individual metadata updates
   */
  private async applyMetadataUpdates(updates: Array<{ pointId: string; updates: { [key: string]: any } }>): Promise<void> {
    console.log(`🔧 Applying ${updates.length} individual metadata updates...`);

    for (const update of updates) {
      try {
        await this.qdrantClient.setPayload(this.collectionName, {
          payload: update.updates,
          points: [update.pointId]
        });
        console.log(`✅ Updated point ${update.pointId}`);
      } catch (error) {
        console.error(`❌ Failed to update point ${update.pointId}:`, error);
      }
    }
  }

  /**
   * Choose canonical form from variations
   */
  private chooseCanonicalForm(variations: string[]): string {
    // Prefer title case versions
    const titleCase = variations.find(v => v[0] === v[0].toUpperCase() && v.slice(1) === v.slice(1).toLowerCase());
    if (titleCase) return titleCase;

    // Prefer versions that match expected subjects
    const expected = variations.find(v => this.EXPECTED_SUBJECTS.includes(v));
    if (expected) return expected;

    // Default to first variation
    return variations[0];
  }

  /**
   * Log diagnostic report
   */
  private logDiagnosticReport(report: MetadataDiagnosticReport): void {
    console.log('\n📊 METADATA DIAGNOSTIC REPORT');
    console.log('=====================================');
    console.log(`Total Points Analyzed: ${report.totalPoints}`);
    
    console.log('\n📋 Metadata Field Analysis:');
    for (const [field, data] of Object.entries(report.metadataFields)) {
      const presentPercentage = (data.present / report.totalPoints * 100).toFixed(1);
      const missingPercentage = (data.missing / report.totalPoints * 100).toFixed(1);
      
      console.log(`  ${field}:`);
      console.log(`    Present: ${data.present} (${presentPercentage}%)`);
      console.log(`    Missing: ${data.missing} (${missingPercentage}%)`);
      console.log(`    Unique Values: ${data.uniqueValues.length}`);
      console.log(`    Sample Values: ${data.sampleValues.slice(0, 3).join(', ')}`);
    }

    console.log('\n📚 Subject Analysis:');
    console.log(`  Expected: ${report.subjectAnalysis.expectedSubjects.join(', ')}`);
    console.log(`  Found: ${report.subjectAnalysis.foundSubjects.join(', ')}`);
    console.log(`  Missing: ${report.subjectAnalysis.missingSubjects.join(', ')}`);
    
    if (Object.keys(report.subjectAnalysis.caseVariations).length > 0) {
      console.log('  Case Variations:');
      for (const [normalized, variations] of Object.entries(report.subjectAnalysis.caseVariations)) {
        console.log(`    ${normalized}: ${variations.join(', ')}`);
      }
    }

    if (report.criticalIssues.length > 0) {
      console.log('\n❌ Critical Issues:');
      report.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }

    console.log('=====================================\n');
  }

  /**
   * Test subject filtering with current metadata
   */
  async testSubjectFiltering(subject: string): Promise<{
    success: boolean;
    resultCount: number;
    sampleResults: any[];
    filterUsed: any;
  }> {
    console.log(`🧪 Testing subject filtering for: ${subject}`);

    try {
      const filter = {
        must: [{ key: 'subject', match: { value: subject } }]
      };

      const searchResult = await this.qdrantClient.scroll(this.collectionName, {
        filter,
        limit: 10,
        with_payload: true
      });

      const results = searchResult.points;
      console.log(`📊 Subject filter test: ${results.length} results for "${subject}"`);

      return {
        success: results.length > 0,
        resultCount: results.length,
        sampleResults: results.slice(0, 3).map(r => ({
          id: r.id,
          subject: r.payload?.subject,
          chapter: r.payload?.chapter,
          text: typeof r.payload?.text === 'string' ? r.payload.text.substring(0, 100) + '...' : 'No text'
        })),
        filterUsed: filter
      };
    } catch (error) {
      console.error(`❌ Subject filtering test failed for "${subject}":`, error);
      return {
        success: false,
        resultCount: 0,
        sampleResults: [],
        filterUsed: null
      };
    }
  }
}
