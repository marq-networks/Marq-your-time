import { NextRequest, NextResponse } from 'next/server'
import { startTracking, getPrivacySettings } from '@lib/db'

export async function GET(req: NextRequest) {
  const memberId = req.cookies.get('current_user_id')?.value
  const orgId = req.cookies.get('current_org_id')?.value

  if (!memberId || !orgId) {
    return NextResponse.json({ trackingAllowed: false })
  }

  // Attempt to resume or start tracking for the open session
  const res = await startTracking({ memberId, orgId })
  if (typeof res === 'string') {
    return NextResponse.json({ trackingAllowed: false, error: res })
  }
  if (res.trackingAllowed) {
     const settings = await getPrivacySettings(memberId, orgId)
     return NextResponse.json({ ...res, settings })
  }
  return NextResponse.json(res)
}
