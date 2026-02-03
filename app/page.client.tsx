"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import { usePathname, useRouter } from 'next/navigation'
import usePermission, { ROLE_PERMISSIONS } from '@lib/hooks/usePermission'
import { useTracking } from '@components/TrackingProvider'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { 
  Play, Pause, Coffee, Briefcase, 
  Calendar, ChevronLeft, ChevronRight, 
  MoreHorizontal, Tag, Clock, Users, User,
  LayoutGrid, List
} from 'lucide-react'

export default function DashboardClient() {
  const tracking = useTracking()
  const canOrg = usePermission('manage_org').allowed
  const router = useRouter()

  const [isAdminRole, setIsAdminRole] = useState(false)

  useEffect(() => {
    // Client-side role redirect fallback
    const checkRole = async () => {
      // 1. Check cookie first (fastest)
      const cookies = document.cookie.split(';').map(c=>c.trim())
      const cookieRole = cookies.find(c=>c.startsWith('current_role='))?.split('=')[1]?.toLowerCase()
      if (cookieRole && ['owner', 'admin', 'super_admin', 'manager'].includes(cookieRole)) {
         setIsAdminRole(true)
         // router.replace('/team/dashboard') // Removed to allow tracking
         // return
      }

      // 2. Verify with server (reliable)
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (data.isAdmin) {
            setIsAdminRole(true)
            // router.replace('/team/dashboard') // Removed to allow tracking
          }
        }
      } catch (e) {
        console.error('Failed to verify role', e)
      }
    }
    
    checkRole()
  }, [])
  
  // State
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month'>('Day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  
  const [orgs, setOrgs] = useState<{ id: string, orgName: string }[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<{ id: string, firstName: string, lastName: string }[]>([])
  const [memberId, setMemberId] = useState('')
  
  // Data
  const [summary, setSummary] = useState<any>({ today_hours:'0:00', extra_time:'+00:00', short_time:'-00:00', session:null, break:null, sessions:[], breaks:[], attendance:null })
  const [overview, setOverview] = useState<any>(null)
  const [logs, setLogs] = useState<any>({ items: [], sessions: [] })
  const [loading, setLoading] = useState(false)

  // --- Helpers ---
  const toLocalISOString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getRange = (mode: string, date: Date) => {
    const d = new Date(date)
    d.setHours(0,0,0,0)
    
    if (mode === 'Day') {
        const s = toLocalISOString(d)
        return { from: s, to: s }
    }
    if (mode === 'Week') {
        const day = d.getDay() // 0 is Sunday
        // Adjust to make Monday the start of the week
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const start = new Date(d)
        start.setDate(diff)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        return { from: toLocalISOString(start), to: toLocalISOString(end) }
    }
    if (mode === 'Month') {
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        return { from: toLocalISOString(start), to: toLocalISOString(end) }
    }
    return { from: '', to: '' }
  }

  const navigate = (dir: number) => {
      const d = new Date(currentDate)
      if (viewMode === 'Day') d.setDate(d.getDate() + dir)
      if (viewMode === 'Week') d.setDate(d.getDate() + (dir * 7))
      if (viewMode === 'Month') d.setMonth(d.getMonth() + dir)
      setCurrentDate(d)
  }

  // --- Data Loading ---
  useEffect(() => {
    try {
      const cookies = document.cookie.split(';').map(c=>c.trim())
      const hasUser = cookies.some(c=>c.startsWith('current_user_id='))
      const hasOrg = cookies.some(c=>c.startsWith('org_login='))
      if (!hasUser && !hasOrg) window.location.href = '/auth/login'
    } catch {}
    setMounted(true)
  }, [])
  
  const loadOrgs = async () => {
    try {
      const cookies = typeof document !== 'undefined' ? document.cookie.split(';').map(c=>c.trim()) : []
      const hasUser = cookies.some(c=>c.startsWith('current_user_id='))
      
      if (hasUser) {
        const res = await fetch('/api/orgs/my', { cache: 'no-store' })
        const data = await res.json()
        setOrgs((data.items || []).map((o: any) => ({ id: o.id, orgName: o.orgName })))
        if (!orgId && data.items?.length) {
          const cookieOrgId = cookies.find(c=>c.startsWith('current_org_id='))?.split('=')[1] || ''
          const preferred = (data.items as any[]).find(o => o.id === cookieOrgId)?.id || data.items[0].id
          setOrgId(preferred)
        }
      } else {
        // Org Login Mode
        const cookieOrgId = cookies.find(c=>c.startsWith('current_org_id='))?.split('=')[1] || ''
        if (cookieOrgId) {
          const res = await fetch(`/api/org/${cookieOrgId}`)
          const data = await res.json()
          if (data.org) {
            setOrgs([{ id: data.org.id, orgName: data.org.orgName }])
            setOrgId(data.org.id)
          }
        }
      }
    } catch {}
  }
  
  const loadMembers = async (oid: string) => {
    if (!oid) return
    try {
      const res = await fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' })
      const data = await res.json()
      setMembers(data.items || [])
      if (!memberId && data.items?.length) {
        const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
        const preferredMember = (data.items as any[]).find(m => m.id === cookieUserId)?.id || data.items[0].id
        setMemberId(preferredMember)
      }
    } catch {}
  }
  
  const loadData = async () => {
    if (!memberId || !orgId) return
    setLoading(true)
    try {
        const { from, to } = getRange(viewMode, currentDate)
        
        // 1. Always load today's summary for header/real-time status
        const sumRes = await fetch(`/api/time/today?member_id=${memberId}&org_id=${orgId}`, { cache: 'no-store' })
        const sumData = await sumRes.json()
        setSummary(sumData)

        // 2. Load Activity Overview (Apps, Stats)
        const ovRes = await fetch(`/api/activity/overview?member_id=${memberId}&org_id=${orgId}&from=${from}&to=${to}`, { cache: 'no-store' })
        const ovData = await ovRes.json()
        setOverview(ovData.items?.[0] || null)

        // 3. Load Logs (Timeline data) - use skip_stats=true for speed
        const logsRes = await fetch(`/api/time/logs?member_id=${memberId}&org_id=${orgId}&from=${from}&to=${to}&skip_stats=true`, { cache: 'no-store' })
        const logsData = await logsRes.json()
        setLogs(logsData)

    } catch (e) {
        console.error(e)
    } finally {
        setLoading(false)
    }
  }
  
  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(() => { if (orgId && memberId) loadData() }, [orgId, memberId, viewMode, currentDate])

  // --- Actions ---
  const startSession = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, source: 'web' }) })
    if (res.ok) {
        loadData()
        const s = await fetch(`/api/activity/today?member_id=${memberId}&org_id=${orgId}`).then(r=>r.json())
        const tRes = await fetch('/api/tracking/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) }).then(r=>r.json())
        if (tRes.trackingSessionId) tracking.startTracking(tRes.trackingSessionId, s.settings)
    } else alert('Could not check in')
  }

  const stopSession = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/time/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    loadData()
    await tracking.stopTracking()
  }

  const startBreak = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/time/break/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, label: 'Break' }) })
    loadData()
  }

  const stopBreak = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/time/break/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    loadData()
  }

  // --- Render Helpers ---
  const fmt = (m: any) => {
    if (typeof m !== 'number') return m || '0:00'
    const h = Math.floor(m / 60)
    const min = Math.floor(m % 60)
    return `${h}h ${min}m`
  }

  if (!mounted) return <AppShell title="Dashboard"><div>Loading...</div></AppShell>

  const isCheckedIn = summary.session_open
  const isOnBreak = summary.break_open
  const displayDate = currentDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  
  // Prepare Chart Data
  let chartData: { label: string, value: number, color: string }[] = []
  if (viewMode === 'Day') {
      // 24 hour buckets
      chartData = Array.from({ length: 24 }).map((_, i) => ({ label: `${i}`, value: 0, color: '#e5e7eb' }))
      // Populate from sessions
      ;(logs.sessions || []).forEach((s: any) => {
          const start = new Date(s.startTime).getHours()
          const end = s.endTime ? new Date(s.endTime).getHours() : new Date().getHours()
          for (let h = start; h <= end; h++) {
              if (chartData[h]) chartData[h].color = '#3dd6a3' // Active color
              if (chartData[h]) chartData[h].value = 100 // Full bar for simplicity
          }
      })
  } else {
      // Daily buckets
      const { from, to } = getRange(viewMode, currentDate)
      const start = new Date(from)
      const end = new Date(to)
      const days = []
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          days.push(new Date(d).toISOString().slice(0,10))
      }
      chartData = days.map(d => {
          const item = (logs.items || []).find((it: any) => it.date === d)
          return {
              label: new Date(d).getDate().toString(),
              value: item ? (item.workedMinutes / 60) : 0,
              color: item ? '#3dd6a3' : '#e5e7eb'
          }
      })
  }

  // Apps Data
  const apps = (overview?.topApps || []).map((a: any) => ({
      name: a.name,
      time: fmt(a.minutes),
      percent: overview?.trackedActiveMinutes ? Math.round((a.minutes / overview.trackedActiveMinutes) * 100) : 0,
      color: a.category === 'productive' ? '#3dd6a3' : (a.category === 'unproductive' ? '#f59e0b' : '#229ed9')
  }))

  // Projects Data (aggregated from logs)
  const projMap = new Map()
  ;(logs.sessions || []).forEach((s: any) => {
      if (s.projects) {
          const pName = s.projects.name
          const mins = s.totalMinutes || 0
          projMap.set(pName, (projMap.get(pName) || 0) + mins)
      }
  })
  const projects = Array.from(projMap.entries()).map(([name, mins]) => ({
      name,
      time: fmt(mins),
      percent: overview?.workedHours ? Math.round((mins / (overview.workedHours * 60)) * 100) : 0,
      color: '#3dd6a3'
  }))

  const workedHours = overview ? overview.workedHours : 0
  const productiveHours = overview ? overview.productiveMinutes : 0
  const focusedHours = overview ? overview.trackedActiveMinutes : 0 // Proxy
  const unproductiveHours = overview ? overview.unproductiveMinutes : 0

  return (
    <AppShell title="Dashboard">
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, background: 'white', padding: 4, borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
           {['Day', 'Week', 'Month'].map(t => (
             <button key={t} onClick={() => setViewMode(t as any)} style={{ 
               padding: '6px 12px', 
               borderRadius: 8, 
               background: viewMode === t ? '#f3f4f6' : 'transparent', 
               border: 'none', 
               fontWeight: 600, 
               fontSize: 14,
               color: viewMode === t ? 'black' : '#6b7280',
               cursor: 'pointer'
             }}>{t}</button>
           ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', padding: '8px 16px', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
          <button onClick={() => navigate(-1)} style={{border:'none', background:'transparent', cursor:'pointer'}}><ChevronLeft size={16} /></button>
          <Calendar size={16} className="text-gray-400" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{displayDate}</span>
          <button onClick={() => navigate(1)} style={{border:'none', background:'transparent', cursor:'pointer'}}><ChevronRight size={16} /></button>
        </div>

        <div style={{ background: '#111827', color: 'white', padding: '8px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
          Today: {fmt(summary.today_hours)}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <select 
            value={memberId} 
            onChange={e => setMemberId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', fontWeight: 600, fontSize: 14 }}
          >
            {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <GlassCard className="mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
           <div className="row">
             <Clock size={18} />
             <span className="card-title" style={{marginBottom:0}}>Timeline ({viewMode})</span>
           </div>
           <div className="row" style={{ fontSize: 12 }}>
              <span style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:8,height:8,borderRadius:'50%',background:'#3dd6a3'}}></span> Active</span>
           </div>
        </div>
        <div style={{ height: 120, position: 'relative', marginTop: 20 }}>
           <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end', gap: 4 }}>
             {chartData.map((d, i) => (
               <div key={i} style={{ flex: 1, background: `${d.color}20`, height: '100%', position: 'relative', borderRadius: 4, display:'flex', alignItems:'flex-end' }}>
                  <div style={{ width: '100%', height: viewMode === 'Day' ? d.value + '%' : `${Math.min(100, (d.value / 12) * 100)}%`, background: d.color, borderRadius: 4 }}></div>
               </div>
             ))}
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#9ca3af', fontSize: 10 }}>
             {viewMode === 'Day' ? 
               <><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></> :
               <><span>{chartData[0]?.label}</span><span>{chartData[Math.floor(chartData.length/2)]?.label}</span><span>{chartData[chartData.length-1]?.label}</span></>
             }
           </div>
        </div>
      </GlassCard>

      {/* Main Grid */}
      <div className="grid grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
        
        {/* Working Hours */}
        <GlassCard title="Working Hours">
           <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
             <div>
                 <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(workedHours * 60)}</div>
                 <div style={{ fontSize: 12, color: '#6b7280' }}>Total Time Worked</div>
             </div>
             
             {/* Heatmap Mock (still mock as we don't have year data easily) */}
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 2 }}>
               {Array.from({ length: 60 }).map((_, i) => (
                 <div key={i} style={{ aspectRatio: '1/1', background: Math.random() > 0.5 ? '#3dd6a3' : '#e5e7eb', borderRadius: 2 }}></div>
               ))}
             </div>

             <button 
               onClick={isCheckedIn ? stopSession : startSession}
               style={{ 
                 background: isCheckedIn ? '#ef4444' : 'linear-gradient(135deg, #3dd6a3, #22a876)', 
                 color: 'white', 
                 border: 'none', 
                 borderRadius: 12, 
                 padding: '12px', 
                 fontSize: 16, 
                 fontWeight: 600,
                 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                 cursor: 'pointer'
               }}
             >
               {isCheckedIn ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
               {isCheckedIn ? 'Stop Tracking' : 'Start Tracking'}
             </button>
           </div>
        </GlassCard>

        {/* Time Breakdown */}
        <GlassCard title="Time Breakdown">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', height: '100%' }}>
            <div style={{ 
              width: 120, height: 120, borderRadius: '50%', 
              background: `conic-gradient(
                  #3dd6a3 0% ${(productiveHours / (workedHours*60 || 1))*100}%, 
                  #229ed9 ${(productiveHours / (workedHours*60 || 1))*100}% ${((productiveHours + focusedHours) / (workedHours*60 || 1))*100}%, 
                  #f59e0b ${((productiveHours + focusedHours) / (workedHours*60 || 1))*100}% 100%
              )`,
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ width: 90, height: 90, background: 'white', borderRadius: '50%' }}></div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <div>
                 <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(productiveHours)}</div>
                 <div style={{ fontSize: 12, color: '#6b7280' }}>Productive Hours</div>
               </div>
               <div>
                 <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(focusedHours)}</div>
                 <div style={{ fontSize: 12, color: '#6b7280' }}>Focused Time</div>
               </div>
               <div>
                 <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(unproductiveHours)}</div>
                 <div style={{ fontSize: 12, color: '#6b7280' }}>Unproductive</div>
               </div>
            </div>
          </div>
        </GlassCard>

        {/* Apps Used */}
        <GlassCard title="Apps Used">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(overview?.trackedActiveMinutes)}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Total Tracked Time</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {apps.length === 0 && <div className="text-sm text-gray-500">No apps tracked yet</div>}
            {apps.map((app: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <div style={{ width: 80, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{app.name}</div>
                <div style={{ flex: 1, background: '#f3f4f6', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${app.percent}%`, background: app.color, height: '100%' }}></div>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{app.time}</div>
              </div>
            ))}
          </div>
        </GlassCard>
        
        {/* Break Timer */}
      {!isAdminRole && (
      <GlassCard title="Break Timer">
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ 
            width: 100, height: 100, borderRadius: '50%', 
            border: '8px solid #38bdf8', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#0f172a'
          }}>
            {isOnBreak ? 'ON' : 'Ready'}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button 
              onClick={isOnBreak ? stopBreak : startBreak}
              style={{ 
                width: '100%', 
                padding: '8px', 
                background: 'white', 
                border: '1px solid #e5e7eb', 
                borderRadius: 8, 
                fontWeight: 600,
                cursor: 'pointer'
              }}>
              {isOnBreak ? 'End Break' : 'Start Break'}
            </button>
          </div>
        </div>
      </GlassCard>
      )}

        {/* Projects */}
        <GlassCard title="Projects" right={<MoreHorizontal size={16} />}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(Array.from(projMap.values()).reduce((a:any,b:any)=>a+b, 0))}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Total Project Time</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.length === 0 && <div className="text-sm text-gray-500">No projects tracked</div>}
            {projects.slice(0, 5).map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <div style={{ width: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{p.name}</div>
                <div style={{ flex: 1, background: '#f3f4f6', height: 24, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${p.percent}%`, background: p.color, height: '100%' }}></div>
                  <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'white', fontWeight: 700 }}>{p.percent}%</div>
                </div>
                <div style={{ width: 40, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{p.time}</div>
              </div>
            ))}
          </div>
        </GlassCard>

      </div>
    </AppShell>
  )
}