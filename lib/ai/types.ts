export type InsightSeverity = 'info' | 'warning' | 'critical';
export type InsightStatus = 'active' | 'dismissed' | 'snoozed' | 'resolved';
export type InsightType = 
  | 'productivity_prediction'
  | 'anomaly_explanation'
  | 'smart_alert'
  | 'work_pattern'
  | 'coaching'
  | 'break_abuse'
  | 'salary_projection'
  | 'timesheet_correction'
  | 'analytics'
  | 'task_tagging'
  | 'role_insight';

export interface AiInsight {
  id: string;
  org_id: string;
  user_id: string | null;
  insight_type: InsightType;
  period_start: string; // ISO date
  period_end: string; // ISO date
  severity: InsightSeverity;
  title: string;
  summary: string;
  details: Record<string, any>;
  confidence: number;
  recommended_actions: Record<string, any> | null;
  status: InsightStatus;
  created_at: string;
}

export interface AiAlertRule {
  id: string;
  org_id: string;
  rule_key: string;
  enabled: boolean;
  thresholds: Record<string, number>;
  notify_roles: string[];
  notify_employee: boolean;
  created_at: string;
}

export type CandidateType = 
  | 'missing_checkout'
  | 'break_overlimit'
  | 'idle_adjustment_suggestion'
  | 'duplicate_session'
  | 'timezone_mismatch';

export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'applied';

export interface AiTimesheetCandidate {
  id: string;
  org_id: string;
  user_id: string;
  timesheet_id: string;
  candidate_type: CandidateType;
  proposed_changes: Record<string, any>;
  reason: string;
  confidence: number;
  status: CandidateStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AiTaskTag {
  id: string;
  org_id: string;
  user_id: string;
  source_type: 'app' | 'website' | 'manual_task' | 'project';
  source_value: string;
  tag: string;
  confidence: number;
  created_at: string;
}
