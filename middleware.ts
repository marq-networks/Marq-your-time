import { NextRequest, NextResponse } from 'next/server'

export const config = { matcher: ['/api/:path*'] }

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers)
  if (!headers.get('x-user-id')) headers.set('x-user-id', 'demo-user')
  return NextResponse.next({ request: { headers } })
}

