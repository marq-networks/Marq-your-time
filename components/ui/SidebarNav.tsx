'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ROLE_PERMISSIONS } from '@lib/hooks/usePermission'
import { ChevronsUpDown, Check, Building2, BadgeCheck } from 'lucide-react'
import { useTheme } from 'next-themes'

const icons: Record<string, string> = {
  'Dashboard': '⊞',
  'Users': '👥',
  'Departments': '🏢',
  'Roles': '🔒',
  'Members': '👤',
  'My Activity': '⚡',
  'My Earnings': '💰',
  'My Adjustments': '✏️',
  'Projects': '📂',
  'Time Logs': '⏱️',
  'Schedule': '🗓️',
  'Calendar': '📅',
  'Leave': '🏖️',
  'Leave Approvals': '👍',
  'Timesheet Approvals': '✅',
  'Break Approvals': '☕',
  'Activity Overview': '📊',
  'Analytics': '📈',
  'Reports': '📑',
  'HR Log': '📝',
  'Engagement Surveys': '📋',
  'My Engagement': '😊',
  'Insights': '💡',
  'AI Analytics': '✨',
  'Notifications': '🔔',
  'Payroll': '💵',
  'Payroll v12': '💲',
  'Payslips': '📄',
  'Billing': '💳',
  'Billing Plans': '🧾',
  'Settings': '⚙️',
  'Shifts': '⏰',
  'Categorization': '🏷️',
  'Integrations API': '🔌',
  'API Docs': '📚',
  'Offline Sync': '🔄',
  'Agent Versions': '💻',
  'Orgs': '🏢',
  'My Day': '☀️',
  'My Timesheets': '📝'
}

const superAdminItems = [
  { href: '/team/dashboard', label: 'Dashboard' },
  { href: '/org/list', label: 'Orgs' },
  { href: '/roles', label: 'Roles' },
  { href: '/members', label: 'Members' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/timesheets/approvals', label: 'Timesheet Approvals' },
  { href: '/break/approvals', label: 'Break Approvals' },
  { href: '/activity/overview', label: 'Activity Overview' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/reports', label: 'Reports' },
  { href: '/hr-adjustments-log', label: 'HR Log' },
  { href: '/engagement/surveys', label: 'Engagement Surveys' },
  { href: '/engagement/my', label: 'My Engagement' },
  { href: '/analytics/insights', label: 'Insights' },
  { href: '/analytics/ai', label: 'AI Analytics' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/payroll', label: 'Payroll' },
  { href: '/payroll_v12', label: 'Payroll v12' },
  { href: '/payslips', label: 'Payslips' },
  { href: '/billing', label: 'Billing' },
  { href: '/billing/plans', label: 'Billing Plans' },
  { href: '/settings', label: 'Settings' },
  { href: '/settings/shifts', label: 'Shifts' },
  { href: '/settings/categorization', label: 'Categorization' },
  { href: '/integrations/api', label: 'Integrations API' },
]

const employeeItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/my/day', label: 'My Day' },
  { href: '/my/activity', label: 'My Activity' },
  { href: '/my/earnings', label: 'My Earnings' },
  { href: '/my-adjustments', label: 'My Adjustments' },
  { href: '/my-timesheets', label: 'My Timesheets' },
  { href: '/projects', label: 'Projects' },
  { href: '/time/logs', label: 'Time Logs' },
  { href: '/schedule/roster', label: 'Schedule' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/leave', label: 'Leave' },
  { href: '/activity/overview', label: 'Activity Overview' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/hr-adjustments-log', label: 'HR Log' },
  { href: '/analytics/ai', label: 'AI Analytics' },
  { href: '/notifications', label: 'Notifications' },
]

const standardItems = [
  { href: '/team/dashboard', label: 'Dashboard' },
  { href: '/users', label: 'Users', permission: 'manage_users' },
  { href: '/departments', label: 'Departments', permission: 'manage_org' },
  { href: '/roles', label: 'Roles', permission: 'manage_org' },
  { href: '/members', label: 'Members', permission: 'manage_users' },
  { href: '/my/activity', label: 'My Activity' },
  { href: '/my/earnings', label: 'My Earnings' },
  { href: '/my-adjustments', label: 'My Adjustments' },
  { href: '/projects', label: 'Projects' },
  { href: '/time/logs', label: 'Time Logs' },
  { href: '/schedule/roster', label: 'Schedule' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/leave', label: 'Leave' },
  { href: '/leave/approvals', label: 'Leave Approvals', permission: 'manage_users' },
  { href: '/timesheets/approvals', label: 'Timesheet Approvals', permission: 'manage_users' },
  { href: '/break/approvals', label: 'Break Approvals', permission: 'manage_users' },
  { href: '/activity/overview', label: 'Activity Overview' },
  { href: '/analytics', label: 'Analytics', permission: 'manage_reports' },
  { href: '/reports', label: 'Reports', permission: 'manage_reports' },
  { href: '/hr-adjustments-log', label: 'HR Log', permission: 'manage_org' },
  { href: '/engagement/surveys', label: 'Engagement Surveys' },
  { href: '/engagement/my', label: 'My Engagement' },
  { href: '/analytics/insights', label: 'Insights', permission: 'manage_reports' },
  { href: '/analytics/ai', label: 'AI Analytics', permission: 'manage_reports' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/payroll', label: 'Payroll', permission: 'manage_salary' },
  { href: '/payroll_v12', label: 'Payroll v12', permission: 'manage_salary' },
  { href: '/payslips', label: 'Payslips' },
  { href: '/billing', label: 'Billing', permission: 'manage_org' },
  { href: '/billing/plans', label: 'Billing Plans', permission: 'manage_org' },
  { href: '/settings', label: 'Settings', permission: 'manage_settings' },
  { href: '/settings/shifts', label: 'Shifts', permission: 'manage_settings' },
  { href: '/settings/categorization', label: 'Categorization', permission: 'manage_settings' },
  { href: '/integrations/api', label: 'Integrations API', permission: 'manage_settings' },
  { href: '/integrations/api-docs', label: 'API Docs', permission: 'manage_settings' },
  { href: '/devices/offline-sync', label: 'Offline Sync', permission: 'manage_settings' },
  { href: '/hq/agent-versions', label: 'Agent Versions', permission: 'manage_settings' },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [overrideRole, setOverrideRole] = useState('')
  const [currentRole, setCurrentRole] = useState('')
  const [currentOrg, setCurrentOrg] = useState('Panze Workspace') // Default placeholder
  const [currentOrgLogo, setCurrentOrgLogo] = useState('')

  useEffect(() => {
    setMounted(true)
    const cookies = document.cookie.split(';').map(c=>c.trim())
    let roleCookie = cookies.find(c=>c.startsWith('current_role='))?.split('=')[1] || ''
    const orgLogin = cookies.some(c=>c.startsWith('org_login='))
    
    if (!roleCookie && orgLogin) roleCookie = 'admin'
    
    setCurrentRole(roleCookie)
    setOverrideRole(roleCookie.toLowerCase())
    
    // Try to get org name
    const fetchOrgName = async () => {
      try {
        const cookies = document.cookie.split(';').map(c=>c.trim())
        const orgCookie = cookies.find(c=>c.startsWith('current_org_id='))?.split('=')[1]
        const hasUser = cookies.some(c=>c.startsWith('current_user_id='))
        
        if (orgCookie) {
          if (hasUser) {
            const res = await fetch('/api/orgs/my', { cache: 'no-store' })
            if (res.ok) {
              const d = await res.json()
              const match = (d.items || []).find((o: any) => o.id === orgCookie)
              if (match) {
                setCurrentOrg(match.orgName)
                if (match.orgLogo) setCurrentOrgLogo(match.orgLogo)
              } else if (d.items?.length > 0) {
                setCurrentOrg(d.items[0].orgName)
                if (d.items[0].orgLogo) setCurrentOrgLogo(d.items[0].orgLogo)
              }
            }
          } else {
            // Org Login Mode
            const res = await fetch(`/api/org/${orgCookie}`)
            if (res.ok) {
              const d = await res.json()
              if (d.org) {
                setCurrentOrg(d.org.orgName)
                if (d.org.orgLogo) setCurrentOrgLogo(d.org.orgLogo)
              }
            }
          }
        }
      } catch {}
    }
    
    fetchOrgName()
  }, [])

  if (!mounted) return <div className="p-4">Loading...</div>

  const effectiveRole = overrideRole || currentRole || 'employee'
  
  let baseItems = standardItems
  if (effectiveRole === 'super_admin') {
    baseItems = superAdminItems
  } else if (effectiveRole === 'employee') {
    baseItems = employeeItems
  }

  const visibleItems = baseItems.filter(i => {
    if (!i.permission) return true
    const perms = ROLE_PERMISSIONS[effectiveRole] || []
    // @ts-ignore
    return perms.includes(i.permission)
  })

  const displayRole = overrideRole ? overrideRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Guest'

  return (
    <div className="flex flex-col h-full px-4 py-6">
      {/* Modern Workspace Header */}
      <div className="mb-8">
        <button 
          className="w-full group flex items-center justify-between p-4 rounded-3xl bg-white/40 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 backdrop-blur-md transition-all duration-300 border border-white/20 dark:border-slate-700/50 shadow-sm hover:shadow-md group"
          title={currentOrg}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              {currentOrgLogo ? (
                <img 
                  src={currentOrgLogo} 
                  alt="" 
                  className="w-16 h-16 rounded-2xl object-cover shadow-lg border border-slate-200/60 dark:border-slate-700 ring-4 ring-white/30 dark:ring-slate-800/30 group-hover:scale-105 transition-transform duration-300" 
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg ring-4 ring-white/30 dark:ring-slate-800/30 group-hover:scale-105 transition-transform duration-300">
                  <Building2 size={32} />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm ring-2 ring-white/20 dark:ring-slate-800/20">
                 <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></div>
              </div>
            </div>
            
            <div className="flex flex-col items-start min-w-0 py-1">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-lg truncate w-full text-left leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {currentOrg}
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100/50 dark:bg-slate-700/50 border border-slate-200/50 dark:border-slate-600/50">
                <BadgeCheck size={12} className="text-blue-500" />
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {displayRole}
                </span>
              </div>
            </div>
          </div>
          
          <div className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-100/50 dark:bg-slate-700/50 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
            <ChevronsUpDown size={16} className="text-slate-500" />
          </div>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto -mx-2 px-2 scrollbar-hide">
        {visibleItems.map(i => {
           const active = pathname === i.href
           return (
             <Link 
              key={i.href} 
              href={i.href} 
              className={`
                relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group
                ${active 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 translate-x-1' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 hover:shadow-sm hover:translate-x-1'
                }
              `}
            >
               <span className={`flex items-center justify-center w-6 h-6 text-lg transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                 {icons[i.label] || '•'}
               </span>
               <span className="font-medium text-sm tracking-wide">{i.label}</span>
               {active && (
                 <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm animate-pulse" />
               )}
             </Link>
           )
        })}
      </div>

      {/* Bottom Section */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Theme Toggle */}
        <div 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="cursor-pointer p-1 rounded-full flex relative transition-colors duration-200"
          style={{ 
            background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent'
          }}
        >
          <div className="flex-1 text-center py-1.5 text-xs font-semibold z-10 transition-colors duration-200"
               style={{ color: theme !== 'dark' ? '#1f2937' : '#9ca3af' }}>
            Light
          </div>
          <div className="flex-1 text-center py-1.5 text-xs font-semibold z-10 transition-colors duration-200"
               style={{ color: theme === 'dark' ? '#f3f4f6' : '#9ca3af' }}>
            Dark
          </div>
          <div 
            className="absolute top-1 bottom-1 rounded-full shadow-sm transition-all duration-300 ease-out"
            style={{ 
              left: theme === 'dark' ? '50%' : '4px',
              width: 'calc(50% - 4px)',
              background: theme === 'dark' ? '#3dd6a3' : 'white'
            }}
          />
        </div>

        {/* Logout Button */}
        <button 
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST' })
              router.push('/auth/login')
              router.refresh()
            } catch (e) {
              console.error('Logout failed', e)
            }
          }}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '10px 12px',
            color: '#ef4444',
            fontSize: 14, 
            fontWeight: 600,
            background: 'rgba(239, 68, 68, 0.05)',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
        >
          <span style={{ fontSize: 16 }}>🚪</span>
          Log Out
        </button>
      </div>
    </div>
  )
}
