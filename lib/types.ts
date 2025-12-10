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
  description?: string
  parentId?: string
  createdAt: number
  updatedAt?: number
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
  managerId?: string
  memberRoleId?: string
  positionTitle?: string
  profileImage?: string
  salary?: number
  workingDays: string[]
  workingHoursPerDay?: number
  status: UserStatus
  createdAt: number
  updatedAt: number
}

export interface MemberRole {
  id: string
  orgId: string
  name: string
  level: number
  createdAt: number
}

export interface OrgMembership {
  id: string
  userId: string
  orgId: string
  role: 'owner' | 'admin' | 'manager' | 'member'
  createdAt: number
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
  isHoliday?: boolean
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

export interface HolidayCalendar {
  id: string
  orgId: string
  name: string
  countryCode?: string
  createdAt: number
}

export interface Holiday {
  id: string
  calendarId: string
  date: string
  name: string
  isFullDay: boolean
  createdAt: number
}

export type NotificationType = 'system' | 'attendance' | 'payroll' | 'device' | 'agent' | 'billing'
export interface NotificationItem {
  id: string
  orgId: string
  memberId?: string
  type: NotificationType
  title: string
  message: string
  meta?: any
  isRead: boolean
  createdAt: number
}

export interface NotificationPreferences {
  id: string
  memberId: string
  emailEnabled: boolean
  inappEnabled: boolean
  createdAt: number
  updatedAt: number
}

export type NotificationChannel = 'in_app' | 'email'
export interface EventNotificationPreference {
  id: string
  userId: string
  eventType: string
  channel: NotificationChannel
  enabled: boolean
  createdAt: number
}

export type DigestFrequency = 'none' | 'daily' | 'weekly'

export type TimesheetRequestStatus = 'pending' | 'approved' | 'rejected'
export interface Survey {
  id: string
  orgId: string
  title: string
  description?: string
  isAnonymous: boolean
  createdBy: string
  createdAt: number
  closesAt?: number
}

export type SurveyQuestionType = 'scale' | 'text' | 'mcq'
export interface SurveyQuestion {
  id: string
  surveyId: string
  questionType: SurveyQuestionType
  questionText: string
  options?: string[]
}

export interface SurveyResponse {
  id: string
  surveyId: string
  questionId: string
  memberId?: string
  orgId: string
  answerText?: string
  answerNumeric?: number
  createdAt: number
}
export interface TimesheetChangeRequest {
  id: string
  orgId: string
  memberId: string
  requestedBy: string
  status: TimesheetRequestStatus
  reason: string
  createdAt: number
  reviewedAt?: number
  reviewedBy?: string
}

export interface TimesheetChangeItem {
  id: string
  changeRequestId: string
  targetDate: string
  originalStart?: number
  originalEnd?: number
  originalMinutes?: number
  newStart?: number
  newEnd?: number
  newMinutes?: number
  note?: string
}

export type TimesheetAuditAction = 'request' | 'approve' | 'reject' | 'apply'
export interface TimesheetAuditLog {
  id: string
  orgId: string
  memberId: string
  actorId: string
  actionType: TimesheetAuditAction
  details: any
  createdAt: number
}

export interface Shift {
  id: string
  orgId: string
  name: string
  startTime: string
  endTime: string
  isOvernight: boolean
  graceMinutes: number
  breakMinutes: number
  createdAt: number
}

export interface ShiftAssignment {
  id: string
  memberId: string
  shiftId: string
  effectiveFrom: string
  effectiveTo?: string
  createdAt: number
}

export type MFAType = 'email_otp' | 'totp'
export interface MFASettings {
  id: string
  userId: string
  mfaType: MFAType
  secret?: string
  isEnabled: boolean
  createdAt: number
}

export interface OrgSecurityPolicy {
  id: string
  orgId: string
  requireMfa: boolean
  sessionTimeoutMinutes?: number
  allowedIpRanges?: string[]
  createdAt: number
  ssoProvider?: 'saml' | 'oidc' | string
  ssoMetadataUrl?: string
  ssoClientId?: string
}

export interface TrustedDevice {
  id: string
  userId: string
  deviceLabel?: string
  lastIp?: string
  lastUsedAt?: number
  createdAt: number
}

export type AssetCategory = 'laptop' | 'monitor' | 'phone' | 'license' | 'other'
export type AssetStatus = 'in_use' | 'in_stock' | 'retired' | 'lost'
export interface Asset {
  id: string
  orgId: string
  assetTag: string
  category: AssetCategory
  model?: string
  serialNumber?: string
  purchaseDate?: string
  warrantyEnd?: string
  status: AssetStatus
  createdAt: number
}

export interface AssetAssignment {
  id: string
  assetId: string
  memberId?: string
  assignedAt: number
  returnedAt?: number
}

export interface DataRetentionPolicy {
  id: string
  orgId: string
  category: string
  retentionDays: number
  hardDelete: boolean
  createdAt: number
}

export type PrivacyRequestType = 'export' | 'anonymize' | 'delete'
export type PrivacyRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'
export interface PrivacyRequest {
  id: string
  orgId: string
  userId?: string
  subjectType: string
  subjectId: string
  requestType: PrivacyRequestType
  status: PrivacyRequestStatus
  createdAt: number
  processedAt?: number
  processedBy?: string
  notes?: string
}

export interface AuditLog {
  id: string
  orgId: string
  actorUserId?: string
  actorIp?: string
  actorUserAgent?: string
  eventType: string
  entityType?: string
  entityId?: string
  metadata?: any
  createdAt: number
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type SupportTicketPriority = 'low' | 'normal' | 'high'
export type SupportTicketCategory = 'hr' | 'it' | 'payroll' | 'other'
export interface SupportTicket {
  id: string
  orgId: string
  createdByUserId: string
  category: SupportTicketCategory | string
  title: string
  description?: string
  status: SupportTicketStatus | string
  priority: SupportTicketPriority | string
  assignedToUserId?: string
  createdAt: number
  updatedAt: number
}
export interface SupportComment {
  id: string
  ticketId: string
  userId: string
  body: string
  createdAt: number
}

export interface AIInsightSnapshot {
  id: string
  orgId: string
  targetType: 'org' | 'department' | 'member'
  targetId?: string
  snapshotDate: string
  summary?: string
  metadata?: any
  createdAt: number
}
