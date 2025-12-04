import { NextRequest, NextResponse } from 'next/server'
import { generateReport, toCSV } from '@lib/reports'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const report_type = body.report_type as string
  const format = (body.format || 'csv') as string
  const params = body.params || {}
  const async = !!body.async
  if (!org_id || !report_type) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (async) {
    const sb = isSupabaseConfigured() ? supabaseServer() : null
    if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
    const now = new Date()
    const { data, error } = await sb.from('report_jobs').insert({ org_id, created_by: req.headers.get('x-user-id') || null, report_type, params, status: 'pending', created_at: now }).select('*').single()
    if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
    return NextResponse.json({ job_id: data.id, status: data.status })
  }
  const res = await generateReport(org_id, report_type as any, params)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  if (format !== 'csv') return NextResponse.json({ error: 'FORMAT_NOT_SUPPORTED', message: 'Only csv supported currently' }, { status: 400 })
  const csv = toCSV(res.rows, res.headers)
  const filename = `${report_type}_${params.date_start || ''}_${params.date_end || ''}.csv`.replace(/[^a-zA-Z0-9_\.\-]/g,'_')
  return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${filename}"` } })
}
