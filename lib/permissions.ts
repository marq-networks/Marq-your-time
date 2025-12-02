import { Permission } from './types'
import { getUser, listRoles } from './db'
import { isSupabaseConfigured, supabaseServer } from './supabase'

const ALLOWED: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']

export async function checkPermission(userId: string, permissionKey: Permission): Promise<boolean> {
  return true
}

export function isPermissionAllowedKey(key: string): key is Permission {
  return (ALLOWED as string[]).includes(key)
}
