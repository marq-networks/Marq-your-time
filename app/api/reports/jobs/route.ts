import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || ''
  const limit = Number(searchParams.get('limit') || 20)
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ items: [] })
  const { data } = await sb.from('report_jobs').select('*').eq('org_id', org_id).order('created_at', { ascending: false }).limit(limit)
  const items = (data || []).map((r:any)=> ({ id: r.id, org_id: r.org_id, report_type: r.report_type, params: r.params, status: r.status, file_url: r.file_url, error_message: r.error_message, created_at: r.created_at, completed_at: r.completed_at }))
  return NextResponse.json({ items })
}

