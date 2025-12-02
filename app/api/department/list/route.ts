import { NextRequest, NextResponse } from 'next/server'
import { listDepartments } from '@lib/db'
import { isSupabaseConfigured } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listDepartments(orgId)
  return NextResponse.json({ items, source: isSupabaseConfigured() ? 'supabase' : 'memory' })
}
