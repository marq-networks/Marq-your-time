import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listTypes as memListTypes, seedDefaultTypesIfEmpty } from '@lib/memory/leave'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) {
    seedDefaultTypesIfEmpty(org_id)
    const items = memListTypes(org_id)
    return NextResponse.json({ items })
  }
  const { data } = await sb.from('leave_types').select('*').eq('org_id', org_id).eq('is_active', true).order('code', { ascending: true })
  const items = (data||[]).map((r:any)=> ({ id: r.id, code: r.code, name: r.name, description: r.description || '', paid: !!r.paid, default_days_per_year: Number(r.default_days_per_year||0), is_active: !!r.is_active }))
  return NextResponse.json({ items })
}
