import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true })
  
  // Clear all auth cookies
  res.cookies.set('current_user_id', '', { path: '/', maxAge: 0 })
  res.cookies.set('current_role', '', { path: '/', maxAge: 0 })
  res.cookies.set('current_org_id', '', { path: '/', maxAge: 0 })
  res.cookies.set('org_login', '', { path: '/', maxAge: 0 })
  
  return res
}
