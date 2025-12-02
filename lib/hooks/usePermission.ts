import { Permission } from '@lib/types'

export default function usePermission(permissionKey: Permission) {
  return { allowed: true }
}
