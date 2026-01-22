import { supabaseServer } from '@/lib/supabase'
import { AiInsight, InsightType, InsightSeverity, InsightStatus } from './types'

export async function listAiInsights(params: {
  orgId: string
  userId?: string // If provided, filter by user. If null, might return org-wide?
  insightType?: InsightType
  severity?: InsightSeverity
  status?: InsightStatus
  startDate?: string
  endDate?: string
  limit?: number
}) {
  const sb = supabaseServer()
  let q = sb.from('ai_insights').select('*').eq('org_id', params.orgId)

  if (params.userId) {
    q = q.eq('user_id', params.userId)
  } else if (params.userId === null) {
      // If explicit null passed, maybe we want org-wide only? 
      // Or just ignore. The caller should handle logic.
      // If we want ONLY org-wide insights (where user_id is null)
      q = q.is('user_id', null)
  }

  if (params.insightType) q = q.eq('insight_type', params.insightType)
  if (params.severity) q = q.eq('severity', params.severity)
  if (params.status) q = q.eq('status', params.status)
  
  if (params.startDate) q = q.gte('period_start', params.startDate)
  if (params.endDate) q = q.lte('period_end', params.endDate)

  q = q.order('created_at', { ascending: false }).limit(params.limit || 100)

  const { data, error } = await q
  if (error) throw error
  return data as AiInsight[]
}

export async function getOrgWideAnalytics(orgId: string, startDate: string, endDate: string) {
    // Fetch org-wide insights specifically
    return listAiInsights({
        orgId,
        userId: null as any, // Filter for user_id IS NULL
        insightType: 'analytics',
        startDate,
        endDate
    })
}
