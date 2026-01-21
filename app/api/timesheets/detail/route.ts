import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const sb = supabaseServer()
    
    // Get timesheet
    const { data: timesheet, error: tsError } = await sb
      .from('timesheets')
      .select('*, employees:employee_user_id(first_name, last_name, email, profile_image)')
      .eq('id', id)
      .single()

    if (tsError) throw tsError

    // Get items
    const { data: items, error: itemsError } = await sb
      .from('timesheet_items')
      .select('*')
      .eq('timesheet_id', id)
      .order('date', { ascending: true })

    if (itemsError) throw itemsError

    return NextResponse.json({ ...timesheet, items })
  } catch (error: any) {
    console.error('Get timesheet detail error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
