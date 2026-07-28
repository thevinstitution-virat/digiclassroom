/**
 * LangGraph Agent Infrastructure — Barrel file
 * Exports all graph factories, state, and registration utilities.
 *
 * Agent graph files are imported here as side effects to trigger registration.
 */

// Core infrastructure
export { TutorGraphState, type TutorState } from './TutorGraphState';
export { buildAgentGraph, type AgentGraphConfig } from './BaseGraphFactory';
export { registerGraph, getAgentGraph, GRAPH_FEATURE_FLAGS } from './registry';

// Agent graphs — import as side effects to register (add as agents are migrated)
import './agents/StudyTipsGraph';
import './agents/CbseAnswerFormatterGraph';
import './agents/ConversationalLearningGraph';
import './agents/ExamPreparationGraph';
import './agents/TopicExplanationGraph';
import './agents/SelfStudyBuddyGraph';
import './agents/DoubtClearingGraph';
import './agents/HomeworkHelpGraph';
import './agents/ConstrainedGenerationGraph';
import './agents/EnhancedSynthesisGraph';
