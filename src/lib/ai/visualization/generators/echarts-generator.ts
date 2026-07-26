import { logger } from '@/lib/logger';

/**
 * ECharts Generator for DigiClassroom Pro
 * Generates statistical charts (bar, pie, line) using LLM and ECharts
 * Maintains NCERT fidelity - no data hallucination
 */

import { OpenAIService } from '@/lib/services/openai_service';

export interface EChartsGeneratorRequest {
  query: string;
  answer: string;
  chunks: Array<{ text: string }>;
  metadata: {
    subject: string;
    class: string;
    chapter?: string;
  };
}

export interface EChartsConfig {
  title?: {
    text: string;
    subtext?: string;
    left?: string;
    textStyle?: any;
  };
  tooltip?: any;
  legend?: any;
  xAxis?: any;
  yAxis?: any;
  series?: any[];
  grid?: any;
  [key: string]: any;
}

export class EChartsGenerator {
  private openai: OpenAIService;

  constructor() {
    this.openai = OpenAIService.getInstance();
  }

  /**
   * Generate bar chart configuration
   */
  async generateBarChart(request: EChartsGeneratorRequest): Promise<EChartsConfig> {
    const ncertContent = request.chunks.slice(0, 3).map(c => c.text).join('\n\n');

    const prompt = `You are an expert at generating Apache ECharts configurations for educational data visualization.

TASK: Create an ECharts bar chart configuration from NCERT textbook content.

CRITICAL RULES:
1. Extract ONLY numerical data explicitly stated in the NCERT content below
2. Do NOT hallucinate or make up any data
3. Output ONLY valid JSON (no markdown blocks, no explanations)
4. Maximum 8 data points for clarity
5. Include clear axis labels and title
6. Add source citation in subtitle (NCERT Class ${request.metadata.class} ${request.metadata.subject}${request.metadata.chapter ? ', Chapter ' + request.metadata.chapter : ''})
7. Use educational color scheme: #60a5fa (blue)

VALID ECHARTS CONFIG EXAMPLE:
{
  "title": {
    "text": "Agricultural Production by State",
    "subtext": "Source: NCERT Class 10 Economics, Chapter 3",
    "left": "center",
    "textStyle": { "fontSize": 18, "fontWeight": "bold" }
  },
  "tooltip": { "trigger": "axis", "axisPointer": { "type": "shadow" } },
  "grid": { "left": "3%", "right": "4%", "bottom": "3%", "containLabel": true },
  "xAxis": {
    "type": "category",
    "data": ["State A", "State B", "State C", "State D"],
    "axisLabel": { "fontSize": 12 }
  },
  "yAxis": {
    "type": "value",
    "name": "Production (Million Tonnes)",
    "nameTextStyle": { "fontSize": 12 }
  },
  "series": [{
    "name": "Production",
    "type": "bar",
    "data": [45, 52, 38, 61],
    "itemStyle": { "color": "#60a5fa", "borderRadius": [4, 4, 0, 0] },
    "label": { "show": true, "position": "top", "fontSize": 10 }
  }]
}

NCERT CONTENT:
${ncertContent}

ANSWER:
${request.answer}

QUERY: ${request.query}

JSON OUTPUT ONLY (no markdown, no explanation):`;

    try {
      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for consistency
        maxTokens: 800
      });

      // Parse JSON response
      let jsonStr = response.text.trim();
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();
      
      const config = JSON.parse(jsonStr);

      // Validate required fields
      if (!config.xAxis?.data || !config.series?.[0]?.data) {
        throw new Error('Invalid ECharts config: missing required fields');
      }

      return config;

    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, '❌ [ECharts] Bar chart generation failed:');
      throw error;
    }
  }

  /**
   * Generate pie chart configuration
   */
  async generatePieChart(request: EChartsGeneratorRequest): Promise<EChartsConfig> {
    const ncertContent = request.chunks.slice(0, 3).map(c => c.text).join('\n\n');

    const prompt = `You are an expert at generating Apache ECharts configurations for educational data visualization.

TASK: Create an ECharts pie chart configuration from NCERT textbook content.

CRITICAL RULES:
1. Extract ONLY numerical data explicitly stated in the NCERT content below
2. Do NOT hallucinate or make up any data
3. Output ONLY valid JSON (no markdown blocks, no explanations)
4. Maximum 6 segments for clarity
5. Include clear labels and title
6. Add source citation in subtitle (NCERT Class ${request.metadata.class} ${request.metadata.subject}${request.metadata.chapter ? ', Chapter ' + request.metadata.chapter : ''})
7. Use educational color palette

VALID ECHARTS CONFIG EXAMPLE:
{
  "title": {
    "text": "Land Use Distribution",
    "subtext": "Source: NCERT Class 10 Geography",
    "left": "center",
    "textStyle": { "fontSize": 18, "fontWeight": "bold" }
  },
  "tooltip": { "trigger": "item", "formatter": "{b}: {c}% ({d}%)" },
  "legend": { "orient": "vertical", "left": "left" },
  "series": [{
    "name": "Land Use",
    "type": "pie",
    "radius": "60%",
    "data": [
      { "value": 43, "name": "Forest", "itemStyle": { "color": "#4ade80" } },
      { "value": 24, "name": "Agriculture", "itemStyle": { "color": "#fbbf24" } },
      { "value": 18, "name": "Pasture", "itemStyle": { "color": "#60a5fa" } },
      { "value": 15, "name": "Other", "itemStyle": { "color": "#a78bfa" } }
    ],
    "emphasis": { "itemStyle": { "shadowBlur": 10, "shadowOffsetX": 0, "shadowColor": "rgba(0, 0, 0, 0.5)" } },
    "label": { "fontSize": 12 }
  }]
}

NCERT CONTENT:
${ncertContent}

ANSWER:
${request.answer}

QUERY: ${request.query}

JSON OUTPUT ONLY (no markdown, no explanation):`;

    try {
      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 800
      });

      const jsonStr = response.text.trim()
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();
      
      const config = JSON.parse(jsonStr);

      if (!config.series?.[0]?.data) {
        throw new Error('Invalid ECharts config: missing pie data');
      }

      return config;

    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, '❌ [ECharts] Pie chart generation failed:');
      throw error;
    }
  }

  /**
   * Generate line chart configuration
   */
  async generateLineChart(request: EChartsGeneratorRequest): Promise<EChartsConfig> {
    const ncertContent = request.chunks.slice(0, 3).map(c => c.text).join('\n\n');

    const prompt = `You are an expert at generating Apache ECharts configurations for educational data visualization.

TASK: Create an ECharts line chart configuration from NCERT textbook content.

CRITICAL RULES:
1. Extract ONLY numerical data explicitly stated in the NCERT content below
2. Do NOT hallucinate or make up any data
3. Output ONLY valid JSON (no markdown blocks, no explanations)
4. Maximum 10 data points for clarity
5. Include clear axis labels and title
6. Add source citation in subtitle (NCERT Class ${request.metadata.class} ${request.metadata.subject}${request.metadata.chapter ? ', Chapter ' + request.metadata.chapter : ''})
7. Use educational color scheme: #60a5fa (blue)

VALID ECHARTS CONFIG EXAMPLE:
{
  "title": {
    "text": "Population Growth Over Time",
    "subtext": "Source: NCERT Class 12 Geography",
    "left": "center",
    "textStyle": { "fontSize": 18, "fontWeight": "bold" }
  },
  "tooltip": { "trigger": "axis" },
  "grid": { "left": "3%", "right": "4%", "bottom": "3%", "containLabel": true },
  "xAxis": {
    "type": "category",
    "data": ["1951", "1961", "1971", "1981", "1991", "2001", "2011"],
    "boundaryGap": false,
    "axisLabel": { "fontSize": 12 }
  },
  "yAxis": {
    "type": "value",
    "name": "Population (millions)",
    "nameTextStyle": { "fontSize": 12 }
  },
  "series": [{
    "name": "Population",
    "type": "line",
    "data": [361, 439, 548, 683, 846, 1028, 1210],
    "smooth": true,
    "itemStyle": { "color": "#60a5fa" },
    "areaStyle": { "color": "rgba(96, 165, 250, 0.2)" },
    "label": { "show": false }
  }]
}

NCERT CONTENT:
${ncertContent}

ANSWER:
${request.answer}

QUERY: ${request.query}

JSON OUTPUT ONLY (no markdown, no explanation):`;

    try {
      const response = await this.openai.generateChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 800
      });

      const jsonStr = response.text.trim()
        .replace(/^```json\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();
      
      const config = JSON.parse(jsonStr);

      if (!config.xAxis?.data || !config.series?.[0]?.data) {
        throw new Error('Invalid ECharts config: missing required fields');
      }

      return config;

    } catch (error) {
        // @ts-ignore
      logger.error({ error: error }, '❌ [ECharts] Line chart generation failed:');
      throw error;
    }
  }
}

