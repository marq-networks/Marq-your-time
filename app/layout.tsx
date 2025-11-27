import './globals.css'
import { Inter } from 'next/font/google'
import TopNav from '@components/TopNav'
import SideNav from '@components/SideNav'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
