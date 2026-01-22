import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  const q = searchParams.get('q')
  const status = searchParams.get('status')
  const deptId = searchParams.get('deptId')
  const roleId = searchParams.get('role') // member_role_id
  const sort = searchParams.get('sort')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50') // Default to 50 to avoid breaking if client expects all

  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })

  const sb = supabaseServer()
  
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = sb
    .from('users')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  if (status) {
    if (status.includes(',')) {
      query = query.in('status', status.split(','))
    } else {
      query = query.eq('status', status)
    }
  }

  if (deptId) {
    query = query.eq('department_id', deptId)
  }

  if (roleId) {
    query = query.eq('member_role_id', roleId)
  }

  if (sort) {
    const [field, direction] = sort.split(':')
    // Map camelCase to snake_case if needed
    const dbField = field === 'createdAt' ? 'created_at' : field
    query = query.order(dbField, { ascending: direction === 'asc' })
  } else {
    query = query.order('first_name', { ascending: true })
  }

  // Only paginate if explicitly requested or if we are implementing the new system
  // To stay backward compatible with "listAll", we might need to return all if no page is specified?
  // But I defaulted page to 1. 
  // If the existing frontend expects ALL users, pagination might break it.
  // The user requirement is "Add a consistent filtering + advanced search system".
  // I should update the frontend to handle pagination.
  
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (data || []).map((u: any) => ({
    id: u.id,
    orgId: u.org_id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    roleId: u.role_id,
    departmentId: u.department_id,
    memberRoleId: u.member_role_id,
    managerId: u.manager_id,
    positionTitle: u.position_title,
    profileImage: u.profile_image,
    salary: u.salary ? Number(u.salary) : undefined,
    workingDays: u.working_days || [],
    workingHoursPerDay: u.working_hours_per_day ? Number(u.working_hours_per_day) : undefined,
    status: u.status,
    createdAt: new Date(u.created_at).getTime(),
    themeBgMain: u.theme_bg_main,
    themeAccent: u.theme_accent,
    layoutType: u.layout_type
  }))

  return NextResponse.json({ 
    items,
    total: count,
    page,
    pageSize
  })
}
