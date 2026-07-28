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
 * UI agent id  ──▶  retrieval profile key.
 *
 * The ids rendered by the UI (TUTOR_AGENTS in
 * src/components/ai/tutor/AgentSelector.tsx, and MenuIntent in
 * src/lib/ai/menu/menu-router.ts) do NOT all match the keys of
 * AGENT_RETRIEVAL_PROFILES above. Three of the six diverge:
 *
 *   UI id              profile key       previously resolved to
 *   ─────────────────  ────────────────  ──────────────────────
 *   selfstudy_buddy →  homework_help     explain_topic (silent fallback)
 *   clear_doubts    →  doubt_clearing    explain_topic (silent fallback)
 *   book_structure  →  lets_talk         explain_topic (silent fallback)
 *   explain_topic   →  explain_topic     correct
 *   exam_prep       →  exam_prep         correct
 *   study_tips      →  study_tips        correct
 *
 * So "Let's Talk" would have used the Deep Dive retrieval strategy (topK 8,
 * reranking on, section-level chunks) rather than its own conversational one
 * (topK 6, minScore 0.6, reranking off, paragraph-level) — and nothing would
 * have surfaced the mismatch beyond a console warning.
 */
const UI_AGENT_ID_TO_PROFILE_KEY: Record<string, keyof typeof AGENT_RETRIEVAL_PROFILES> = {
  selfstudy_buddy: 'homework_help',
  explain_topic: 'explain_topic',
  exam_prep: 'exam_prep',
  clear_doubts: 'doubt_clearing',
  study_tips: 'study_tips',
  book_structure: 'lets_talk',
  // Profile keys are accepted verbatim too, so callers already passing a
  // canonical key keep working.
  homework_help: 'homework_help',
  doubt_clearing: 'doubt_clearing',
  lets_talk: 'lets_talk',
};

/**
 * Resolve a UI agent id or profile key to its retrieval profile.
 *
 * Throws on an unmatched key rather than silently substituting explain_topic:
 * a wrong-but-plausible retrieval strategy is far harder to notice in
 * production than a loud failure, and the silent path is exactly how the three
 * mismatches above went unnoticed.
 */
export function getAgentRetrievalProfile(agentType: string): AgentRetrievalProfile {
  const profileKey = UI_AGENT_ID_TO_PROFILE_KEY[agentType];

  if (!profileKey) {
    throw new Error(
      `No retrieval profile mapping for agent id "${agentType}". ` +
      `Add it to UI_AGENT_ID_TO_PROFILE_KEY in agent-retrieval-profiles.ts. ` +
      `Known ids: ${Object.keys(UI_AGENT_ID_TO_PROFILE_KEY).join(', ')}.`
    );
  }

  const profile = AGENT_RETRIEVAL_PROFILES[profileKey];

  if (!profile) {
    throw new Error(
      `Agent id "${agentType}" maps to profile key "${profileKey}", which is not ` +
      `defined in AGENT_RETRIEVAL_PROFILES.`
    );
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

