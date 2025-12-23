import { NextRequest, NextResponse } from 'next/server'
import { getUser, listAllOrgMembers, updateUser } from '@lib/db'

function detectCycle(users: any[], memberId: string, newManagerId: string): boolean {
  const children = new Map<string, string[]>()
  for (const u of users) {
    const mgr = u.managerId || ''
    if (!mgr) continue
    const arr = children.get(mgr) || []
    arr.push(u.id)
    children.set(mgr, arr)
  }
  const stack: string[] = [memberId]
  const visited = new Set<string>()
  while (stack.length) {
    const cur = stack.pop() as string
    if (cur === newManagerId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    const subs = children.get(cur) || []
    for (const s of subs) stack.push(s)
  }
  return false
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const department_id = body.department_id ?? body.departmentId
  const member_role_id = body.role_id ?? body.member_role_id ?? body.memberRoleId
  const manager_id = body.manager_id ?? body.managerId
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const target = await getUser(params.id)
  if (!target || target.orgId !== org_id) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  if (manager_id === params.id) return NextResponse.json({ error: 'INVALID_MANAGER_SELF' }, { status: 400 })
  const orgUsers = await listAllOrgMembers(org_id)
  if (manager_id) {
    const mgr = orgUsers.find(u => u.id === manager_id)
    if (!mgr) return NextResponse.json({ error: 'MANAGER_NOT_FOUND' }, { status: 404 })
    if (detectCycle(orgUsers, params.id, manager_id)) return NextResponse.json({ error: 'CYCLIC_RELATIONSHIP' }, { status: 400 })
  }
  const res = await updateUser(params.id, { departmentId: department_id, managerId: manager_id, memberRoleId: member_role_id })
  const codes: Record<string, number> = { DB_ERROR: 500, DEPARTMENT_NOT_FOUND: 404, ORG_MISMATCH_DEPARTMENT: 400, MANAGER_NOT_FOUND: 404, ORG_MISMATCH_MANAGER: 400, MEMBER_ROLE_NOT_FOUND: 404, ORG_MISMATCH_MEMBER_ROLE: 400 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  if (!res) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ user: res })
}

