'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import usePermission from '@lib/hooks/usePermission'

const items = [
  { href: '/', label: 'Dashboard' },
  { href: '/org/list', label: 'Orgs' },
  { href: '/users', label: 'Users' },
  { href: '/departments', label: 'Departments' },
  { href: '/roles', label: 'Roles' },
  { href: '/members', label: 'Members' },
  { href: '/my/time', label: 'My Day' },
  { href: '/my/activity', label: 'My Activity' },
  { href: '/my/earnings', label: 'My Earnings' },
  { href: '/time/logs', label: 'Time Logs' },
  { href: '/leave', label: 'Leave' },
  { href: '/leave/approvals', label: 'Leave Approvals' },
  { href: '/activity/overview', label: 'Activity Overview' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/reports', label: 'Reports' },
  { href: '/engagement/surveys', label: 'Engagement Surveys' },
  { href: '/engagement/my', label: 'My Engagement' },
  { href: '/analytics/insights', label: 'Insights' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/payroll', label: 'Payroll' },
  { href: '/billing', label: 'Billing' },
  { href: '/billing/plans', label: 'Billing Plans' },
  { href: '/settings', label: 'Settings' },
  { href: '/integrations/api', label: 'Integrations API' },
  { href: '/integrations/api-docs', label: 'API Docs' },
  { href: '/devices/offline-sync', label: 'Offline Sync' },
  { href: '/hq', label: 'hq' },
  { href: '/hq/billing-overview', label: 'HQ Billing' },
  { href: '/hq/agent-versions', label: 'Agent Versions' },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const canOrg = usePermission('manage_org').allowed
  const canUsers = usePermission('manage_users').allowed
  const canReports = usePermission('manage_reports').allowed
  const canSettings = usePermission('manage_settings').allowed
  return (
    <div className="glass-panel strong" style={{padding:16,borderRadius:'var(--radius-large)'}}>
      <div style={{display:'grid',gap:'var(--spacing-sm)'}}>
        {items.filter(i => {
          if (i.label === 'Orgs') return canOrg
          if (i.label === 'Users') return canUsers
          if (i.label === 'Roles') return canUsers && canSettings
          if (i.label === 'Settings') return canSettings
          if (i.label === 'Integrations API') return canSettings
          if (i.label === 'API Docs') return canSettings
          if (i.label === 'Members') return true
          if (i.label === 'My Day') return true
          if (i.label === 'My Activity') return true
          if (i.label === 'My Earnings') return true
          if (i.label === 'Time Logs') return canReports || usePermission('manage_time').allowed
          if (i.label === 'Leave') return true
          if (i.label === 'Leave Approvals') return canUsers
          if (i.label === 'Activity Overview') return canReports
          if (i.label === 'Analytics') return canReports
          if (i.label === 'Payroll') return canReports
          if (i.label === 'Billing') return canReports
          if (i.label === 'Offline Sync') return canReports
          if (i.label === 'Dashboard') return true
          if (i.label === 'Departments') return canUsers
          if (i.label === 'Reports') return canReports
          return true
        }).map(i => {
          const active = pathname === i.href || pathname?.startsWith(i.href)
          return (
            <Link key={i.href} href={i.href} className={`pill-link${active?' active':''}`}>{i.label}</Link>
          )
        })}
      </div>
    </div>
  )
}
