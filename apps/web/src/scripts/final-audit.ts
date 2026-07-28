#!/usr/bin/env npx ts-node
/**
 * Phase 6 Final Scoring Audit
 *
 * Validates all Phase 6 deliverables:
 * 1. All LangGraph agent nodes exist and export correctly
 * 2. All graph factories are registered
 * 3. Feature flags exist for every migrated agent
 * 4. Golden test suite has 100 cases
 * 5. Multi-provider LLM factory routes correctly
 * 6. Token normalization produces canonical format
 * 7. Langfuse trace node includes llmProvider
 *
 * Usage: npx ts-node src/scripts/final-audit.ts
 */

const path = require('path') as typeof import('path');
const fs = require('fs') as typeof import('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

interface AuditCheck {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    detail: string;
}

const results: AuditCheck[] = [];

function check(name: string, condition: boolean, passDetail: string, failDetail: string) {
    results.push({
        name,
        status: condition ? 'PASS' : 'FAIL',
        detail: condition ? passDetail : failDetail,
    });
}

function warn(name: string, detail: string) {
    results.push({ name, status: 'WARN', detail });
}

// ─── CHECK 1: LangGraph Node Files ──────────────────────────────────────────
const EXPECTED_NODES = [
    'CbseAnswerFormatterNode.ts',
    'SourceValidationNode.ts',
    'ConversationalLearningNode.ts',
    'ExamPreparationNode.ts',
    'TopicExplanationNode.ts',
    'SelfStudyBuddyNode.ts',
    'DoubtClearingNode.ts',
    'HomeworkHelpNode.ts',
    'ConstrainedGenerationNode.ts',
    'EnhancedSynthesisNode.ts',
    'CitationAgentNode.ts',
];

const nodesDir = path.join(SRC, 'lib', 'agents', 'graph', 'agents');
const existingNodes = fs.existsSync(nodesDir) ? fs.readdirSync(nodesDir) : [];

for (const node of EXPECTED_NODES) {
    check(
        `Node: ${node}`,
        existingNodes.includes(node),
        'exists',
        `MISSING at ${nodesDir}/${node}`
    );
}

// ─── CHECK 2: Graph Factory Files ───────────────────────────────────────────
const EXPECTED_GRAPHS = [
    'CbseAnswerFormatterGraph.ts',
    'ConversationalLearningGraph.ts',
    'ExamPreparationGraph.ts',
    'TopicExplanationGraph.ts',
    'SelfStudyBuddyGraph.ts',
    'DoubtClearingGraph.ts',
    'HomeworkHelpGraph.ts',
    'ConstrainedGenerationGraph.ts',
    'EnhancedSynthesisGraph.ts',
    'StudyTipsGraph.ts',
];

for (const graph of EXPECTED_GRAPHS) {
    check(
        `Graph: ${graph}`,
        existingNodes.includes(graph),
        'exists',
        `MISSING at ${nodesDir}/${graph}`
    );
}

// ─── CHECK 3: Feature Flags ────────────────────────────────────────────────
const flagsFile = fs.readFileSync(
    path.join(SRC, 'lib', 'config', 'feature-flags.ts'), 'utf-8'
);

const EXPECTED_FLAGS = [
    'langGraphCbseAnswerFormatter',
    'langGraphConversationalLearning',
    'langGraphExamPreparation',
    'langGraphTopicExplanation',
    'langGraphSelfStudyBuddy',
    'langGraphDoubtClearing',
    'langGraphHomeworkHelp',
    'langGraphConstrainedGeneration',
    'langGraphEnhancedSynthesis',
    'archLangGraphStudyTips',
];

for (const flag of EXPECTED_FLAGS) {
    check(
        `Flag: ${flag}`,
        flagsFile.includes(flag),
        'declared in feature-flags.ts',
        `MISSING from feature-flags.ts`
    );
}

// ─── CHECK 4: Registry Mappings ─────────────────────────────────────────────
const registryFile = fs.readFileSync(
    path.join(SRC, 'lib', 'agents', 'graph', 'registry.ts'), 'utf-8'
);

const EXPECTED_REGISTRY_AGENTS = [
    'cbse_answer_formatter',
    'conversational_learning',
    'exam_preparation',
    'topic_explanation',
    'selfstudy_buddy',
    'doubt_clearing',
    'homework_help',
    'constrained_generation',
    'enhanced_synthesis',
    'study_tips',
];

for (const agent of EXPECTED_REGISTRY_AGENTS) {
    check(
        `Registry: ${agent}`,
        registryFile.includes(`'${agent}'`),
        'mapped in registry.ts',
        `MISSING from GRAPH_FEATURE_FLAGS`
    );
}

// ─── CHECK 5: Golden Test Cases = 100 ──────────────────────────────────────
const goldenSetDir = path.join(SRC, '__tests__', 'evaluation', 'golden-set');
const goldenFiles = fs.existsSync(goldenSetDir) ? fs.readdirSync(goldenSetDir).filter(f => f.endsWith('.golden.ts')) : [];

let totalCases = 0;
for (const file of goldenFiles) {
    const content = fs.readFileSync(path.join(goldenSetDir, file), 'utf-8');
    const idMatches = content.match(/id:\s*'/g);
    const count = idMatches?.length ?? 0;
    totalCases += count;
}

check(
    'Golden tests = 100',
    totalCases === 100,
    `${totalCases} cases across ${goldenFiles.length} files`,
    `Found ${totalCases} cases (expected 100)`
);

// ─── CHECK 6: Multi-Provider LLM ───────────────────────────────────────────
const factoryFile = fs.readFileSync(
    path.join(SRC, 'lib', 'agents', 'core', 'llm', 'llm-factory.ts'), 'utf-8'
);
check(
    'LLMFactory: Anthropic routing',
    factoryFile.includes("'anthropic'") && factoryFile.includes('AnthropicProvider'),
    'routes to AnthropicProvider',
    'Missing anthropic routing'
);
check(
    'LLMFactory: Gemini routing',
    factoryFile.includes("'gemini'") && factoryFile.includes('GeminiProvider'),
    'routes to GeminiProvider',
    'Missing gemini routing'
);
check(
    'LLMFactory: env-based routing',
    factoryFile.includes('LLM_PROVIDER'),
    'reads LLM_PROVIDER env var',
    'Missing LLM_PROVIDER env var check'
);

// ─── CHECK 7: Token Normalization ──────────────────────────────────────────
const anthropicFile = fs.readFileSync(
    path.join(SRC, 'lib', 'agents', 'core', 'llm', 'anthropic-provider.ts'), 'utf-8'
);
check(
    'Anthropic: token normalization',
    anthropicFile.includes('input_tokens') && anthropicFile.includes('promptTokens'),
    'input_tokens → promptTokens mapping found',
    'Missing token normalization'
);

const geminiFile = fs.readFileSync(
    path.join(SRC, 'lib', 'agents', 'core', 'llm', 'gemini-provider.ts'), 'utf-8'
);
check(
    'Gemini: token normalization',
    geminiFile.includes('promptTokenCount') && geminiFile.includes('promptTokens'),
    'promptTokenCount → promptTokens mapping found',
    'Missing token normalization'
);

// ─── CHECK 8: Langfuse Provider Tracking ───────────────────────────────────
const traceNodeFile = fs.readFileSync(
    path.join(SRC, 'lib', 'agents', 'graph', 'nodes', 'langfuse-trace-node.ts'), 'utf-8'
);
check(
    'Langfuse: llmProvider in trace',
    traceNodeFile.includes('llmProvider'),
    'llmProvider field sent to Langfuse',
    'Missing llmProvider in trace node'
);

// ─── CHECK 9: TutorGraphState has llmProvider ─────────────────────────────
const stateFile = fs.readFileSync(
    path.join(SRC, 'lib', 'agents', 'graph', 'TutorGraphState.ts'), 'utf-8'
);
check(
    'TutorGraphState: llmProvider field',
    stateFile.includes('llmProvider'),
    'llmProvider annotation exists',
    'Missing llmProvider in TutorGraphState'
);
// ─── PHASE 7: LangChainModelFactory ────────────────────────────────────────
const lcmfPath = path.join(SRC, 'lib', 'llm', 'LangChainModelFactory.ts');
const lcmfExists = fs.existsSync(lcmfPath);
check(
    'PH7: LangChainModelFactory exists',
    lcmfExists,
    'src/lib/llm/LangChainModelFactory.ts found',
    'MISSING — Pre-flight 1 incomplete'
);

if (lcmfExists) {
    const lcmfContent = fs.readFileSync(lcmfPath, 'utf-8');
    check(
        'PH7: Model cache built-in',
        lcmfContent.includes('modelCache') && lcmfContent.includes('new Map'),
        'modelCache with Map found',
        'Missing model cache'
    );
    check(
        'PH7: Correct import path (feature-flags)',
        lcmfContent.includes("feature-flags") && !lcmfContent.includes("'/lib/config/features'"),
        'uses @/lib/config/feature-flags',
        'WRONG import path — would cause compile error'
    );
}

// Check no node hardcodes ChatOpenAI
const nodeFiles = fs.existsSync(nodesDir) ? fs.readdirSync(nodesDir).filter((f: string) => f.endsWith('Node.ts')) : [];
const violatingNodes: string[] = [];
for (const nf of nodeFiles) {
    const nc = fs.readFileSync(path.join(nodesDir, nf), 'utf-8');
    if (nc.includes('new ChatOpenAI(')) violatingNodes.push(nf);
}
check(
    'PH7: Zero ChatOpenAI hardcodes in nodes',
    violatingNodes.length === 0,
    `All ${nodeFiles.length} nodes use LangChainModelFactory`,
    `STILL HARDCODED: ${violatingNodes.join(', ')}`
);

// Documentation checks
check(
    'PH7: docs/LLM_PROVIDERS.md exists',
    fs.existsSync(path.join(ROOT, 'docs', 'LLM_PROVIDERS.md')),
    'LLM provider guide found',
    'MISSING — Task 7.2 incomplete'
);

const llmProviderDoc = fs.existsSync(path.join(ROOT, 'docs', 'LLM_PROVIDERS.md'))
    ? fs.readFileSync(path.join(ROOT, 'docs', 'LLM_PROVIDERS.md'), 'utf-8')
    : '';
check(
    'PH7: Embedding dimension warning documented',
    llmProviderDoc.includes('re-index') && llmProviderDoc.includes('1536'),
    'Dimension mismatch + re-indexing requirement documented',
    'Missing critical embedding warning'
);

check(
    'PH7: docs/OPERATIONS.md exists',
    fs.existsSync(path.join(ROOT, 'docs', 'OPERATIONS.md')),
    'Operations runbook found',
    'MISSING — Task 7.5 incomplete'
);

// Performance: message history cap
const agentMgrPath = path.join(SRC, 'lib', 'agents', 'agent_manager.ts');
const agentMgrContent = fs.existsSync(agentMgrPath) ? fs.readFileSync(agentMgrPath, 'utf-8') : '';
check(
    'PH7: Message history cap',
    agentMgrContent.includes('MAX_HISTORY_TURNS') || agentMgrContent.includes('slice(-'),
    'History cap found in agent_manager.ts',
    'Missing — unbounded token growth risk'
);

// Performance: graph registry singleton warning
check(
    'PH7: Graph registry duplicate warning',
    registryFile.includes('registered twice') || registryFile.includes('compilationCount'),
    'Duplicate registration detection in registry.ts',
    'Missing — silent double-registration risk'
);

// ─── REPORT ─────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('🏁 PHASE 6+7 FINAL SCORING AUDIT');
console.log('═'.repeat(70));

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const warned = results.filter(r => r.status === 'WARN').length;

for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} ${r.name}: ${r.detail}`);
}

console.log('\n' + '─'.repeat(70));
console.log(`  Total: ${results.length} checks | ✅ ${passed} passed | ❌ ${failed} failed | ⚠️ ${warned} warnings`);

const score = results.length > 0 ? (passed / results.length * 100).toFixed(1) : '0';
console.log(`  Score: ${score}%`);
console.log('═'.repeat(70));

if (failed > 0) {
    process.exit(1);
}
