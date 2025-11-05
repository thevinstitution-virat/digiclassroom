import { EventEmitter } from 'events'

// Simple per-upload progress event bus
// Each uploadId maps to a Node EventEmitter that emits:
//  - 'progress' with payload { current: number, total: number, raw?: string }
//  - 'end' when processing completes
//  - 'error' with payload Error | string

const channels = new Map<string, EventEmitter>()

export function getProgressEmitter(uploadId: string): EventEmitter {
  console.log(`🏗️ Progress Bus: Getting emitter for ${uploadId}`);
  let emitter = channels.get(uploadId)
  if (!emitter) {
    console.log(`🆕 Progress Bus: Creating new emitter for ${uploadId}`);
    emitter = new EventEmitter()
    // Increase listener limit for safety in dev
    emitter.setMaxListeners(50)
    channels.set(uploadId, emitter)
    console.log(`✅ Progress Bus: Emitter created and stored for ${uploadId}`);
  } else {
    console.log(`♻️ Progress Bus: Reusing existing emitter for ${uploadId}`);
  }
  return emitter
}

export function removeProgressEmitter(uploadId: string): void {
  const emitter = channels.get(uploadId)
  if (emitter) {
    emitter.removeAllListeners()
    channels.delete(uploadId)
  }
}

export function emitProgress(uploadId: string, current: number, total: number, raw?: string) {
  console.log(`📡 Progress Bus: Emitting progress for ${uploadId}: ${current}/${total}`);
  let emitter = channels.get(uploadId)

  // FALLBACK: Create emitter if it doesn't exist (race condition protection)
  if (!emitter) {
    console.warn(`⚠️ Progress Bus: No emitter found for ${uploadId}, creating one now (race condition detected)`);
    emitter = getProgressEmitter(uploadId);
  }

  console.log(`✅ Progress Bus: Emitter found, emitting event`);
  emitter.emit('progress', { current, total, raw })
  console.log(`📤 Progress Bus: Event emitted successfully`);
}

export function emitEnd(uploadId: string) {
  let emitter = channels.get(uploadId)

  // FALLBACK: Create emitter if it doesn't exist (race condition protection)
  if (!emitter) {
    console.warn(`⚠️ Progress Bus: No emitter found for ${uploadId} on emitEnd, creating one now`);
    emitter = getProgressEmitter(uploadId);
  }

  console.log(`🏁 Progress Bus: Emitting end event for ${uploadId}`);
  emitter.emit('end')
}

export function emitError(uploadId: string, err: any) {
  let emitter = channels.get(uploadId)

  // FALLBACK: Create emitter if it doesn't exist (race condition protection)
  if (!emitter) {
    console.warn(`⚠️ Progress Bus: No emitter found for ${uploadId} on emitError, creating one now`);
    emitter = getProgressEmitter(uploadId);
  }

  console.log(`❌ Progress Bus: Emitting error event for ${uploadId}`);
  emitter.emit('error', err)
}

