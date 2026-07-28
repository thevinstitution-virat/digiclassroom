'use client';

/**
 * ECharts Visualization Component for DigiClassroom Pro
 * Renders statistical charts (bar, pie, line) with responsive design
 * Implements tree-shaking and lazy loading for optimal bundle size
 */

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register only needed components (tree-shaking)
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer
]);

interface EChartsVisualizationProps {
  config: any; // ECharts configuration object
  caption?: string;
  height?: string;
  onChartReady?: (chart: echarts.ECharts) => void;
}

export default function EChartsVisualization({
  config,
  caption,
  height = '400px',
  onChartReady
}: EChartsVisualizationProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    try {
      chartInstance.current = echarts.init(chartRef.current);
      chartInstance.current.setOption(config);

      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (error) {
      console.error('❌ [ECharts] Failed to initialize chart:', error);
    }

    // Cleanup
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  // Update on config change
  useEffect(() => {
    if (!chartInstance.current) return;
    
    try {
      chartInstance.current.setOption(config);
    } catch (error) {
      console.error('❌ [ECharts] Failed to update chart:', error);
    }
  }, [config]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(handleResize);
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="w-full">
      <div
        ref={chartRef}
        className="w-full rounded-lg shadow-sm"
        style={{ height }}
      />
      {caption && (
        <p className="text-xs text-gray-500 italic mt-2 text-center">
          {caption}
        </p>
      )}
    </div>
  );
}

