import './globals.css'
import { Inter } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import TopNav from '@components/TopNav'
import SideNav from '@components/SideNav'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hdr = headers()
  const isAuth = !!hdr.get('x-auth-route')
  const userCookie = cookies().get('current_user_id')?.value || ''
  if (!isAuth && !userCookie) redirect('/auth/login')
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="nav"><TopNav /></div>
        <div className="layout">
          <SideNav />
          <div className="main container">{children}</div>
        </div>
      </body>
    </html>
  )
}
