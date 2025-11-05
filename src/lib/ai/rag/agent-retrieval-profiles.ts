/**
 * Agent-Aware Retrieval Profiles
 * Defines retrieval strategies optimized for each of the 6 agents
 * 
 * Agents:
 * 1. Homework Help Agent (Socratic Tutoring)
 * 2. Topic Explanation Agent (Comprehensive Explanations)
 * 3. Exam Preparation Agent (Strategic Study Planning)
 * 4. Doubt Clearing Agent (Direct Answers)
 * 5. Study Tips Agent (Study Coaching)
 * 6. Let's Talk Agent (Casual Conversation)
 */

import { QdrantSearchOptions } from './qdrant-search';

export interface AgentRetrievalProfile {
  agentName: string;
  description: string;
  retrievalStrategy: {
    // Chunk level preferences
    preferredChunkLevels: ('atomic' | 'paragraph' | 'section')[];
    chunkLevelWeights: { atomic: number; paragraph: number; section: number };
    
    // Search parameters
    topK: number;
    minScore: number;
    enableHybridSearch: boolean;
    
    // Context expansion
    includeNeighbors: boolean;
    neighborRadius: number; // How many siblings to include
    includeParent: boolean;
    includeChildren: boolean;
    
    // Content type preferences
    contentTypePreferences?: {
      text: number;
      equation: number;
      table: number;
      figure: number;
    };
    
    // Re-ranking
    enableReranking: boolean;
    rerankingCriteria: string[];
  };
  
  // Additional search options
  searchOptions: Partial<QdrantSearchOptions>;
}

/**
 * Retrieval profiles for all 6 agents
 */
export const AGENT_RETRIEVAL_PROFILES: Record<string, AgentRetrievalProfile> = {
  // 1. Homework Help Agent (Socratic Tutoring)
  homework_help: {
    agentName: 'Homework Help Agent',
    description: 'Socratic tutoring with step-by-step guidance',
    retrievalStrategy: {
      // Prefer paragraph-level for balanced context
      preferredChunkLevels: ['paragraph', 'atomic', 'section'],
      chunkLevelWeights: { atomic: 0.2, paragraph: 0.6, section: 0.2 },
      
      topK: 7,
      minScore: 0.7,
      enableHybridSearch: true,
      
      // Include neighbors for progressive hints
      includeNeighbors: true,
      neighborRadius: 2,
      includeParent: true,
      includeChildren: true,
      
      contentTypePreferences: {
        text: 1.0,
        equation: 0.8,
        table: 0.6,
        figure: 0.7
      },
      
      enableReranking: true,
      rerankingCriteria: [
        'conceptual_clarity',
        'step_by_step_suitability',
        'example_richness'
      ]
    },
    searchOptions: {
      enableHybridSearch: true,
      topK: 7
    }
  },

  // 2. Topic Explanation Agent (Comprehensive Explanations)
  explain_topic: {
    agentName: 'Topic Explanation Agent',
    description: 'Comprehensive topic explanations with examples',
    retrievalStrategy: {
      // Prefer section-level for comprehensive coverage
      preferredChunkLevels: ['section', 'paragraph', 'atomic'],
      chunkLevelWeights: { atomic: 0.1, paragraph: 0.3, section: 0.6 },
      
      topK: 10,
      minScore: 0.65,
      enableHybridSearch: true,
      
      // Include full context hierarchy
      includeNeighbors: true,
      neighborRadius: 3,
      includeParent: true,
      includeChildren: true,
      
      contentTypePreferences: {
        text: 1.0,
        equation: 0.9,
        table: 0.8,
        figure: 0.9
      },
      
      enableReranking: true,
      rerankingCriteria: [
        'comprehensiveness',
        'example_quality',
        'visual_content',
        'definition_clarity'
      ]
    },
    searchOptions: {
      enableHybridSearch: true,
      topK: 10
    }
  },

  // 3. Exam Preparation Agent (Strategic Study Planning)
  exam_prep: {
    agentName: 'Exam Preparation Agent',
    description: 'Strategic study planning and exam strategies',
    retrievalStrategy: {
      // Prefer section-level for topic overview
      preferredChunkLevels: ['section', 'paragraph', 'atomic'],
      chunkLevelWeights: { atomic: 0.15, paragraph: 0.35, section: 0.5 },
      
      topK: 15,
      minScore: 0.6,
      enableHybridSearch: true,
      
      // Include broad context for planning
      includeNeighbors: true,
      neighborRadius: 4,
      includeParent: true,
      includeChildren: false, // Don't need atomic details
      
      contentTypePreferences: {
        text: 1.0,
        equation: 0.7,
        table: 0.9, // Tables often contain important summaries
        figure: 0.6
      },
      
      enableReranking: true,
      rerankingCriteria: [
        'topic_coverage',
        'importance_indicators',
        'exam_relevance'
      ]
    },
    searchOptions: {
      enableHybridSearch: true,
      topK: 15
    }
  },

  // 4. Doubt Clearing Agent (Direct Answers)
  doubt_clearing: {
    agentName: 'Doubt Clearing Agent',
    description: 'Direct, precise answers to specific doubts',
    retrievalStrategy: {
      // Prefer atomic-level for precise facts
      preferredChunkLevels: ['atomic', 'paragraph', 'section'],
      chunkLevelWeights: { atomic: 0.5, paragraph: 0.4, section: 0.1 },
      
      topK: 5,
      minScore: 0.75,
      enableHybridSearch: true,
      
      // Minimal context expansion for precision
      includeNeighbors: true,
      neighborRadius: 1,
      includeParent: true,
      includeChildren: false,
      
      contentTypePreferences: {
        text: 1.0,
        equation: 1.0, // Equations are critical for doubts
        table: 0.8,
        figure: 0.7
      },
      
      enableReranking: true,
      rerankingCriteria: [
        'precision',
        'directness',
        'citation_quality'
      ]
    },
    searchOptions: {
      enableHybridSearch: true,
      topK: 5
    }
  },

  // 5. Study Tips Agent (Study Coaching)
  study_tips: {
    agentName: 'Study Tips Agent',
    description: 'Study coaching and learning strategies',
    retrievalStrategy: {
      // Prefer paragraph-level for balanced advice
      preferredChunkLevels: ['paragraph', 'section', 'atomic'],
      chunkLevelWeights: { atomic: 0.2, paragraph: 0.5, section: 0.3 },
      
      topK: 8,
      minScore: 0.65,
      enableHybridSearch: true,
      
      // Moderate context expansion
      includeNeighbors: true,
      neighborRadius: 2,
      includeParent: true,
      includeChildren: false,
      
      contentTypePreferences: {
        text: 1.0,
        equation: 0.6,
        table: 0.7,
        figure: 0.6
      },
      
      enableReranking: true,
      rerankingCriteria: [
        'study_relevance',
        'practical_applicability',
        'memory_aid_potential'
      ]
    },
    searchOptions: {
      enableHybridSearch: true,
      topK: 8
    }
  },

  // 6. Let's Talk Agent (Casual Conversation)
  lets_talk: {
    agentName: "Let's Talk Agent",
    description: 'Casual, friendly conversation about topics',
    retrievalStrategy: {
      // Prefer paragraph-level for conversational context
      preferredChunkLevels: ['paragraph', 'atomic', 'section'],
      chunkLevelWeights: { atomic: 0.3, paragraph: 0.5, section: 0.2 },
      
      topK: 6,
      minScore: 0.6,
      enableHybridSearch: true,
      
      // Moderate context for natural conversation
      includeNeighbors: true,
      neighborRadius: 2,
      includeParent: false,
      includeChildren: false,
      
      contentTypePreferences: {
        text: 1.0,
        equation: 0.5,
        table: 0.5,
        figure: 0.8 // Visual content makes conversation interesting
      },
      
      enableReranking: false, // Less critical for casual conversation
      rerankingCriteria: []
    },
    searchOptions: {
      enableHybridSearch: true,
      topK: 6
    }
  }
};

/**
 * Get retrieval profile for an agent
 */
export function getAgentRetrievalProfile(agentType: string): AgentRetrievalProfile {
  const profile = AGENT_RETRIEVAL_PROFILES[agentType];
  
  if (!profile) {
    console.warn(`⚠️ No retrieval profile found for agent: ${agentType}, using default (explain_topic)`);
    return AGENT_RETRIEVAL_PROFILES.explain_topic;
  }
  
  return profile;
}

/**
 * Get search options for an agent
 */
export function getAgentSearchOptions(
  agentType: string,
  baseOptions: Partial<QdrantSearchOptions> = {}
): QdrantSearchOptions {
  const profile = getAgentRetrievalProfile(agentType);
  
  return {
    ...baseOptions,
    ...profile.searchOptions,
    topK: profile.retrievalStrategy.topK
  };
}

