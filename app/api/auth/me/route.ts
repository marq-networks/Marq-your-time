import { NextRequest, NextResponse } from 'next/server'
import { getUser, getRole, isSuperAdmin } from '@lib/db'

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('current_user_id')?.value || req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  
  const user = await getUser(userId)
  if (!user) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })

  const isSA = await isSuperAdmin(userId)
  let roleName = 'member'
  
  if (isSA) {
    roleName = 'super_admin'
  } else if (user.roleId) {
    const r = await getRole(user.roleId)
    if (r) roleName = r.name.toLowerCase()
  }
  
  return NextResponse.json({ 
    id: user.id, 
    email: user.email, 
    role: roleName,
    isAdmin: ['owner', 'admin', 'super_admin', 'manager'].includes(roleName)
  })
}
