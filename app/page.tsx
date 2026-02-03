import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardClient from './page.client'

export const dynamic = 'force-dynamic'

export default function Page() {
  const user = cookies().get('current_user_id')?.value || ''
  const org = cookies().get('org_login')?.value || ''
  const role = cookies().get('current_role')?.value || ''

  if (!user && !org) redirect('/auth/login')

  // Redirect Admins/Owners to Team Dashboard
  // if (['owner', 'admin', 'super_admin', 'manager'].includes(role)) {
  //   redirect('/team/dashboard')
  // }

  return <DashboardClient />
}
