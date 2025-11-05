import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'
import { QdrantClient } from '@qdrant/js-client-rest'

const execFileAsync = promisify(execFile)

export async function GET(_req: NextRequest) {
  const pythonPath = process.env.DOC_EXTRACT_ENGINE_PYTHON_PATH || 'python'
  const modelsPath = process.env.DOC_EXTRACT_ENGINE_MODELS_PATH
  const configPath = path.join(process.cwd(), 'config', 'doc-extract-engine', 'config.json')
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'
  const qdrantApiKey = process.env.QDRANT_API_KEY

  const result: any = {
    python: { path: pythonPath, version: null, engine_import_ok: false, error: null },
    config: { path: configPath, exists: false },
    models: { path: modelsPath || null, exists: null },
    qdrant: { url: qdrantUrl, ok: false, collections: null, error: null }
  }

  try {
    // Python version
    const { stdout } = await execFileAsync(pythonPath, ['--version'])
    result.python.version = (stdout || '').trim()
  } catch (e: any) {
    result.python.error = e?.message || 'Failed to run python --version'
  }

  try {
    // Try importing engine
    await execFileAsync(pythonPath, ['-c', 'import importlib; importlib.import_module("doc_extract_engine"); print("ok")'])
    result.python.engine_import_ok = true
  } catch (e: any) {
    result.python.engine_import_ok = false
  }

  // Config file
  try {
    result.config.exists = existsSync(configPath)
  } catch {}

  // Models path
  if (modelsPath) {
    try {
      result.models.exists = existsSync(modelsPath)
    } catch {
      result.models.exists = false
    }
  }

  // Qdrant connectivity
  try {
    const client = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey })
    const info: any = await client.getCollections()
    result.qdrant.ok = true
    result.qdrant.collections = info?.collections?.map((c: any) => c.name) || []
  } catch (e: any) {
    result.qdrant.ok = false
    result.qdrant.error = e?.message || 'Failed to query Qdrant'
  }

  return NextResponse.json({ success: true, health: result })
}

