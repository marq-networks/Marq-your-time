import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardClient from './page.client'

export default function Page() {
  const user = cookies().get('current_user_id')?.value || ''
  if (!user) redirect('/auth/login')
  return <DashboardClient />
}
