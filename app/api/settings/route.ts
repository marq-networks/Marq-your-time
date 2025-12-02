import { NextRequest, NextResponse } from 'next/server'
import { getSettings, updateSettings } from '@lib/db'
import { checkPermission } from '@lib/permissions'

export async function GET() {
  const settings = await getSettings()
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_settings') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const res = await updateSettings(body)
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  return NextResponse.json({ settings: res })
}
