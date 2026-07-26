# DigiClassroom Pro — LLM & Embedding Provider Guide

## ⚠️ Critical: LLM vs Embedding Providers Are Independent

**Switching LLM provider:** instant, no data migration required.
**Switching embedding provider:** requires complete Qdrant re-indexing.

Your current Qdrant collection uses OpenAI `text-embedding-3-small` (1536 dimensions).
Any embedding model producing a different dimension count is **incompatible**
without re-indexing all NCERT content.

---

## Supported LLM Providers (switch freely)

| Provider | `LLM_PROVIDER` value | Model env var | Default model |
|---|---|---|---|
| OpenAI | `openai` | `OPENAI_MODEL` | gpt-4o-mini |
| Anthropic | `anthropic` or `claude` | `ANTHROPIC_MODEL` | claude-3-5-sonnet-20241022 |
| Google Gemini | `gemini` or `google` | `GEMINI_MODEL` | gemini-1.5-pro |
| Groq | `groq` | `GROQ_MODEL` | llama-3.3-70b-versatile |
| Ollama (local) | `ollama` | `OLLAMA_MODEL` | llama3.2 |

### Switching LLM Provider
1. Update `.env`: `LLM_PROVIDER=anthropic`
2. Set the API key: `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart app: `docker compose restart app`
4. Verify: Langfuse traces show `llmProvider: anthropic`
5. No data migration. No re-indexing. Works immediately.

---

## Embedding Providers (switching requires re-indexing)

| Provider | Dimensions | Compatible with current Qdrant? |
|---|---|---|
| OpenAI `text-embedding-3-small` | **1536** ← current | ✅ YES |
| OpenAI `text-embedding-3-large` | 3072 | ❌ NO — re-index needed |
| Gemini `text-embedding-004` | 768 | ❌ NO — re-index needed |
| Ollama `nomic-embed-text` | 768 | ❌ NO — re-index needed |
| Ollama `mxbai-embed-large` | 1024 | ❌ NO — re-index needed |

### Switching Embedding Provider (major operation)
1. Choose new embedding model and note the dimension count
2. Create new Qdrant collection with the new dimension
3. Re-run full PDF extraction for all NCERT PDFs
4. Re-run chunker on all extracted content
5. Re-index all chunks into new Qdrant collection
6. Update `EMBEDDING_MODEL` env var
7. Run `npm run test:golden` to verify citation quality

---

## Provider-Specific Notes

### Anthropic + Embeddings
Anthropic has no embeddings API. When `LLM_PROVIDER=anthropic`, embeddings
fall back to OpenAI automatically. Both keys required simultaneously:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # still required for embeddings
```

### Fully Local Operation (Ollama)
```
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
# Embeddings: keep using OpenAI unless you re-index with nomic-embed-text
OPENAI_API_KEY=sk-...
```

---

## Recommended Configurations

**Production (cost-optimized):**
`LLM_PROVIDER=openai`, `OPENAI_MODEL=gpt-4o-mini`

**Production (quality-optimized):**
`LLM_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-3-5-sonnet-20241022`
(+ `OPENAI_API_KEY` for embeddings)

**Development (fast iteration):**
`LLM_PROVIDER=groq`, `GROQ_MODEL=llama-3.3-70b-versatile`

**Fully offline / school with limited internet:**
`LLM_PROVIDER=ollama`, `OLLAMA_MODEL=llama3.2`
(+ re-index Qdrant with nomic-embed-text OR keep OpenAI key for embeddings)
