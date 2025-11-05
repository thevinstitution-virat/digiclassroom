'use client'

/**
 * DigiClassroom Pro - Feedback Widget Test Page
 * Demonstrates the FeedbackWidget component with sample data
 */

import React from 'react';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, Zap } from 'lucide-react';

export default function FeedbackTestPage() {
  // Sample question and answer data
  const sampleData = {
    questionText: 'Explain the process of photosynthesis in plants and its importance in the ecosystem.',
    answerText: `Photosynthesis is a fundamental biological process by which green plants, algae, and some bacteria convert light energy (usually from the sun) into chemical energy stored in glucose molecules.

**The Process:**

1. **Light-Dependent Reactions** (occur in thylakoid membranes):
   - Chlorophyll absorbs light energy
   - Water molecules are split (photolysis), releasing oxygen as a byproduct
   - ATP and NADPH are produced

2. **Light-Independent Reactions** (Calvin Cycle, occur in stroma):
   - Carbon dioxide is fixed using ATP and NADPH
   - Glucose is synthesized through a series of enzymatic reactions

**Chemical Equation:**
6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂

**Importance in the Ecosystem:**

1. **Primary Production**: Photosynthesis is the foundation of most food chains, converting solar energy into chemical energy that supports all life forms.

2. **Oxygen Production**: It releases oxygen into the atmosphere, which is essential for aerobic respiration in most organisms.

3. **Carbon Dioxide Regulation**: Plants absorb CO₂ from the atmosphere, helping to regulate atmospheric carbon levels and mitigate climate change.

4. **Energy Storage**: The glucose produced serves as an energy source for the plant and organisms that consume it.

5. **Habitat Creation**: Photosynthetic organisms create habitats and provide resources for countless other species.

**Key Factors Affecting Photosynthesis:**
- Light intensity
- Carbon dioxide concentration
- Temperature
- Water availability
- Chlorophyll content

Understanding photosynthesis is crucial for comprehending energy flow in ecosystems and the interconnectedness of all living organisms.`,
    board: 'CBSE' as const,
    classLevel: 10,
    subject: 'Biology',
    commandWord: 'Explain',
    marksAllocated: 5,
    
    // Performance metrics
    responseTimeMs: 3200,
    cacheHit: true,
    cacheType: 'semantic' as const,
    faithfulnessScore: 0.95,
    relevanceScore: 0.92,
    contextPrecisionScore: 0.88,
    contextRecallScore: 0.90,
    
    // Routing info
    routeType: 'detailed_explanation',
    complexity: 'medium',
    intentType: 'conceptual_understanding',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Feedback Widget Test Page
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the feedback collection system with a sample AI-generated answer
          </p>
        </div>

        {/* Question Card */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {sampleData.board}
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Class {sampleData.classLevel}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {sampleData.subject}
                  </Badge>
                </div>
                <CardTitle className="text-xl text-gray-900 dark:text-gray-100">
                  {sampleData.questionText}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {sampleData.marksAllocated} marks
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Answer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              AI-Generated Answer
            </CardTitle>
            <CardDescription>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  <span>{sampleData.responseTimeMs}ms</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Zap className="w-3 h-3 text-green-500" />
                  <span>Cached ({sampleData.cacheType})</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span>Faithfulness: {(sampleData.faithfulnessScore * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span>Relevance: {(sampleData.relevanceScore * 100).toFixed(0)}%</span>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {sampleData.answerText}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Widget */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            📝 Rate This Answer
          </h2>
          <FeedbackWidget
            questionText={sampleData.questionText}
            answerText={sampleData.answerText}
            board={sampleData.board}
            classLevel={sampleData.classLevel}
            subject={sampleData.subject}
            commandWord={sampleData.commandWord}
            marksAllocated={sampleData.marksAllocated}
            responseTimeMs={sampleData.responseTimeMs}
            cacheHit={sampleData.cacheHit}
            cacheType={sampleData.cacheType}
            faithfulnessScore={sampleData.faithfulnessScore}
            relevanceScore={sampleData.relevanceScore}
            contextPrecisionScore={sampleData.contextPrecisionScore}
            contextRecallScore={sampleData.contextRecallScore}
            routeType={sampleData.routeType}
            complexity={sampleData.complexity}
            intentType={sampleData.intentType}
          />
        </div>

        {/* Instructions */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-base text-blue-900 dark:text-blue-100">
              💡 Testing Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p>1. <strong>Quick Feedback:</strong> Click thumbs up/down or select a star rating</p>
            <p>2. <strong>Detailed Feedback:</strong> Click "Add detailed feedback" to expand the form</p>
            <p>3. <strong>Category Selection:</strong> Choose what could be improved (optional)</p>
            <p>4. <strong>Written Feedback:</strong> Add comments up to 1000 characters (optional)</p>
            <p>5. <strong>Submit:</strong> Click "Submit Feedback" to send your response</p>
            <p>6. <strong>Quality Alerts:</strong> Low ratings or scores will automatically create quality alerts</p>
            <p className="pt-2 border-t border-blue-200 dark:border-blue-700">
              <strong>Note:</strong> You must be logged in to submit feedback. The feedback will be stored in the database and can be viewed in the stats dashboard.
            </p>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Performance Metrics (Passed to Widget)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500 dark:text-gray-400">Response Time</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{sampleData.responseTimeMs}ms</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Cache Hit</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{sampleData.cacheHit ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Cache Type</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{sampleData.cacheType}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Faithfulness</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{(sampleData.faithfulnessScore * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Relevance</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{(sampleData.relevanceScore * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Context Precision</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{(sampleData.contextPrecisionScore * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Context Recall</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{(sampleData.contextRecallScore * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Complexity</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{sampleData.complexity}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

