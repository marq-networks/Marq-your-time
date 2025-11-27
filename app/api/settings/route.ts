import { NextRequest, NextResponse } from 'next/server'
import { getSettings, updateSettings } from '@lib/db'

export async function GET() {
  const settings = await getSettings()
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await updateSettings(body)
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  return NextResponse.json({ settings: res })
}
