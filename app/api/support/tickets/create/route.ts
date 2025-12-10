import { NextRequest, NextResponse } from 'next/server'
import { createSupportTicket, publishNotification } from '@lib/db'

function allow(role: string) { return ['employee','manager','admin','owner','hr','it','super_admin'].includes(role.toLowerCase()) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const created_by_user_id = body.created_by_user_id || body.createdByUserId || actor
  const category = body.category
  const title = body.title
  const description = body.description || null
  const priority = body.priority || 'normal'
  if (!org_id || !created_by_user_id || !category || !title) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createSupportTicket({ orgId: org_id, createdByUserId: created_by_user_id, category, title, description: description ?? undefined, priority })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  try { await publishNotification({ orgId: org_id, type: 'system', title: 'New support ticket', message: title, meta: { ticket_id: res.id, category, priority } }) } catch {}
  return NextResponse.json({ ticket: res })
}

