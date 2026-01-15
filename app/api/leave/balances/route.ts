import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listTypes as memListTypes, getBalance as memGetBalance, seedDefaultTypesIfEmpty } from '@lib/memory/leave'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || ''
  if (!org_id || !member_id) return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) {
    seedDefaultTypesIfEmpty(org_id)
    const types = memListTypes(org_id)
    const items = types.map((t: any) => ({
      leave_type_id: t.id,
      code: t.code,
      name: t.name,
      paid: !!t.paid,
      default_days_per_year: Number(t.default_days_per_year || 0),
      monthly_accrual: Number(t.monthly_accrual || 0),
      allow_negative: !!t.allow_negative,
      balance: memGetBalance(member_id, t.id)
    }))
    return NextResponse.json({ items })
  }
  const { data: types } = await sb.from('leave_types').select('*').eq('org_id', org_id).eq('is_active', true)
  const typeIds = (types || []).map((t: any) => t.id)
  const { data: balances } = await sb.from('employee_leave_balance').select('*').eq('user_id', member_id).in('leave_type_id', typeIds)
  const balMap = new Map((balances || []).map((b: any) => [String(b.leave_type_id), Number(b.balance || 0)]))
  const items = (types || []).map((t: any) => ({
    leave_type_id: t.id,
    code: t.code,
    name: t.name,
    paid: !!t.paid,
    default_days_per_year: Number(t.default_days_per_year || 0),
    monthly_accrual: Number(t.monthly_accrual || 0),
    allow_negative: !!t.allow_negative,
    balance: balMap.has(String(t.id)) ? balMap.get(String(t.id))! : Number(t.default_days_per_year || 0)
  }))
  return NextResponse.json({ items })
}

