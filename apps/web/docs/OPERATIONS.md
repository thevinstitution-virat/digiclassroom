# DigiClassroom Pro — Operations Runbook

## Architecture Overview (Post Phase 7)

```
Student Query
    ↓
Next.js 15 (tRPC API)
    ↓
AgentManager.executeAgent()
├── Feature flag check → legacy OR LangGraph path
└── LangGraph path:
    ↓
  TutorGraph (StateGraph)
  ├── retrieval-node → Qdrant hybrid search (BM25 + dense)
  ├── scope-validation → NCERT curriculum check
  ├── generation-node → LangChainModelFactory → LLM API
  ├── citation-format → NCERTCitation (page + excerpt)
  ├── fallback-node → relaxed search if primary fails
  └── langfuse-trace → quality telemetry
    ↓
AgentResponse (text + citations + audioJobId)
    ↓
BullMQ → audio-worker → Kokoro TTS (async, non-blocking)
```

---

## Common Operations

### Enable a LangGraph Agent
```bash
# In .env or docker-compose environment:
archLangGraphDoubtClearing=true
# Restart: docker compose restart app
# Monitor Langfuse for 48hr: pageNumberPrecision must stay ≥ baseline
# If precision drops > 3%: set flag to false, investigate
```

### Switch LLM Provider
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # still needed for embeddings
# Restart: docker compose restart app
# Verify in Langfuse: traces show llmProvider: 'anthropic'
```

### Add New NCERT Content
```bash
# 1. Place PDF in uploads/ncert/[subject]/[grade]/[filename].pdf
# 2. Run GPU extraction: python src/python/pdf_extractor.py [pdf_path]
# 3. Run chunker: python src/python/chunker.py [extracted_json_path]
# 4. Index into Qdrant: python src/python/indexer.py [chunks_json_path]
# 5. Verify: npm run test:golden (expected ≥ 95%)
```

### Run Golden Test Suite
```bash
npm run test:golden
# Requires: live Qdrant with indexed NCERT content + OPENAI_API_KEY
# Passing bar: ≥ 95% (95/100 cases)
```

---

## Health Checks

| Endpoint | What it checks |
|---|---|
| `GET /api/health/workers` | BullMQ queue (audio jobs) |
| `GET http://localhost:8002/health` | Kokoro TTS service |
| `GET http://localhost:6333/health` | Qdrant vector DB |
| `http://localhost:16686` | Jaeger distributed traces |
| `https://cloud.langfuse.com` | AI quality metrics |

---

## Alert Thresholds

| Metric | Warning | Critical |
|---|---|---|
| pageNumberPrecision | < 0.92 | < 0.85 |
| BullMQ failed jobs | > 5 | > 10 |
| P95 response latency | > 8000ms | > 15000ms |
| Redis memory | > 70% | > 85% |
| Graph registrations on startup | ≠ 12 | — |

---

## Troubleshooting

### pageNumberPrecision dropped in Langfuse
- Filter by `agentName` to identify which agent
- Check golden test for that agent's subject
- Common cause: Qdrant chunk has `pageNumber: 0`
- Fix: re-run PDF extraction for that specific PDF

### BullMQ worker stalled (waiting > 0, active = 0)
- Check Redis: `docker compose logs redis`
- Check worker: `docker compose logs app | grep AudioWorker`
- Restart: `docker compose restart app`

### LangGraph agent returning empty response
- Check Jaeger: `fallback-node` should appear in the trace
- Check `fallbackLevel` in Langfuse metadata
- `fallbackLevel > 0` = primary retrieval failing for this query

### Multi-provider LLM not switching
- Verify: `isFeatureEnabled('archMultiProviderLLM')` returns `true`
- Verify: `LLM_PROVIDER` env var is set (not empty)
- Verify: API key is set for the chosen provider

---

## Legacy Agent Cleanup (post-deployment)

After each agent has been running on LangGraph for ≥ 2 weeks with stable
`pageNumberPrecision` and zero production incidents, delete its `.legacy.ts` file.

This is a post-deployment housekeeping task, not a pre-deployment gate.
