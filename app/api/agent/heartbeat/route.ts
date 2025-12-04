import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

function allow(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (auth.toLowerCase().startsWith('bearer ')) return true
  const allowed = ['admin','manager','owner','super_admin']
  return allowed.includes(role)
}

function cmp(a: string, b: string) {
  const pa = (a || '').split('.')
  const pb = (b || '').split('.')
  for (let i = 0; i < 3; i++) {
    const ai = parseInt(pa[i] || '0', 10)
    const bi = parseInt(pb[i] || '0', 10)
    if (ai > bi) return 1
    if (ai < bi) return -1
  }
  return 0
}

export async function POST(req: NextRequest) {
  if (!allow(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await req.json().catch(()=>({}))
  const device_id = body.device_id || body.deviceId
  const org_id = body.org_id || body.orgId
  const member_id = body.member_id || body.memberId || null
  const device_name = body.device_name || body.deviceName || null
  const device_os = body.device_os || body.deviceOs || null
  const agent_version = body.agent_version || req.headers.get('x-agent-version') || null
  if (!device_id || !org_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  const now = new Date()
  const { data: settings } = await sb.from('platform_settings').select('*').eq('key','agent_minimum_version').limit(1).maybeSingle()
  const min = settings?.value_json?.minimum_version || '1.0.0'
  const dl = settings?.value_json?.download_url || ''
  const blockBelow = !!settings?.value_json?.block_below
  let status: 'ok'|'outdated'|'blocked'|null = null
  let required = false
  if (agent_version) {
    const rel = cmp(agent_version, min)
    if (rel < 0) { status = blockBelow ? 'blocked' : 'outdated'; required = true }
    else status = 'ok'
  }
  const payload: any = {
    org_id,
    member_id: member_id ?? null,
    device_id,
    device_name: device_name ?? null,
    device_os: device_os ?? null,
    last_seen: now,
    updated_at: now
  }
  if (agent_version) {
    payload.agent_version = agent_version
    payload.last_version_check_at = now
    payload.update_status = status
  }
  await sb.from('devices').upsert(payload, { onConflict: 'org_id,device_id' })
  const update = { required, minimum_version: min, download_url: dl }
  return NextResponse.json({ status: 'ok', update })
}

