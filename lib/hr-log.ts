import { supabaseServer } from './supabase'

export type HRLogParams = {
  org_id: string
  actor_user_id: string
  actor_role: string
  employee_user_id: string
  module: string
  entity_table: string
  entity_id?: string
  field_name: string
  old_value: any
  new_value: any
  reason: string
  attachment_path?: string
  metadata?: any
}

export async function createHRLog(params: HRLogParams) {
  const sb = supabaseServer()
  
  const { error } = await sb.from('hr_adjustments_log').insert({
    org_id: params.org_id,
    actor_user_id: params.actor_user_id,
    actor_role: params.actor_role,
    employee_user_id: params.employee_user_id,
    module: params.module,
    entity_table: params.entity_table,
    entity_id: params.entity_id || null,
    field_name: params.field_name,
    old_value: params.old_value,
    new_value: params.new_value,
    reason: params.reason,
    attachment_path: params.attachment_path || null,
    metadata: params.metadata || {}
  })

  if (error) {
    console.error('Failed to create HR log:', error)
    return { error }
  }
  return { success: true }
}
