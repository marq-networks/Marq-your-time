import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('org_id') || searchParams.get('orgId')
    const q = searchParams.get('q')
    const userIds = searchParams.get('userIds')
    const employeeUserId = searchParams.get('employee_user_id') // legacy support
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date') || searchParams.get('from')
    const endDate = searchParams.get('end_date') || searchParams.get('to')
    const sort = searchParams.get('sort')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    
    if (!orgId) return NextResponse.json({ error: 'Org ID required' }, { status: 400 })

    const sb = supabaseServer()
    
    // Use !inner join if filtering by employee name to ensure we only get matches
    const selectStr = q 
      ? '*, employees!inner(first_name, last_name, email)' 
      : '*, employees:employee_user_id(first_name, last_name, email)'

    let query = sb
      .from('timesheets')
      .select(selectStr, { count: 'exact' })
      .eq('org_id', orgId)

    if (q) {
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`, { foreignTable: 'employees' })
    }

    if (userIds) {
      const ids = userIds.split(',').filter(Boolean)
      if (ids.length > 0) query = query.in('employee_user_id', ids)
    }

    if (employeeUserId) {
      query = query.eq('employee_user_id', employeeUserId)
    }

    if (status) {
      const statuses = status.split(',').filter(Boolean)
      if (statuses.length > 0) query = query.in('status', statuses)
    }

    if (startDate) {
      query = query.gte('period_start', startDate)
    }

    if (endDate) {
      query = query.lte('period_end', endDate)
    }

    // Anomaly Filters
    const idleGt = parseInt(searchParams.get('idle_gt') || '0')
    const overtimeGt = parseInt(searchParams.get('overtime_gt') || '0')
    const missingScreenshots = searchParams.get('missing_screenshots') === 'true'

    // Note: totals is a JSONB column. We need to cast values to int for comparison.
    // Supabase PostgREST syntax for JSON filtering:
    // arrow operator -> returns json, ->> returns text.
    // We can't easily do numerical comparison on JSON keys via standard PostgREST-js .gt() on a json field key directly without a computed column or raw sql.
    // However, Supabase JS client supports filtering on json columns if we cast.
    // Actually, simple .gt('totals->>idle_minutes', value) works as text comparison, which is bad for numbers (e.g. "100" < "2").
    // Correct way is likely using a raw filter or ensuring the column is stored as int if possible, but it's inside JSONB.
    // For now, we might need to use .filter() with cast if supported, or fetch and filter in memory if volume is low.
    // Given this is a list endpoint with pagination, in-memory filtering breaks pagination.
    // Let's try to use the raw PostgREST syntax if possible, or just rely on text comparison if we pad numbers (we don't).
    // Better approach: Use .filter() which maps to the `filter` query param in PostgREST.
    // Syntax: .filter('totals->>idle_minutes', 'gt', idleGt) -> this does text comparison.
    // To do numeric comparison on JSONB in Supabase/PostgREST, we usually need a Postgres function or a view.
    // OR we can rely on the fact that for small numbers text comparison might roughly work but it's risky.
    // Wait, Supabase allows casting in the column name? .filter('totals->>idle_minutes::int', 'gt', idleGt)? No.
    // Let's look at `missing_screenshots`. That's `totals->>screenshots_count` equals '0'.
    
    // WORKAROUND for JSONB numeric comparison without backend changes:
    // We will fetch slightly more data and filter in memory? No, that's bad for "consistent filtering".
    // User rule: "Do NOT change existing backend logic or business rules." -> Creating a view or index is allowed ("Add migrations: saved_views + any missing indexes").
    // I could create an index or a computed column, but I can't easily do that right now without a migration tool.
    // I will try to use the `filter` method but I suspect the numeric issue.
    // Let's check if we can simply use the `idle_minutes` key if it was promoted to a column? No, it's in `totals`.
    
    // Let's try to implement `missing_screenshots` at least, which is equality check (text '0').
    if (missingScreenshots) {
      // Missing screenshots means count is 0 AND worked_minutes > 10 (to avoid noise)
      query = query.eq('totals->>screenshots_count', '0')
      // We also want to ensure they actually worked, otherwise it's just an empty day/period which isn't an "anomaly" per se?
      // But let's just stick to the requested flag.
      // Note: text comparison '0' is safe.
    }

    // For idle_gt and overtime_gt, since we can't easily do numeric comparison on JSONB via standard JS client without casting issues,
    // and we can't change backend schema easily (user said "Do NOT change existing backend logic"),
    // I will fetch the page and filter in memory if these filters are active.
    // It's a trade-off. OR I can try to use a raw filter string if `rpc` is not an option.
    // Actually, we can use `.rpc` if we had a function, but we don't.
    // Let's stick to in-memory filtering for the "numeric in JSON" anomalies for now, 
    // applying the limit AFTER filtering. This effectively breaks "page size" guarantee but gives correct results.
    // Given this is "Approvals", the list shouldn't be massive (hundreds, not millions).
    
    if (sort) {
      const [col, dir] = sort.split(':')
      // If sorting by JSON field, we have same issue.
      // Standard columns: period_start, status, created_at
      if (['period_start', 'status', 'created_at'].includes(col)) {
        query = query.order(col, { ascending: dir === 'asc' })
      } else {
        query = query.order('period_start', { ascending: false })
      }
    } else {
      query = query.order('period_start', { ascending: false })
    }

    // Execute query
    // If we have numeric json filters, we might need to fetch all matches (or a large batch) and filter.
    // But let's try to be efficient.
    
    // If no complex filters, use pagination
    if (idleGt === 0 && overtimeGt === 0) {
      query = query.range((page - 1) * pageSize, page * pageSize - 1)
      const { data, error, count } = await query
      if (error) throw error
      return NextResponse.json({ items: data, total: count })
    } else {
      // Complex filtering needed
      const { data, error } = await query
      if (error) throw error
      
      let filtered = data || []
      
      if (idleGt > 0) {
        filtered = filtered.filter((r: any) => (Number(r.totals?.idle_minutes) || 0) > idleGt)
      }
      
      if (overtimeGt > 0) {
        filtered = filtered.filter((r: any) => (Number(r.totals?.overtime_minutes) || 0) > overtimeGt)
      }
      
      // Manual Pagination
      const total = filtered.length
      const start = (page - 1) * pageSize
      const pagedItems = filtered.slice(start, start + pageSize)
      
      return NextResponse.json({ items: pagedItems, total })
    }
  } catch (error: any) {
    console.error('List timesheets error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
