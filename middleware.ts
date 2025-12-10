import { NextRequest, NextResponse } from 'next/server'

export const config = { matcher: ['/api/:path*'] }

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers)
  if (!headers.get('x-user-id')) headers.set('x-user-id', 'demo-user')
  const cookieHeader = req.headers.get('cookie') || ''
  const parts = cookieHeader.split(';').map(s => s.trim())
  const kv = new Map(parts.map(p => { const i = p.indexOf('='); return [i>0?p.slice(0,i):p, i>0?p.slice(i+1):''] }))
  const currentOrg = kv.get('current_org_id') || ''
  if (currentOrg && !headers.get('x-org-id')) headers.set('x-org-id', currentOrg)
  return NextResponse.next({ request: { headers } })
}
