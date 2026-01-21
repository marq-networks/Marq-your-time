import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('org_id')
    const employeeUserId = searchParams.get('employee_user_id')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    if (!orgId) return NextResponse.json({ error: 'Org ID required' }, { status: 400 })

    const sb = supabaseServer()
    let query = sb.from('timesheets').select('*, employees:employee_user_id(first_name, last_name)').eq('org_id', orgId).order('period_start', { ascending: false })

    if (employeeUserId) query = query.eq('employee_user_id', employeeUserId)
    if (status) query = query.eq('status', status)
    if (startDate) query = query.gte('period_start', startDate)
    if (endDate) query = query.lte('period_end', endDate)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ items: data })
  } catch (error: any) {
    console.error('List timesheets error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
