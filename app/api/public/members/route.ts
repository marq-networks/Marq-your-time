import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

export async function GET(req: NextRequest) {
  const client = await authenticatePublicApi(req)
  if (!client) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasScope(client.scopes, 'read:members')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200)
  const cursor = searchParams.get('cursor') || ''
  const status = searchParams.get('status') || ''
  const department_id = searchParams.get('department_id') || ''
  let q = sb.from('users').select('*').eq('org_id', client.orgId).order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)
  if (department_id) q = q.eq('department_id', department_id)
  if (cursor) q = q.lt('created_at', cursor)
  const { data: users } = await q
  const nextCursor = (users || []).length ? (users![users!.length - 1] as any).created_at : null
  const roleIds = Array.from(new Set((users || []).map((u: any) => u.role_id).filter(Boolean)))
  const deptIds = Array.from(new Set((users || []).map((u: any) => u.department_id).filter(Boolean)))
  const { data: roles } = roleIds.length ? await sb.from('roles').select('*').in('id', roleIds) : { data: [] }
  const { data: depts } = deptIds.length ? await sb.from('departments').select('*').in('id', deptIds) : { data: [] }
  const roleMap = new Map((roles || []).map((r: any) => [String(r.id), r.name]))
  const deptMap = new Map((depts || []).map((d: any) => [String(d.id), d.name]))
  const items = (users || []).map((u: any) => ({
    id: u.id,
    name: `${u.first_name} ${u.last_name}`.trim(),
    email: u.email,
    department: u.department_id ? (deptMap.get(String(u.department_id)) || '') : '',
    status: u.status,
    role: u.role_id ? (roleMap.get(String(u.role_id)) || '') : ''
  }))
  return NextResponse.json({ items, next_cursor: nextCursor })
}
