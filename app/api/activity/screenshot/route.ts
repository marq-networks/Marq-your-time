import { NextRequest, NextResponse } from 'next/server'
import { ingestScreenshot } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trackingSessionId = body.tracking_session_id || body.trackingSessionId
  const timestamp = body.timestamp
  const storagePath = body.storage_path || body.storagePath
  const thumbnailPath = body.thumbnail_path || body.thumbnailPath
  const imageUrl = body.image || body.imageUrl
  if (!trackingSessionId || !timestamp || (!storagePath && !imageUrl)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await ingestScreenshot({ trackingSessionId, timestamp, storagePath, thumbnailPath, imageUrl })
  const codes: Record<string, number> = { TRACKING_NOT_ALLOWED: 403, SCREENSHOTS_DISABLED: 403, MISSING_IMAGE: 400, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json(res)
}

