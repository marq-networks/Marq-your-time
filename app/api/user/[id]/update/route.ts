import { NextRequest, NextResponse } from 'next/server'
import { updateUser, getUser, listRoles } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = await req.json()
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_users') : false
  const self = actor && actor === params.id
  const patchKeys = Object.keys(patch || {})
  const onlyTheme =
    patchKeys.length > 0 &&
    patchKeys.every(k => ['themeBgMain','themeAccent','layoutType'].includes(k))
  if (!allowed && !self) {
    return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  }
  if (!allowed && self && !onlyTheme) {
    return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You may only update your display settings.' }, { status: 403 })
  }
  if (actor && patch.roleId) {
    const target = await getUser(params.id)
    if (target && actor === target.id) {
      const roles = await listRoles(target.orgId)
      const newRole = roles.find(r => r.id === patch.roleId)
      const required: ('manage_org'|'manage_users'|'manage_settings')[] = ['manage_org','manage_users','manage_settings']
      const perms = Array.isArray(newRole?.permissions) ? newRole!.permissions : []
      const ok = required.every(k => perms.includes(k))
      if (!ok) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
    }
  }
  const res = await updateUser(params.id, patch)
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (res === 'ROLE_NOT_FOUND' || res === 'DEPARTMENT_NOT_FOUND' || res === 'ORG_MISMATCH_ROLE' || res === 'ORG_MISMATCH_DEPARTMENT') return NextResponse.json({ error: res }, { status: 400 })
  if (!res) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ user: res })
}
import { checkPermission } from '@lib/permissions'
