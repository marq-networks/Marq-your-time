import { supabaseServer } from '@/lib/supabase'
import { getDailySummaries, getActivityStats, getBreaks, getTimeSessions, getPayrollInfo, getRoleAverageStats } from './metrics'
import { AiInsight, AiTimesheetCandidate, InsightType, InsightSeverity } from './types'

// Helpers
const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const formatDate = (date: Date) => date.toISOString().split('T')[0]

// Main Runner
export async function runAiInsights(orgId: string, periodType: 'daily' | 'weekly') {
  const sb = supabaseServer()
  const { data: users } = await sb.from('users').select('id, role').eq('org_id', orgId)
  
  if (!users) return

  const today = new Date()
  // For daily: analyze yesterday. For weekly: analyze last 7 days.
  const endDate = formatDate(addDays(today, -1))
  const startDate = periodType === 'daily' ? endDate : formatDate(addDays(today, -7))

  for (const user of users) {
    await generateInsightsForUser(orgId, user.id, user.role, startDate, endDate, periodType)
  }

  // Org-wide insights
  if (periodType === 'weekly') {
      await generateOrgWideInsights(orgId, startDate, endDate)
  }
}

async function generateInsightsForUser(orgId: string, userId: string, role: string, startDate: string, endDate: string, periodType: 'daily' | 'weekly') {
  // Fetch data
  const summaries = await getDailySummaries(orgId, userId, startDate, endDate)
  const activity = await getActivityStats(orgId, userId, startDate, endDate)
  const breaks = await getBreaks(orgId, userId, startDate, endDate)
  const sessions = await getTimeSessions(orgId, userId, startDate, endDate)

  // Run generators
  if (periodType === 'weekly') {
    await generateProductivityPrediction(orgId, userId, startDate, endDate)
    await generateWorkPatternInsights(orgId, userId, sessions, activity, startDate, endDate)
    await generateRoleBasedInsights(orgId, userId, role, summaries, startDate, endDate)
  }

  await generateAnomalyExplanation(orgId, userId, summaries, activity, startDate, endDate)
  await generateSmartAlerts(orgId, userId, summaries, activity, breaks, startDate, endDate)
  await generateCoaching(orgId, userId, activity, startDate, endDate)
  await generateBreakAbuseDetection(orgId, userId, breaks, startDate, endDate)
  await generateSalaryProjection(orgId, userId, summaries, startDate, endDate)
  await generateTimesheetCandidates(orgId, userId, sessions, breaks, startDate, endDate)
  await generateTaskTags(orgId, userId, activity)
}

// 97. Productivity Prediction
async function generateProductivityPrediction(orgId: string, userId: string, startDate: string, endDate: string) {
  const sb = supabaseServer()
  // Fetch last 4 weeks
  const fourWeeksAgo = formatDate(addDays(new Date(endDate), -28))
  const summaries = await getDailySummaries(orgId, userId, fourWeeksAgo, endDate)
  
  if (summaries.length < 14) return // Need enough data

  const workedMinutes = summaries.map(s => s.worked_minutes || 0)
  const avg = workedMinutes.reduce((a, b) => a + b, 0) / workedMinutes.length
  
  // Calculate variance for confidence
  const variance = workedMinutes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / workedMinutes.length
  const stdDev = Math.sqrt(variance)
  const cv = avg > 0 ? stdDev / avg : 0 // Coefficient of variation
  const confidence = Math.max(0.1, Math.min(0.9, 1 - cv))

  const insight: Partial<AiInsight> = {
    org_id: orgId,
    user_id: userId,
    insight_type: 'productivity_prediction',
    period_start: startDate,
    period_end: endDate,
    severity: 'info',
    title: 'Productivity Forecast',
    summary: `Predicted productivity for next week: ~${Math.round(avg / 60)} hours/day`,
    details: {
      predicted_minutes: avg,
      confidence: Number(confidence.toFixed(2)),
      trend: 'stable' // Simplified
    },
    confidence: Number(confidence.toFixed(2)),
    status: 'active'
  }

  await sb.from('ai_insights').insert(insight)
}

// 98. Anomaly Explanation
async function generateAnomalyExplanation(orgId: string, userId: string, summaries: any[], activity: any, startDate: string, endDate: string) {
  const sb = supabaseServer()
  
  // Simple check: Idle spike
  // Need baseline. For now, hardcoded simple logic or fetch prev data.
  // Assuming 'activity' contains current period stats.
  
  if (activity.idleMinutes > 120) { // Threshold
     const insight: Partial<AiInsight> = {
        org_id: orgId,
        user_id: userId,
        insight_type: 'anomaly_explanation',
        period_start: startDate,
        period_end: endDate,
        severity: 'warning',
        title: 'High Idle Time Detected',
        summary: `Idle time (${Math.round(activity.idleMinutes)}m) is higher than usual.`,
        details: { idle_minutes: activity.idleMinutes },
        confidence: 0.8,
        status: 'active'
     }
     await sb.from('ai_insights').insert(insight)
  }
}

// 99. Smart Alerts
async function generateSmartAlerts(orgId: string, userId: string, summaries: any[], activity: any, breaks: any[], startDate: string, endDate: string) {
  const sb = supabaseServer()
  const { data: rules } = await sb.from('ai_alert_rules').select('*').eq('org_id', orgId).eq('enabled', true)
  
  if (!rules) return

  for (const rule of rules) {
    const thresholds = rule.thresholds
    // idle_gt_2h
    if (rule.rule_key === 'idle_gt' && activity.idleMinutes > (thresholds.idleMinutes || 120)) {
        // Create insight
        await sb.from('ai_insights').insert({
            org_id: orgId,
            user_id: userId,
            insight_type: 'smart_alert',
            period_start: startDate,
            period_end: endDate,
            severity: 'warning',
            title: 'Idle Time Alert',
            summary: `Idle time exceeded limit: ${activity.idleMinutes}m > ${thresholds.idleMinutes}m`,
            details: { actual: activity.idleMinutes, threshold: thresholds.idleMinutes },
            confidence: 1.0,
            status: 'active'
        })
    }
    // Other rules...
  }
}

// 100. Work Pattern Insights
async function generateWorkPatternInsights(orgId: string, userId: string, sessions: any[], activity: any, startDate: string, endDate: string) {
    // Identify peak hours
    // This requires detailed session data.
    // Placeholder implementation
    const sb = supabaseServer()
    if (activity.topApps && activity.topApps.length > 0) {
        await sb.from('ai_insights').insert({
            org_id: orgId,
            user_id: userId,
            insight_type: 'work_pattern',
            period_start: startDate,
            period_end: endDate,
            severity: 'info',
            title: 'Top App Usage',
            summary: `Most used app: ${activity.topApps[0].name}`,
            details: { top_apps: activity.topApps },
            confidence: 0.9,
            status: 'active'
        })
    }
}

// Org-wide Insights
async function generateOrgWideInsights(orgId: string, startDate: string, endDate: string) {
    const sb = supabaseServer()
    
    // Fetch all daily summaries for the org in this period
    const { data: summaries } = await sb
        .from('daily_time_summaries')
        .select('worked_minutes, member_id')
        .eq('org_id', orgId)
        .gte('date', startDate)
        .lte('date', endDate)
    
    if (!summaries || summaries.length === 0) return

    const totalWorked = summaries.reduce((acc, s) => acc + (s.worked_minutes || 0), 0)
    const uniqueUsers = new Set(summaries.map(s => s.member_id)).size
    const avgPerUser = uniqueUsers > 0 ? totalWorked / uniqueUsers : 0

    // Compare with previous period (simple trend)
    // We'd need to fetch previous period data. For now, just store current stats.
    
    await sb.from('ai_insights').insert({
        org_id: orgId,
        user_id: null, // Org-wide
        insight_type: 'analytics',
        period_start: startDate,
        period_end: endDate,
        severity: 'info',
        title: 'Org Productivity Weekly',
        summary: `Average worked time: ${Math.round(avgPerUser / 60)}h per active user.`,
        details: { total_worked_minutes: totalWorked, active_users: uniqueUsers, avg_per_user: avgPerUser },
        confidence: 1.0,
        status: 'active'
    })
}

// 101. Auto-focus Coaching
async function generateCoaching(orgId: string, userId: string, activity: any, startDate: string, endDate: string) {
    const sb = supabaseServer()
    if (activity.activityPercent < 50 && activity.activityPercent > 0) {
        await sb.from('ai_insights').insert({
            org_id: orgId,
            user_id: userId,
            insight_type: 'coaching',
            period_start: startDate,
            period_end: endDate,
            severity: 'info',
            title: 'Focus Tip',
            summary: 'Activity seems low. Try using the Pomodoro technique to stay focused.',
            details: { activity_percent: activity.activityPercent },
            confidence: 0.7,
            status: 'active'
        })
    }
}

// 102. Break Abuse Detection
async function generateBreakAbuseDetection(orgId: string, userId: string, breaks: any[], startDate: string, endDate: string) {
    const sb = supabaseServer()
    // Simple check: Total break time > 60m
    const totalBreakMin = breaks.reduce((acc, b) => acc + (b.total_minutes || 0), 0)
    
    if (totalBreakMin > 60) {
        await sb.from('ai_insights').insert({
            org_id: orgId,
            user_id: userId,
            insight_type: 'break_abuse',
            period_start: startDate,
            period_end: endDate,
            severity: 'warning',
            title: 'Extended Break Time',
            summary: `Total break time (${totalBreakMin}m) exceeds typical allowances.`,
            details: { total_break_minutes: totalBreakMin },
            confidence: 0.85,
            status: 'active'
        })
    }
}

// 103. Salary Projection
async function generateSalaryProjection(orgId: string, userId: string, summaries: any[], startDate: string, endDate: string) {
    const sb = supabaseServer()
    const payroll = await getPayrollInfo(orgId, userId)
    if (!payroll) return

    const totalWorked = summaries.reduce((acc, s) => acc + (s.worked_minutes || 0), 0)
    const rate = Number(payroll.base_rate || 0)
    
    // Simple projection: worked hours * hourly rate
    // If monthly, it's more complex. Assuming hourly for now or pro-rated.
    
    let estimated = 0
    if (payroll.salary_type === 'hourly') {
        estimated = (totalWorked / 60) * rate
    } else {
        // Monthly pro-rated?
        // Just skip for now to be safe
        return
    }

    await sb.from('ai_insights').insert({
        org_id: orgId,
        user_id: userId,
        insight_type: 'salary_projection',
        period_start: startDate,
        period_end: endDate,
        severity: 'info',
        title: 'Salary Projection',
        summary: `Estimated earnings so far: ${payroll.currency} ${estimated.toFixed(2)}`,
        details: { worked_minutes: totalWorked, rate, estimated },
        confidence: 0.9,
        status: 'active'
    })
}

// 104. Auto Timesheet Correction
async function generateTimesheetCandidates(orgId: string, userId: string, sessions: any[], breaks: any[], startDate: string, endDate: string) {
    const sb = supabaseServer()
    
    for (const session of sessions) {
        // Check for missing checkout (duration > 12h or no end time and old)
        const start = new Date(session.start_time)
        const end = session.end_time ? new Date(session.end_time) : null
        
        let isMissingCheckout = false
        if (end) {
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
            if (duration > 12) isMissingCheckout = true
        } else {
            // If still open and older than 24h
            if (Date.now() - start.getTime() > 24 * 60 * 60 * 1000) isMissingCheckout = true
        }

        if (isMissingCheckout) {
             // Check if already exists
             const { data: existing } = await sb.from('ai_timesheet_candidates')
                .select('id')
                .eq('timesheet_id', session.id)
                .eq('candidate_type', 'missing_checkout')
                .single()
            
             if (!existing) {
                 await sb.from('ai_timesheet_candidates').insert({
                     org_id: orgId,
                     user_id: userId,
                     timesheet_id: session.id,
                     candidate_type: 'missing_checkout',
                     proposed_changes: { end_time: new Date(start.getTime() + 8 * 60 * 60 * 1000).toISOString() }, // Suggest 8h
                     reason: 'Session duration > 12 hours',
                     confidence: 0.8,
                     status: 'pending'
                 })
             }
        }
    }
}

// 105. AI Analytics (Handled by UI and aggregates)

// 106. AI Task Tagging
async function generateTaskTags(orgId: string, userId: string, activity: any) {
    const sb = supabaseServer()
    const { topApps } = activity
    
    // Simple rule-based tagging
    const rules: Record<string, string> = {
        'Figma': 'Design',
        'Photoshop': 'Design',
        'VS Code': 'Development',
        'Visual Studio Code': 'Development',
        'Slack': 'Communication',
        'Teams': 'Communication',
        'Outlook': 'Email',
        'Chrome': 'Research/Browsing',
        'Zoom': 'Meeting'
    }

    for (const app of topApps) {
        let tag = 'Uncategorized'
        for (const [key, value] of Object.entries(rules)) {
            if (app.name.includes(key)) {
                tag = value
                break
            }
        }

        if (tag !== 'Uncategorized') {
             // Check if tag exists
             const { data: existing } = await sb.from('ai_task_tags')
                .select('id')
                .eq('user_id', userId)
                .eq('source_value', app.name)
                .single()
             
             if (!existing) {
                 await sb.from('ai_task_tags').insert({
                     org_id: orgId,
                     user_id: userId,
                     source_type: 'app',
                     source_value: app.name,
                     tag: tag,
                     confidence: 0.9
                 })
             }
        }
    }
}

// 107. Auto Role-Based Insights
async function generateRoleBasedInsights(orgId: string, userId: string, role: string, summaries: any[], startDate: string, endDate: string) {
    if (!role) return
    const sb = supabaseServer()
    
    // Get role average
    const roleStats = await getRoleAverageStats(orgId, role, startDate, endDate)
    if (!roleStats) return

    const myTotalWorked = summaries.reduce((acc, s) => acc + (s.worked_minutes || 0), 0)
    
    // Compare
    const diff = myTotalWorked - roleStats.avgWorkedMinutes
    const percentDiff = roleStats.avgWorkedMinutes > 0 ? (diff / roleStats.avgWorkedMinutes) * 100 : 0

    if (Math.abs(percentDiff) > 15) { // Significant deviation
        const direction = diff > 0 ? 'higher' : 'lower'
        
        await sb.from('ai_insights').insert({
            org_id: orgId,
            user_id: userId,
            insight_type: 'role_insight',
            period_start: startDate,
            period_end: endDate,
            severity: 'info',
            title: 'Role Comparison',
            summary: `Your activity is ${Math.round(Math.abs(percentDiff))}% ${direction} than the average ${role}.`,
            details: { my_minutes: myTotalWorked, role_avg_minutes: roleStats.avgWorkedMinutes },
            confidence: 0.8,
            status: 'active'
        })
    }
}
