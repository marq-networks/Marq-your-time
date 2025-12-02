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

export type TimeSessionStatus = 'open' | 'closed' | 'cancelled'
export interface TimeSession {
  id: string
  memberId: string
  orgId: string
  date: string
  startTime: number
  endTime?: number
  source: string
  status: TimeSessionStatus
  totalMinutes?: number
  cancelReason?: string
  createdAt: number
  updatedAt: number
}

export interface BreakSession {
  id: string
  timeSessionId: string
  breakRuleId?: string
  label: string
  startTime: number
  endTime?: number
  totalMinutes?: number
  isPaid: boolean
  createdAt: number
  updatedAt: number
}

export type DailyStatus = 'normal' | 'extra' | 'short' | 'absent' | 'unconfigured'
export interface DailyTimeSummary {
  id: string
  memberId: string
  orgId: string
  date: string
  workPatternId?: string
  scheduledMinutes: number
  workedMinutes: number
  paidBreakMinutes: number
  unpaidBreakMinutes: number
  extraMinutes: number
  shortMinutes: number
  status: DailyStatus
  createdAt: number
  updatedAt: number
}

export type AnomalyType = 'missing_checkout' | 'overlap' | 'too_long'
export interface TimeAnomaly {
  id: string
  memberId: string
  orgId: string
  date: string
  type: AnomalyType | string
  details: string
  resolved: boolean
  createdAt: number
  updatedAt: number
}

export interface MemberPrivacySettings {
  id: string
  memberId: string
  orgId: string
  allowActivityTracking: boolean
  allowScreenshots: boolean
  maskPersonalWindows: boolean
  lastUpdatedBy?: string
  updatedAt: number
}

export interface TrackingSession {
  id: string
  timeSessionId: string
  memberId: string
  orgId: string
  startedAt: number
  endedAt?: number
  consentGiven: boolean
  consentText?: string
  createdAt: number
}

export interface ActivityEvent {
  id: string
  trackingSessionId: string
  timestamp: number
  appName: string
  windowTitle: string
  url?: string
  category?: string
  isActive: boolean
  keyboardActivityScore?: number
  mouseActivityScore?: number
  createdAt: number
}

export interface ActivityAppAlias {
  id: string
  orgId?: string
  matchType: 'contains' | 'equals' | 'regex'
  pattern: string
  category: 'productive' | 'neutral' | 'unproductive'
  label: string
  createdAt: number
  updatedAt: number
}

export interface ScreenshotMeta {
  id: string
  trackingSessionId: string
  timestamp: number
  storagePath: string
  thumbnailPath: string
  blurLevel: number
  wasMasked: boolean
  createdAt: number
}

export type SalaryType = 'monthly' | 'hourly' | 'daily'
export interface PayrollPeriod {
  id: string
  orgId: string
  name: string
  startDate: string
  endDate: string
  status: 'open' | 'locked' | 'exported'
  createdBy: string
  createdAt: number
  lockedAt?: number
  exportedAt?: number
}

export interface MemberPayrollLine {
  id: string
  payrollPeriodId: string
  memberId: string
  orgId: string
  totalScheduledMinutes: number
  totalWorkedMinutes: number
  totalExtraMinutes: number
  totalShortMinutes: number
  daysPresent: number
  daysAbsent: number
  salaryType: SalaryType
  baseRate: number
  currency: string
  baseEarnings: number
  extraEarnings: number
  deductionForShort: number
  finesTotal: number
  adjustmentsTotal: number
  netPayable: number
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface MemberFine {
  id: string
  memberId: string
  orgId: string
  date: string
  reason: string
  amount: number
  currency: string
  createdBy: string
  createdAt: number
}

export interface MemberAdjustment {
  id: string
  memberId: string
  orgId: string
  date: string
  reason: string
  amount: number
  currency: string
  createdBy: string
  createdAt: number
}
