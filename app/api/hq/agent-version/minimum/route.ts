import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ minimum_version: '1.0.0', download_url: '', block_below: false })
  const { data } = await sb.from('platform_settings').select('*').eq('key','agent_minimum_version').limit(1).maybeSingle()
  const v = data?.value_json || { minimum_version: '1.0.0', download_url: '', block_below: false }
  return NextResponse.json({ minimum_version: v.minimum_version || '1.0.0', download_url: v.download_url || '', block_below: !!v.block_below })
}

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) {
    const body = await req.json().catch(()=>({}))
    const minimum_version = body.minimum_version || body.minimumVersion
    const download_url = body.download_url || body.downloadUrl || ''
    const block_below = !!(body.block_below ?? body.blockBelow)
    if (!minimum_version) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    return NextResponse.json({ minimum_version, download_url, block_below })
  }
  const body = await req.json().catch(()=>({}))
  const minimum_version = body.minimum_version || body.minimumVersion
  const download_url = body.download_url || body.downloadUrl || ''
  const block_below = !!(body.block_below ?? body.blockBelow)
  if (!minimum_version) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const now = new Date()
  const { data: existing } = await sb.from('platform_settings').select('*').eq('key','agent_minimum_version').limit(1).maybeSingle()
  const value_json = { minimum_version, download_url, block_below }
  if (existing) {
    await sb.from('platform_settings').update({ value_json, updated_at: now }).eq('id', existing.id)
  } else {
    await sb.from('platform_settings').insert({ key: 'agent_minimum_version', value_json, created_at: now, updated_at: now })
  }
  return NextResponse.json({ minimum_version, download_url, block_below })
}
