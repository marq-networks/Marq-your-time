export type SubscriptionType = 'monthly' | 'yearly'
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

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
