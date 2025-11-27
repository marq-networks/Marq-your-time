export type SubscriptionType = 'monthly' | 'yearly'
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type UserStatus = 'active' | 'inactive' | 'suspended'
export type Permission =
  | 'manage_org'
  | 'manage_users'
  | 'manage_time'
  | 'manage_screenshots'
  | 'manage_salary'
  | 'manage_fines'
  | 'manage_reports'
  | 'manage_settings'

export interface Organization {
  id: string
  orgName: string
  orgLogo?: string
  ownerName: string
  ownerEmail: string
  billingEmail: string
  subscriptionType: SubscriptionType
  pricePerLogin: number
  totalLicensedSeats: number
  usedSeats: number
  createdAt: number
  updatedAt: number
}

export interface OrganizationInvite {
  id: string
  invitedEmail: string
  orgId: string
  invitedBy: string
  role: string
  inviteStatus: InviteStatus
  createdAt: number
  expiresAt: number
  token: string
  assignSeat: boolean
}

export interface SaaSSettings {
  id: string
  defaultSeatPrice: number
  defaultSeatLimit: number
  landingPageInviteEnabled: boolean
}

export interface Department {
  id: string
  orgId: string
  name: string
  createdAt: number
}

export interface Role {
  id: string
  orgId: string
  name: string
  permissions: Permission[]
  createdAt: number
}

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  passwordHash: string
  roleId: string
  orgId: string
  departmentId?: string
  positionTitle?: string
  profileImage?: string
  salary?: number
  workingDays: string[]
  workingHoursPerDay?: number
  status: UserStatus
  createdAt: number
  updatedAt: number
}
