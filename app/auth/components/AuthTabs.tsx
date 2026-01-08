'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AuthTabs() {
  const pathname = usePathname()
  
  const tabs = [
    { id: 'employee', label: 'Employee', href: '/auth/login' },
    { id: 'org', label: 'Organization', href: '/auth/org-login' },
    { id: 'admin', label: 'Super Admin', href: '/auth/super-admin-login' }
  ]

  return (
    <div className="auth-tabs-container">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link key={tab.id} href={tab.href} className={`auth-tab ${isActive ? 'active' : ''}`}>
            {isActive && (
              <motion.div
                layoutId="active-tab-bg"
                className="auth-tab-bg"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="auth-tab-label">{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
