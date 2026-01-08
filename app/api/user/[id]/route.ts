import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@lib/db'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  // Try direct Supabase query first to ensure we get fresh data
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('users').select('*').eq('id', params.id).single()
    if (data) {
       // Map manually to ensure consistency
       const u = {
         id: data.id,
         firstName: data.first_name,
         lastName: data.last_name,
         email: data.email,
         profileImage: data.profile_image, // Direct mapping
         roleId: data.role_id,
         departmentId: data.department_id,
         status: data.status,
         themeBgMain: data.theme_bg_main,
         themeAccent: data.theme_accent,
         layoutType: data.layout_type
       }
       return NextResponse.json({ user: u, meta: { source: 'supabase-direct' } })
    }
  }

  // Fallback to library function
  const user = await getUser(params.id)
  if (!user) return NextResponse.json({ error: 'USER_NOT_FOUND', meta: { source: 'memory-fallback' } }, { status: 404 })
  return NextResponse.json({ user, meta: { source: 'memory' } })
}

