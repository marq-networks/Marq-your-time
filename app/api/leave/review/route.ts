import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { reviewRequest as memReviewRequest } from '@lib/memory/leave'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin' && role !== 'org_admin' && role !== 'manager') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const body = await req.json().catch(()=>({}))
  const request_id = body.request_id || body.id
  const status = body.status
  const note = body.note || ''
  if (!request_id || !status || !['approved','rejected'].includes(status)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const reviewed_by = req.headers.get('x-user-id') || null
  const reviewed_at = new Date()
  if (!sb) {
    const item = memReviewRequest(request_id, status, note, reviewed_by || undefined)
    if (!item) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ item })
  }
  const { data, error } = await sb.from('leave_requests').update({ status, review_note: note, reviewed_by, reviewed_at }).eq('id', request_id).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ item: data })
}
