'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ProcessingMetrics {
  totalDocuments: number;
  docExtractEngineUsed: number;
  doclingUsed: number;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  complexDocuments: number;
  rolloutPercentage: number;
}

interface ProcessingDecision {
  timestamp: string;
  filename: string;
  processor: string;
  reason: string;
  processingTime: number;
  success: boolean;
  chunksCreated: number;
  complexity?: {
    complexityScore: number;
    hasFormulas: boolean;
    hasTables: boolean;
  };
}

export default function PDFExtractKitMonitoring() {
  const [metrics, setMetrics] = useState<ProcessingMetrics>({
    totalDocuments: 0,
    docExtractEngineUsed: 0,
    doclingUsed: 0,
    averageProcessingTime: 0,
    successRate: 0,
    errorRate: 0,
    complexDocuments: 0,
    rolloutPercentage: 25
  });

  const [recentDecisions, setRecentDecisions] = useState<ProcessingDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll simulate some data
      const simulatedMetrics: ProcessingMetrics = {
        totalDocuments: 156,
        docExtractEngineUsed: 39, // 25% rollout
        doclingUsed: 117,
        averageProcessingTime: 1850,
        successRate: 97.4,
        errorRate: 2.6,
        complexDocuments: 23,
        rolloutPercentage: 25
      };

      const simulatedDecisions: ProcessingDecision[] = [
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          filename: 'ncert_class10_math_ch1.pdf',
          processor: 'doc-extract-engine',
          reason: 'Complex document detected',
          processingTime: 1200,
          success: true,
          chunksCreated: 24,
          complexity: { complexityScore: 0.8, hasFormulas: true, hasTables: true }
        },
        {
          timestamp: new Date(Date.now() - 600000).toISOString(),
          filename: 'cbse_physics_notes.pdf',
          processor: 'doc-extract-engine',
          reason: 'Enabled for new uploads',
          processingTime: 2100,
          success: true,
          chunksCreated: 18,
          complexity: { complexityScore: 0.7, hasFormulas: true, hasTables: false }
        },
        {
          timestamp: new Date(Date.now() - 900000).toISOString(),
          filename: 'english_literature.pdf',
          processor: 'docling',
          reason: 'Subject English not in enabled list',
          processingTime: 1500,
          success: true,
          chunksCreated: 15
        },
        {
          timestamp: new Date(Date.now() - 1200000).toISOString(),
          filename: 'chemistry_practical.pdf',
          processor: 'pdf-extract-kit',
          reason: 'Enabled for new uploads',
          processingTime: 1800,
          success: true,
          chunksCreated: 21,
          complexity: { complexityScore: 0.6, hasFormulas: false, hasTables: true }
        }
      ];

      setMetrics(simulatedMetrics);
      setRecentDecisions(simulatedDecisions);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      setIsLoading(false);
    }
  };

  const getProcessorBadge = (processor: string) => {
    switch (processor) {
      case 'doc-extract-engine':
        return <Badge className="bg-green-100 text-green-800">doc-extract-engine</Badge>;
      case 'docling':
        return <Badge className="bg-blue-100 text-blue-800">Docling</Badge>;
      default:
        return <Badge variant="secondary">{processor}</Badge>;
    }
  };

  const getSuccessBadge = (success: boolean) => {
    return success ? 
      <Badge className="bg-green-100 text-green-800">Success</Badge> :
      <Badge className="bg-red-100 text-red-800">Failed</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">doc-extract-engine Monitoring</h2>
        <Button onClick={loadMetrics} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDocuments}</div>
            <p className="text-xs text-gray-600">Processed this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">doc-extract-engine Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.docExtractEngineUsed}</div>
            <p className="text-xs text-gray-600">
              {((metrics.docExtractEngineUsed / metrics.totalDocuments) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate}%</div>
            <p className="text-xs text-gray-600">Overall processing success</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageProcessingTime}ms</div>
            <p className="text-xs text-gray-600">Per document</p>
          </CardContent>
        </Card>
      </div>

      {/* Rollout Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Rollout Progress</CardTitle>
          <CardDescription>
            Current rollout percentage and processor distribution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Rollout Percentage</span>
              <span>{metrics.rolloutPercentage}%</span>
            </div>
            <Progress value={metrics.rolloutPercentage} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{metrics.pdfExtractKitUsed}</div>
              <div className="text-sm text-green-600">PDF Extract Kit</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{metrics.doclingUsed}</div>
              <div className="text-sm text-blue-600">Docling</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Processing Decisions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Processing Decisions</CardTitle>
          <CardDescription>
            Latest document processing decisions and their outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentDecisions.map((decision, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{decision.filename}</div>
                  <div className="flex items-center space-x-2">
                    {getProcessorBadge(decision.processor)}
                    {getSuccessBadge(decision.success)}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  <div>Reason: {decision.reason}</div>
                  <div>Processing Time: {decision.processingTime}ms</div>
                  <div>Chunks Created: {decision.chunksCreated}</div>
                  {decision.complexity && (
                    <div>
                      Complexity Score: {decision.complexity.complexityScore.toFixed(2)}
                      {decision.complexity.hasFormulas && ' • Has Formulas'}
                      {decision.complexity.hasTables && ' • Has Tables'}
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-gray-500">
                  {new Date(decision.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
