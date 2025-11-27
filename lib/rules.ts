import { Organization, OrganizationInvite } from './types'

export function canConsumeSeat(org: Organization) {
  return org.usedSeats < org.totalLicensedSeats
}

export function canReduceSeats(org: Organization, newTotal: number) {
  return newTotal >= org.usedSeats
}

export function isInviteExpired(inv: OrganizationInvite) {
  return Date.now() > inv.expiresAt
}

export function inviteWindowHours() { return 72 }
