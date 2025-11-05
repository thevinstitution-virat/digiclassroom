import { NextRequest, NextResponse } from 'next/server'
import { cancelProcessing } from '@/lib/utils/upload-process-manager'
import { emitError, emitEnd } from '@/lib/utils/progress-bus'

export async function POST(req: NextRequest) {
  try {
    const { uploadId } = await req.json()
    if (!uploadId) {
      return NextResponse.json({ success: false, error: 'uploadId required' }, { status: 400 })
    }
    const { killed, cleaned } = await cancelProcessing(uploadId)
    try { emitError(uploadId, new Error('Processing cancelled by user')) } catch {}
    try { emitEnd(uploadId) } catch {}
    return NextResponse.json({ success: true, killed, cleaned })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Cancel failed' }, { status: 500 })
  }
}

