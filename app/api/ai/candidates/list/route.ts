import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  const status = searchParams.get('status') || 'pending'
  
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  const sb = supabaseServer()
  const { data, error } = await sb
    .from('ai_timesheet_candidates')
    .select('*, timesheets(id, period_start, period_end, employee_user_id)')
    .eq('org_id', orgId)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}
