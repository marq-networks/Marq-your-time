import { Permission } from './types'
import { getUser, listRoles } from './db'
import { isSupabaseConfigured, supabaseServer } from './supabase'

const ALLOWED: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']

export async function checkPermission(userId: string, permissionKey: Permission): Promise<boolean> {
  try {
    if (!userId) return false
    if (isSupabaseConfigured()) {
      const sb = supabaseServer()
      const { data: u } = await sb.from('users').select('id, role_id, is_super_admin').eq('id', userId).limit(1).maybeSingle()
      if (!u) return false
      if (u.is_super_admin) return true
      const { data: r } = await sb.from('roles').select('permissions').eq('id', u.role_id).limit(1).maybeSingle()
      const perms: Permission[] = ((r?.permissions ?? []) as any[]).filter(p => (ALLOWED as any).includes(p)) as Permission[]
      return perms.includes(permissionKey)
    }
    const u = await getUser(userId)
    if (!u) return false
    const roles = await listRoles(u.orgId)
    const r = roles.find(rr => rr.id === u.roleId)
    const perms: Permission[] = (r?.permissions ?? []).filter(p => (ALLOWED as any).includes(p)) as Permission[]
    return perms.includes(permissionKey)
  } catch {
    return false
  }
}

export function isPermissionAllowedKey(key: string): key is Permission {
  return (ALLOWED as string[]).includes(key)
}

export function normalizeRoleForApi(role: string): string {
  const r = (role || '').toLowerCase()
  if (r === 'employee') return 'member'
  if (r === 'partner') return 'super_admin'
  if (r === 'org_admin') return 'admin'
  return r
}
