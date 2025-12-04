import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const job_id = searchParams.get('job_id') || ''
  if (!job_id) return NextResponse.json({ error: 'MISSING_JOB_ID' }, { status: 400 })
  if (!isSupabaseConfigured()) return NextResponse.json({ status: 'not_supported' }, { status: 400 })
  const sb = supabaseServer()
  const { data } = await sb.from('report_jobs').select('*').eq('id', job_id).maybeSingle()
  if (!data) return NextResponse.json({ status: 'not_found' }, { status: 404 })
  return NextResponse.json({ status: data.status, file_url: data.file_url || null, error_message: data.error_message || null })
}

