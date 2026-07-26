import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const accessKey = req.headers.get('AccessKey') || url.searchParams.get('key')
    
    if (accessKey !== process.env.BUNNY_LIBRARY_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json()
    // Bunny webhook payload format (Status 4 = Finished Encoding)
    // { "VideoGuid": "uuid", "Status": 4, "LibraryId": 123456 }
    
    const { VideoGuid, Status } = payload

    if (!VideoGuid) {
      return NextResponse.json({ error: 'Missing VideoGuid' }, { status: 400 })
    }

    // Only process if status is 4 (Finished)
    if (Status === 4) {
      const cdnHostname = process.env.BUNNY_CDN_HOSTNAME
      // Bunny default thumbnail pattern is: https://{cdn}/guid/thumbnail.jpg
      const thumbnailUrl = cdnHostname ? `https://${cdnHostname}/${VideoGuid}/thumbnail.jpg` : null

      await db.update(schema.videoAssets)
        .set({ status: 'ready', thumbnailUrl: thumbnailUrl || undefined })
        .where(eq(schema.videoAssets.providerVideoId, VideoGuid));
        
      console.log(`[Bunny Webhook] Video ${VideoGuid} marked as ready.`)
    } else if (Status === 5 || Status === 6) { // 5 = Failed, 6 = Encoding Failed
      await db.update(schema.videoAssets)
        .set({ status: 'failed' })
        .where(eq(schema.videoAssets.providerVideoId, VideoGuid));
        
      console.log(`[Bunny Webhook] Video ${VideoGuid} marked as failed.`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Bunny Webhook] Error processing:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
