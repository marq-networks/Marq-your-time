import { NextRequest, NextResponse } from 'next/server'
import { revokeTrustedDevice } from '@lib/security'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const deviceId = body.device_id || body.deviceId || ''
  if (!deviceId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const ok = await revokeTrustedDevice(deviceId)
  return NextResponse.json({ revoked: ok })
}
