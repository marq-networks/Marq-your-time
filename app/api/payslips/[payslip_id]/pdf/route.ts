import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { getPayslipDetail } from '@lib/payslips'

function isAdminLike(role: string) {
  const r = role.toLowerCase()
  return ['admin', 'manager', 'finance', 'owner', 'super_admin'].includes(r)
}

export async function GET(req: NextRequest, { params }: { params: { payslip_id: string } }) {
  const headerRole = (req.headers.get('x-role') || '').toLowerCase()
  const cookieRole = (req.cookies.get('current_role')?.value || '').toLowerCase()
  const role = headerRole || cookieRole
  const actor = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value || ''
  const headerOrgId = req.headers.get('x-org-id') || ''
  const cookieOrgId = req.cookies.get('current_org_id')?.value || ''
  const requestedOrgId = headerOrgId || cookieOrgId

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })

  const { data: rec } = await sb.from('payslips').select('*').eq('id', params.payslip_id).maybeSingle()
  if (!rec) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (requestedOrgId && String(rec.org_id) !== requestedOrgId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  if (isAdminLike(role)) {
    const path = rec.pdf_path as string | null
    if (path) {
      const store = sb.storage.from('documents')
      const signed = await store.createSignedUrl(path, 3600)
      if (!signed.error && signed.data?.signedUrl) return NextResponse.redirect(signed.data.signedUrl, 302)
    }
    const detail = await getPayslipDetail(params.payslip_id)
    if (!detail) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    const html = await import('@lib/payslips').then(m => m.renderPayslipHtml(detail))
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
  }

  if (!actor || !['employee', 'member'].includes(role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  if (String(rec.user_id) !== actor) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const path = rec.pdf_path as string | null
  if (path) {
    const store = sb.storage.from('documents')
    const signed = await store.createSignedUrl(path, 3600)
    if (!signed.error && signed.data?.signedUrl) return NextResponse.redirect(signed.data.signedUrl, 302)
  }

  const detail = await getPayslipDetail(params.payslip_id)
  if (!detail) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const html = await import('@lib/payslips').then(m => m.renderPayslipHtml(detail))
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
}
