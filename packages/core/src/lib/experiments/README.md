# A/B Testing Infrastructure

Complete A/B testing framework for DigiClassroom Pro validation system.

## 📁 Directory Structure

```
src/lib/experiments/
├── README.md                           # This file
├── traffic-splitter.ts                 # User variant assignment
├── statistics.ts                       # Statistical analysis tools
└── templates/                          # Pre-configured experiments
    ├── index.ts
    ├── embedding-model-experiment.ts   # Test: 3-large vs 3-small
    ├── chunk-count-experiment.ts       # Test: 3 vs 4 chunks
    ├── retrieval-strategy-experiment.ts # Test: dense vs hybrid
    └── prompt-variation-experiment.ts  # Test: current vs optimized

src/app/api/experiments/
├── create/route.ts                     # POST /api/experiments/create
├── start/route.ts                      # POST /api/experiments/start
├── list/route.ts                       # GET /api/experiments/list
└── results/route.ts                    # GET /api/experiments/results

migrations/
└── 003-ab-testing-schema.sql          # Database schema
```

## 🚀 Quick Start

### 1. Run Database Migration

```bash
# Run the A/B testing schema migration
node scripts/run-migration.js migrations/003-ab-testing-schema.sql
```

This creates:
- `experiments` table - Experiment configurations
- `experiment_assignments` table - User variant assignments
- `experiment_results` table - Aggregated results
- Updates `answer_feedback` table with experiment tracking

### 2. Create an Experiment

```typescript
import { createEmbeddingModelExperiment } from '@/lib/experiments/templates'

// Get experiment configuration
const config = await createEmbeddingModelExperiment()

// Create via API
const response = await fetch('/api/experiments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
})

const { experimentId } = await response.json()
```

### 3. Start the Experiment

```typescript
await fetch('/api/experiments/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ experimentId })
})
```

### 4. Use in Your Code

```typescript
import { getUserVariant } from '@/lib/experiments/traffic-splitter'

// In your RAG pipeline
const assignment = await getUserVariant(userId, experimentId, 50)

if (assignment.variant === 'A') {
  // Use control variant
} else {
  // Use treatment variant
}

// Track experiment in feedback
await createFeedback({
  ...feedbackData,
  experiment_id: experimentId,
  experiment_variant: assignment.variant
})
```

### 5. Analyze Results

```typescript
const response = await fetch(`/api/experiments/results?experimentId=${experimentId}`)
const results = await response.json()

console.log(results.recommendation)
console.log(results.decision)
```

## 📊 Available Experiment Templates

### 1. Embedding Model Comparison

**Test:** `text-embedding-3-large` vs `text-embedding-3-small`

**Hypothesis:** 85% cost reduction with < 0.05 drop in faithfulness

```typescript
import { getEmbeddingWithExperiment } from '@/lib/experiments/templates'

const { embedding, variant } = await getEmbeddingWithExperiment(
  text,
  userId,
  openai
)
```

**Expected Impact:**
- Cost: -85% (₹0.015 → ₹0.002)
- Faithfulness: -0.02 (acceptable)
- Sample Size: 393 per variant

### 2. Chunk Count Optimization

**Test:** 3 chunks vs 4 chunks

**Hypothesis:** +5 completeness with < 500ms response time increase

```typescript
import { getChunkCountWithExperiment } from '@/lib/experiments/templates'

const { chunkCount, variant } = await getChunkCountWithExperiment(userId)

const chunks = await retrieveTopKChunks(query, chunkCount)
```

**Expected Impact:**
- Completeness: +5
- Response Time: +300ms (acceptable)
- Sample Size: 300 per variant

### 3. Retrieval Strategy Comparison

**Test:** Dense-only vs Hybrid (dense + sparse with RRF)

**Hypothesis:** +0.05 faithfulness with < 150ms search time increase

```typescript
import { getRetrievalStrategyWithExperiment } from '@/lib/experiments/templates'

const { strategy, useBM25, useRRF, variant } = 
  await getRetrievalStrategyWithExperiment(userId)

const results = strategy === 'hybrid'
  ? await hybridSearch(query)
  : await denseSearch(query)
```

**Expected Impact:**
- Faithfulness: +0.05
- Relevance: +0.05
- Search Time: +150ms (acceptable)
- Sample Size: 300 per variant

### 4. Prompt Variation Testing

**Test:** Current prompt vs Optimized prompt

**Hypothesis:** +5% clarity, +5% CBSE alignment, +10% citation quality

```typescript
import { getPromptWithExperiment } from '@/lib/experiments/templates'

const { prompt, variant } = await getPromptWithExperiment(
  userId,
  context,
  question
)

const answer = await generateAnswer(prompt)
```

**Expected Impact:**
- Clarity: +5%
- CBSE Alignment: +5%
- Citation Quality: +10%
- Sample Size: 300 per variant

## 🔬 Statistical Analysis

### T-Test

```typescript
import { calculateTTest, ExperimentData } from '@/lib/experiments/statistics'

const data: ExperimentData = {
  variantA: [4.0, 4.2, 3.8, 4.1, ...],
  variantB: [4.3, 4.5, 4.2, 4.4, ...]
}

const result = calculateTTest(data)

console.log(`t-statistic: ${result.tStatistic}`)
console.log(`p-value: ${result.pValue}`)
console.log(`Significant: ${result.isSignificant}`)
```

### Comprehensive Comparison

```typescript
import { compareVariants } from '@/lib/experiments/statistics'

const analysis = compareVariants(data)

console.log(`Variant A: ${analysis.variantA.mean} ± ${analysis.variantA.std}`)
console.log(`Variant B: ${analysis.variantB.mean} ± ${analysis.variantB.std}`)
console.log(`Change: ${analysis.percentChange}%`)
console.log(`Effect Size: ${analysis.effectSize}`)
console.log(`Recommendation: ${analysis.recommendation}`)
```

## 📈 API Endpoints

### Create Experiment

```bash
POST /api/experiments/create
```

```json
{
  "experimentName": "Embedding Model Test",
  "experimentType": "embedding_model",
  "variantAConfig": { "model": "text-embedding-3-large" },
  "variantBConfig": { "model": "text-embedding-3-small" },
  "primaryMetric": "faithfulness_score",
  "minSampleSize": 393
}
```

### Start Experiment

```bash
POST /api/experiments/start
```

```json
{
  "experimentId": "exp-001"
}
```

### List Experiments

```bash
GET /api/experiments/list?status=active
```

### Get Results

```bash
GET /api/experiments/results?experimentId=exp-001
```

## 🎯 Best Practices

1. **One experiment at a time** - Don't run multiple experiments simultaneously
2. **Consistent user assignment** - Same user always gets same variant
3. **Sufficient sample size** - Wait for statistical significance (p < 0.05)
4. **Monitor secondary metrics** - Don't optimize one metric at expense of others
5. **Document everything** - Record hypothesis, results, and decisions

## 📊 Sample Size Calculator

```typescript
import { calculateRequiredSampleSize } from '@/lib/experiments/statistics'

const sampleSize = calculateRequiredSampleSize(
  4.0,    // baseline value
  0.2,    // minimum detectable effect (5%)
  0.8,    // power
  0.05    // alpha
)

console.log(`Required sample size: ${sampleSize} per variant`)
```

## 🔍 Monitoring

### Check Experiment Progress

```typescript
import { getExperimentStats } from '@/lib/experiments/traffic-splitter'

const stats = await getExperimentStats(experimentId)

console.log(`Variant A: ${stats.variantA} users`)
console.log(`Variant B: ${stats.variantB} users`)
console.log(`Split: ${stats.splitPercentage}%`)
```

### View Active Experiments

```sql
SELECT * FROM v_active_experiments;
```

### View Performance Comparison

```sql
SELECT * FROM v_experiment_comparison;
```

## 🎓 Example: Complete Workflow

```typescript
// 1. Create experiment
const config = await createEmbeddingModelExperiment()
const createRes = await fetch('/api/experiments/create', {
  method: 'POST',
  body: JSON.stringify(config)
})
const { experimentId } = await createRes.json()

// 2. Start experiment
await fetch('/api/experiments/start', {
  method: 'POST',
  body: JSON.stringify({ experimentId })
})

// 3. Use in production
const assignment = await getUserVariant(userId, experimentId)
const embedding = await getEmbedding(text, assignment.variant === 'A' 
  ? 'text-embedding-3-large' 
  : 'text-embedding-3-small'
)

// 4. Track in feedback
await createFeedback({
  experiment_id: experimentId,
  experiment_variant: assignment.variant,
  // ... other feedback data
})

// 5. Wait for data (7-14 days)

// 6. Analyze results
const results = await fetch(`/api/experiments/results?experimentId=${experimentId}`)
const analysis = await results.json()

// 7. Make decision
if (analysis.statistics.isSignificant && analysis.percentChange > 0) {
  console.log('Deploy Variant B!')
} else {
  console.log('Keep Variant A')
}
```

## 📚 References

- Documentation: `docs/validation-system/07-ab-testing-playbook.md`
- Database Schema: `migrations/003-ab-testing-schema.sql`
- Statistical Methods: `src/lib/experiments/statistics.ts`

