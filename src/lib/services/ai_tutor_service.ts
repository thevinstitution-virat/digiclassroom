/**
 * AI Tutor Service - Main Orchestrator
 * Coordinates all specialized agents and provides unified interface
 */

import { AgentManager, AgentResponse, StudentContext, ConversationContext } from '../agents/agent_manager';

export interface TutorRequest {
  menu_type: string;
  message: string;
  student_context: StudentContext;
  conversation_history?: Array<{role: string, content: string}>;
  additional_data?: any;
}

export interface TutorResponse {
  status: 'success' | 'error';
  data?: AgentResponse;
  message?: string;
  metadata?: {
    agent_used: string;
    processing_time: number;
    cultural_context: boolean;
    educational_level: string;
  };
}

export interface MenuInfo {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
  agent_type: string;
  bloom_level: string;
}

export class AITutorService {
  private agentManager: AgentManager;

  constructor() {
    this.agentManager = new AgentManager();
  }

  /**
   * Process tutor request through appropriate AI agent
   */
  async process_tutor_request(request: TutorRequest): Promise<TutorResponse> {
    const startTime = Date.now();
    
    console.log(`🎓 AI Tutor Request: ${request.menu_type} - ${request.message.substring(0, 50)}...`);
    
    try {
      // Validate menu type
      const validMenus = [
        'homework_help', 'explain_topic',
        'exam_preparation', 'clear_doubts', 'study_tips'
      ];

      if (!validMenus.includes(request.menu_type)) {
        return {
          status: 'error',
          message: `Invalid menu type: ${request.menu_type}. Valid options: ${validMenus.join(', ')}`
        };
      }

      // Prepare conversation context
      const conversationContext: ConversationContext = {
        menu_intent: request.menu_type,
        conversation_history: request.conversation_history || [],
        previous_responses: request.conversation_history
          ?.filter(msg => msg.role === 'user')
          .map(msg => msg.content) || []
      };

      // Process through agent manager
      const agentResponse = await this.agentManager.handle_request(
        request.message,
        request.student_context,
        conversationContext
      );

      const processingTime = Date.now() - startTime;

      console.log(`✅ AI Tutor Response: ${agentResponse.type} in ${processingTime}ms`);

      return {
        status: 'success',
        data: agentResponse,
        metadata: {
          agent_used: agentResponse.type,
          processing_time: processingTime,
          cultural_context: agentResponse.cultural_context_used,
          educational_level: agentResponse.educational_metadata.cognitive_level
        }
      };

    } catch (error) {
      console.error('❌ AI Tutor Service Error:', error);
      
      return {
        status: 'error',
        message: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agent_used: 'error_handler',
          processing_time: Date.now() - startTime,
          cultural_context: false,
          educational_level: 'unknown'
        }
      };
    }
  }

  /**
   * Get available AI tutor menus with descriptions
   */
  get_available_menus(): { menus: MenuInfo[] } {
    return {
      menus: [
        {
          id: 'homework_help',
          title: 'Homework Help',
          description: 'Step-by-step guidance for assignments',
          icon: '📚',
          features: ['Socratic method', 'No direct answers', 'Progressive hints', 'Cultural context'],
          agent_type: 'socratic_tutor',
          bloom_level: 'Apply'
        },
        {
          id: 'explain_topic',
          title: 'Deep Dive',
          description: 'Clear explanations with examples',
          icon: '💡',
          features: ['Comprehensive explanations', 'Indian examples', 'Professional content', 'Memory aids'],
          agent_type: 'content_explainer',
          bloom_level: 'Understand'
        },
        {
          id: 'exam_preparation',
          title: 'Ace Your Exams',
          description: 'Effective preparation strategies',
          icon: '🎯',
          features: ['Study plans', 'Important questions', 'Time management', 'Cultural wisdom'],
          agent_type: 'study_planner',
          bloom_level: 'Evaluate'
        },
        {
          id: 'clear_doubts',
          title: 'Doubt Resolution',
          description: 'Clear misconceptions and doubts',
          icon: '❓',
          features: ['Professional answers', 'Examples & analogies', 'Indian context', 'Step-by-step'],
          agent_type: 'doubt_resolver',
          bloom_level: 'Analyze'
        },
        {
          id: 'study_tips',
          title: 'Virat Insights',
          description: 'Effective study techniques',
          icon: '🧠',
          features: ['Personalized guidance', 'Grade-appropriate', 'Psychological support', 'Cultural sensitivity'],
          agent_type: 'study_coach',
          bloom_level: 'Create'
        }
      ]
    };
  }

  /**
   * Get agent-specific capabilities
   */
  get_agent_capabilities(agentType: string): { capabilities: string[], limitations: string[] } {
    const capabilities: Record<string, { capabilities: string[], limitations: string[] }> = {
      homework_help: {
        capabilities: [
          'Socratic questioning methodology',
          'Step-by-step guidance without direct answers',
          'Cultural context integration',
          'Encouragement and motivation',
          'Grade-appropriate complexity'
        ],
        limitations: [
          'Does not provide direct answers',
          'Requires student participation',
          'May need multiple interactions for complex problems'
        ]
      },
      explain_topic: {
        capabilities: [
          'Comprehensive topic explanations',
          'Indian cultural examples and analogies',
          'Memory aids and mnemonics',
          'Common mistakes prevention',
          'Real-world applications'
        ],
        limitations: [
          'Limited to curriculum content',
          'May be lengthy for simple queries',
          'Requires textbook content availability'
        ]
      },
      exam_preparation: {
        capabilities: [
          'Comprehensive study planning',
          'Chapter-wise priority analysis',
          'Timeline-based strategies',
          'Stress management techniques',
          'Cultural wisdom integration'
        ],
        limitations: [
          'Generic chapter assumptions if not specified',
          'Requires student input for personalization',
          'May need adjustment based on specific exam patterns'
        ]
      },
      clear_doubts: {
        capabilities: [
          'Professional doubt resolution',
          'Multiple explanation approaches',
          'Indian cultural analogies',
          'Common misconceptions addressed',
          'Encouragement for further questions'
        ],
        limitations: [
          'Limited to curriculum-related doubts',
          'May require follow-up for complex concepts',
          'Depends on textbook content availability'
        ]
      },
      study_tips: {
        capabilities: [
          'Personalized study guidance',
          'Grade-appropriate techniques',
          'Psychological support and motivation',
          'Cultural sensitivity',
          'Learning style accommodation'
        ],
        limitations: [
          'Generic recommendations without detailed student profile',
          'May need multiple sessions for habit formation',
          'Requires student commitment to implement suggestions'
        ]
      }
    };

    return capabilities[agentType] || {
      capabilities: ['General educational assistance'],
      limitations: ['Limited specialized functionality']
    };
  }

  /**
   * Get system health and statistics
   */
  get_system_status(): {
    agents_available: number;
    cultural_integration: boolean;
    bloom_taxonomy_support: boolean;
    vector_database_connected: boolean;
    features: string[];
  } {
    return {
      agents_available: 5,
      cultural_integration: true,
      bloom_taxonomy_support: true,
      vector_database_connected: true, // This would be checked dynamically in production
      features: [
        'Socratic Tutoring',
        'Comprehensive Explanations',
        'Adaptive Quizzes',
        'Study Planning',
        'Doubt Resolution',
        'Personalized Study Coaching',
        'Hindi Language Integration',
        'Psychological Encouragement',
        'Grade-Appropriate Responses'
      ]
    };
  }
}
