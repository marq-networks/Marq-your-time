import { NextRequest, NextResponse } from 'next/server'

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }

export default function middleware(req: NextRequest) {
  const headers = new Headers(req.headers)
  const cookieHeader = req.headers.get('cookie') || ''
  const parts = cookieHeader.split(';').map(s => s.trim())
  const kv = new Map(parts.map(p => { const i = p.indexOf('='); return [i>0?p.slice(0,i):p, i>0?p.slice(i+1):''] }))
  const currentOrg = kv.get('current_org_id') || ''
  const currentUser = kv.get('current_user_id') || ''
  const currentRole = kv.get('current_role') || ''
  if (currentUser) headers.set('x-user-id', currentUser)
  if (currentOrg && !headers.get('x-org-id')) headers.set('x-org-id', currentOrg)
  if (currentRole && !headers.get('x-role')) headers.set('x-role', currentRole)
  const path = req.nextUrl.pathname || '/'
  const isAuthRoute = path.startsWith('/auth/')
  const isAuthApi = path.startsWith('/api/auth/')
  const isPublicApi = path.startsWith('/api/public/')
  const isNextStatic = path.startsWith('/_next/') || path === '/favicon.ico'
  const isAsset = path.startsWith('/assets/') || path.startsWith('/images/') || path.startsWith('/static/')
  if (isAuthRoute) headers.set('x-auth-route', '1')
  if (currentUser) headers.set('x-is-authenticated', '1')
  if (!currentUser && !isAuthRoute && !isAuthApi && !isPublicApi && !isNextStatic && !isAsset) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }
  return NextResponse.next({ request: { headers } })
}
