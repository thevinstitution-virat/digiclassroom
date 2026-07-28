'use client';

/**
 * Visualization Renderer Component
 * Renders educational visualizations (tables, flowcharts, concept maps, timelines, charts, etc.)
 * Supports Markdown, Mermaid.js, and ECharts formats
 */

import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

// Lazy load ECharts component for zero initial bundle impact
const EChartsVisualization = lazy(() => import('./visualizations/EChartsVisualization'));

interface Visualization {
  type: 'comparison_table' | 'concept_map' | 'flowchart' | 'timeline' | 'hierarchical_tree' | 'text_flowchart' | 'bar_chart' | 'pie_chart' | 'line_chart';
  format: 'markdown' | 'mermaid' | 'echarts';
  priority: 1 | 2 | 3;
  content: string | any; // string for markdown/mermaid, object for echarts
  caption: string;
  educationalValue: string;
}

interface VisualizationRendererProps {
  visualizations: Visualization[];
}

// Initialize Mermaid
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 14,
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis'
    },
    themeVariables: {
      primaryColor: '#e1f5ff',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#0066cc',
      lineColor: '#64748b',
      secondaryColor: '#fff4e1',
      tertiaryColor: '#f0fdf4'
    }
  });
}

export default function VisualizationRenderer({ visualizations }: VisualizationRendererProps) {
  if (!visualizations || visualizations.length === 0) {
    return null;
  }

  // Debug logging
  console.log('📊 [VisualizationRenderer] Received visualizations:', visualizations.length);
  visualizations.forEach((viz, idx) => {
    console.log(`  ${idx + 1}. Type: ${viz.type}, Format: ${viz.format}, Content length: ${typeof viz.content === 'string' ? viz.content.length : 'object'}`);
    if (viz.format === 'mermaid') {
      console.log(`     Mermaid content preview:`, (viz.content as string)?.substring(0, 100));
    }
  });

  // Sort by priority
  const sortedVisualizations = [...visualizations].sort((a, b) => a.priority - b.priority);

  return (
    <div className="mt-6 space-y-6">
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Visual Learning Aids
        </h3>
        
        <div className="space-y-6">
          {sortedVisualizations.map((viz, index) => (
            <VisualizationCard key={index} visualization={viz} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface VisualizationCardProps {
  visualization: Visualization;
  index: number;
}

function VisualizationCard({ visualization, index }: VisualizationCardProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0); // First one expanded by default

  const getIcon = () => {
    switch (visualization.type) {
      case 'comparison_table':
        return '📊';
      case 'concept_map':
        return '🗺️';
      case 'flowchart':
      case 'text_flowchart':
        return '🔄';
      case 'timeline':
        return '📅';
      case 'hierarchical_tree':
        return '🌳';
      case 'bar_chart':
        return '📊';
      case 'pie_chart':
        return '🥧';
      case 'line_chart':
        return '📈';
      default:
        return '📈';
    }
  };

  const getTypeLabel = () => {
    switch (visualization.type) {
      case 'comparison_table':
        return 'Comparison Table';
      case 'concept_map':
        return 'Concept Map';
      case 'flowchart':
        return 'Flowchart';
      case 'text_flowchart':
        return 'Process Flow';
      case 'timeline':
        return 'Timeline';
      case 'hierarchical_tree':
        return 'Classification Tree';
      case 'bar_chart':
        return 'Bar Chart';
      case 'pie_chart':
        return 'Pie Chart';
      case 'line_chart':
        return 'Line Chart';
      default:
        return 'Visualization';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getIcon()}</span>
          <div className="text-left">
            <h4 className="font-semibold text-gray-900">{getTypeLabel()}</h4>
            <p className="text-xs text-gray-600 mt-0.5">{visualization.educationalValue}</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Debug logging for rendering decision */}
          {console.log(`[VisualizationRenderer] Rendering ${visualization.type} with format ${visualization.format}`)}

          {/* Render based on format, with explicit handling for text_flowchart */}
          {visualization.format === 'markdown' || visualization.type === 'text_flowchart' ? (
            <MarkdownVisualization content={visualization.content as string} />
          ) : visualization.format === 'echarts' ? (
            <Suspense fallback={
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded">
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">Loading chart...</span>
                </div>
              </div>
            }>
              <EChartsVisualization config={visualization.content} caption={visualization.caption} />
            </Suspense>
          ) : visualization.format === 'mermaid' ? (
            <MermaidVisualization content={visualization.content as string} id={`mermaid-${index}`} />
          ) : (
            /* Fallback: try to render as markdown */
            <MarkdownVisualization content={visualization.content as string} />
          )}

          {visualization.caption && visualization.format !== 'echarts' && (
            <p className="text-xs text-gray-500 italic mt-3 text-center">
              {visualization.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface MarkdownVisualizationProps {
  content: string;
}

function MarkdownVisualization({ content }: MarkdownVisualizationProps) {
  return (
    <div className="prose prose-sm max-w-none prose-table:border-collapse prose-table:w-full prose-th:bg-blue-50 prose-th:border prose-th:border-gray-300 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-gray-900 prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2 prose-td:text-gray-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300 shadow-sm rounded-lg" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 text-sm" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-gray-300 px-4 py-2 text-gray-700 text-sm" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-gray-50 transition-colors" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface MermaidVisualizationProps {
  content: string;
  id: string;
}

function MermaidVisualization({ content, id }: MermaidVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        setIsRendering(true);
        setError(null);

        // Clear previous content
        containerRef.current.innerHTML = '';

        // Debug logging
        console.log('🎨 [Mermaid] Rendering diagram:', id);
        console.log('📝 [Mermaid] Content length:', content?.length || 0);
        console.log('📄 [Mermaid] Content preview:', content?.substring(0, 100));

        // Validate Mermaid syntax
        if (!content || !content.trim()) {
          console.error('❌ [Mermaid] Empty content received');
          throw new Error('Empty diagram content');
        }

        // Render the diagram
        console.log('🔄 [Mermaid] Calling mermaid.render...');
        const { svg } = await mermaid.render(id, content);
        console.log('✅ [Mermaid] Render successful, SVG length:', svg?.length || 0);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          console.log('✅ [Mermaid] SVG inserted into DOM');
        }

        setIsRendering(false);
      } catch (err) {
        console.error('❌ [Mermaid] Rendering error:', err);
        console.error('❌ [Mermaid] Failed content:', content);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [content, id]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">
          <strong>Diagram Error:</strong> {error}
        </p>
        <details className="mt-2">
          <summary className="text-xs text-red-600 cursor-pointer">Show diagram code</summary>
          <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
            {content}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="relative">
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded">
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Rendering diagram...</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-container flex justify-center items-center overflow-x-auto"
        style={{ minHeight: isRendering ? '200px' : 'auto' }}
      />
    </div>
  );
}

