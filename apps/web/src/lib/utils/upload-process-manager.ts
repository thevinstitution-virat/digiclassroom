import type { ChildProcess } from 'child_process'
import { promises as fs } from 'fs'

interface UploadEntry {
  process?: ChildProcess
  tempPath?: string
  startTime?: number
  timeout?: NodeJS.Timeout
}

const uploads = new Map<string, UploadEntry>()

export function registerTempFile(uploadId: string | undefined, tempPath: string) {
  if (!uploadId) return
  const entry = uploads.get(uploadId) || {}
  entry.tempPath = tempPath
  uploads.set(uploadId, entry)
}

export function registerProcess(uploadId: string | undefined, proc: ChildProcess) {
  if (!uploadId) return
  const entry = uploads.get(uploadId) || {}
  entry.process = proc
  entry.startTime = Date.now()

  // Set up automatic timeout (3 hours)
  entry.timeout = setTimeout(() => {
    console.warn(`⏰ Upload timeout: Force killing process ${uploadId} after 3 hours`);
    forceKillProcess(uploadId);
  }, 3 * 60 * 60 * 1000); // 3 hours

  uploads.set(uploadId, entry)
}

export async function cancelProcessing(uploadId: string): Promise<{ killed: boolean; cleaned: boolean }> {
  const entry = uploads.get(uploadId)
  let killed = false
  let cleaned = false

  if (entry?.timeout) {
    clearTimeout(entry.timeout)
  }

  if (entry?.process) {
    try {
      entry.process.kill()
      killed = true
    } catch {}
  }
  if (entry?.tempPath) {
    try {
      await fs.unlink(entry.tempPath)
      cleaned = true
    } catch {}
  }

  uploads.delete(uploadId)
  return { killed, cleaned }
}

export function clearUpload(uploadId: string | undefined) {
  if (!uploadId) return
  uploads.delete(uploadId)
}

export function getActiveUploads(): string[] {
  return Array.from(uploads.keys())
}

export async function cleanupAllStuckProcesses(): Promise<{ cleaned: string[], errors: string[] }> {
  const cleaned: string[] = []
  const errors: string[] = []

  for (const uploadId of uploads.keys()) {
    try {
      console.log(`🧹 Cleanup: Terminating stuck process ${uploadId}`)
      const result = await cancelProcessing(uploadId)
      if (result.killed || result.cleaned) {
        cleaned.push(uploadId)
        console.log(`✅ Cleanup: Process ${uploadId} terminated`)
      }
    } catch (error) {
      const errorMsg = `Failed to cleanup ${uploadId}: ${error}`
      errors.push(errorMsg)
      console.error(`❌ Cleanup error:`, errorMsg)
    }
  }

  return { cleaned, errors }
}

export function forceKillProcess(uploadId: string): boolean {
  const entry = uploads.get(uploadId)
  if (entry?.process) {
    try {
      // Force kill with SIGKILL
      entry.process.kill('SIGKILL')
      uploads.delete(uploadId)
      console.log(`💀 Force killed process for ${uploadId}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to force kill process for ${uploadId}:`, error)
      return false
    }
  }
  return false
}

