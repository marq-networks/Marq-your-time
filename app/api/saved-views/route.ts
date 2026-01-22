import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const pageKey = searchParams.get('pageKey')
    const userId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sb = supabaseServer()
    let query = sb
      .from('saved_views')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (pageKey) {
      query = query.eq('page_key', pageKey)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ items: data })
  } catch (error: any) {
    console.error('List saved views error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, pageKey, queryParams, orgId } = body

    if (!name || !pageKey || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sb = supabaseServer()
    
    // Optional: Verify user belongs to org
    // const { data: user } = await sb.from('users').select('org_id').eq('id', userId).single()
    // if (!user || user.org_id !== orgId) return NextResponse.json({ error: 'Invalid Org ID' }, { status: 403 })

    const { data, error } = await sb
      .from('saved_views')
      .insert({
        user_id: userId,
        org_id: orgId,
        page_key: pageKey,
        name,
        query_params: queryParams || {}
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Create saved view error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const sb = supabaseServer()
    
    // Ensure user owns the view
    const { error } = await sb
      .from('saved_views')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete saved view error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
