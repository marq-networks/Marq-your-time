import { Permission } from '@lib/types'

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const cookies = document.cookie.split(';').map(c => c.trim())
  for (const c of cookies) {
    if (c.startsWith(name + '=')) return decodeURIComponent(c.slice(name.length + 1))
  }
  return undefined
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  employee: ['manage_time','manage_reports'],
  member: ['manage_time','manage_reports'],
  manager: ['manage_time','manage_reports','manage_users'],
  admin: ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings'],
  owner: ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings'],
  super_admin: ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings'],
}

export default function usePermission(permissionKey: Permission) {
  const role = (getCookie('current_role') || '').toLowerCase()
  const allowedPerms = ROLE_PERMISSIONS[role] || []
  const allowed = allowedPerms.includes(permissionKey)
  return { allowed }
}
