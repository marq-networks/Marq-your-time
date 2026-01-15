import { NextRequest, NextResponse } from 'next/server'
import { ingestScreenshot, startTracking, startWorkSession } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  let trackingSessionId = body.tracking_session_id || body.trackingSessionId
  const timestamp = body.timestamp
  const storagePath = body.storage_path || body.storagePath
  const thumbnailPath = body.thumbnail_path || body.thumbnailPath
  const imageUrl = body.image || body.imageUrl
  if (!timestamp || (!storagePath && !imageUrl)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  if (!trackingSessionId) {
    let memberId = body.user_id || body.userId || body.member_id || body.memberId
    let orgId = body.org_id || body.orgId

    if (!memberId || !orgId) {
      memberId = req.cookies.get('current_user_id')?.value
      orgId = req.cookies.get('current_org_id')?.value
    }

    if (memberId && orgId) {
      let res = await startTracking({ memberId, orgId })
      if (typeof res !== 'string' && res.trackingAllowed && res.trackingSessionId) {
        trackingSessionId = res.trackingSessionId
      } else {
        const ws = await startWorkSession({ memberId, orgId, source: 'agent' })
        if (typeof ws !== 'string' && ws && ws.id) {
          const again = await startTracking({ timeSessionId: ws.id, memberId, orgId })
          if (typeof again !== 'string' && again.trackingAllowed && again.trackingSessionId) {
            trackingSessionId = again.trackingSessionId
          }
        }
      }
    }
  }

  if (!trackingSessionId) return NextResponse.json({ error: 'MISSING_TRACKING_SESSION' }, { status: 400 })

  const res = await ingestScreenshot({ trackingSessionId, timestamp, storagePath, thumbnailPath, imageUrl })
  const codes: Record<string, number> = { TRACKING_NOT_ALLOWED: 403, SCREENSHOTS_DISABLED: 403, MISSING_IMAGE: 400, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json(res)
}
