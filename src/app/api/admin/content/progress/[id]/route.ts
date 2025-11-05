import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProgressEmitter } from '@/lib/utils/progress-bus'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const uploadId = id

  // Check authentication and admin role
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userRole = sessionClaims?.metadata?.role
  if (userRole !== 'admin') {
    return new Response('Forbidden. Admin access required.', { status: 403 })
  }

  const encoder = new TextEncoder()

  // Shared state for proper cleanup
  let isClosed = false
  let heartbeat: NodeJS.Timeout | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      console.log(`🔌 SSE Route: Starting connection for uploadId: ${uploadId}`);
      const emitter = getProgressEmitter(uploadId)
      console.log(`📡 SSE Route: Progress emitter obtained for ${uploadId}`);

      const send = (event: string, data?: any) => {
        if (isClosed) {
          console.log(`⚠️ SSE Route: Attempted to send to closed connection for ${uploadId}`);
          return;
        }
        try {
          const payload = data !== undefined ? `event: ${event}\ndata: ${JSON.stringify(data)}\n\n` : `event: ${event}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch (error) {
          console.warn(`❌ SSE Route: Send failed for ${uploadId}:`, error)
          isClosed = true
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
        }
      }

      // Heartbeat to keep connection alive (every 20s)
      heartbeat = setInterval(() => {
        if (isClosed) {
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          return
        }
        try {
          if (!isClosed) {
            controller.enqueue(encoder.encode(': keep-alive\n\n'))
          }
        } catch (error) {
          console.warn(`❌ SSE Route: Heartbeat failed for ${uploadId}:`, error)
          isClosed = true
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
        }
      }, 20000)

      const onProgress = (data: any) => {
        console.log(`📨 SSE Route: Received progress for ${uploadId}:`, data);
        send('progress', data);
        console.log(`📤 SSE Route: Progress sent to client`);
      }
      const onEnd = () => {
        if (!isClosed) {
          console.log(`🏁 SSE Route: Sending end event for ${uploadId}`);
          send('end')
          isClosed = true
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          try {
            controller.close()
          } catch (error) {
            console.warn(`⚠️ SSE Route: Controller close error for ${uploadId}:`, error);
          }
        }
      }
      const onError = (err: any) => {
        if (!isClosed) {
          console.error(`❌ SSE Route: Error for ${uploadId}:`, err);
          send('error', { message: String(err?.message || err) })
          isClosed = true
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          try {
            controller.close()
          } catch (error) {
            console.warn(`⚠️ SSE Route: Controller close error for ${uploadId}:`, error);
          }
        }
      }

      emitter.on('progress', onProgress)
      emitter.once('end', onEnd)
      emitter.once('error', onError)

      // Send initial event to confirm subscription
      console.log(`🎯 SSE Route: Sending ready event for ${uploadId}`);
      send('ready', { uploadId })
      console.log(`✅ SSE Route: Ready event sent successfully`);

      // Log listener count for debugging
      console.log(`👂 SSE Route: Emitter has ${emitter.listenerCount('progress')} progress listeners`);
    },
    cancel() {
      // Client disconnected; clean up properly
      if (!isClosed) {
        console.log(`🔌 SSE Route: Connection cancelled for upload ${uploadId}`)
        isClosed = true
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}

