import './globals.css'
import { Inter } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import TopNav from '@components/TopNav'
import SideNav from '@components/SideNav'
import TrackingProvider from '@components/TrackingProvider'
import { ThemeProvider } from '@components/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hdr = headers()
  const isAuth = !!hdr.get('x-auth-route')
  const userCookie = cookies().get('current_user_id')?.value || ''
  const orgCookie = cookies().get('org_login')?.value || ''
  if (!isAuth && !userCookie && !orgCookie) redirect('/auth/login')
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TrackingProvider>
            {children}
          </TrackingProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
