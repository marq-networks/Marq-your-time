'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'
import { useTracking } from '@components/TrackingProvider'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import { 
  Activity, Clock, Monitor, 
  Shield, Eye, EyeOff, Lock, RefreshCw, 
  Zap, Building2, User as UserIcon, AlertCircle
} from 'lucide-react'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

function formatHM(mins: number) { const m = Math.max(0, Math.round(mins || 0)); const h = Math.floor(m / 60); const mm = String(m % 60).padStart(2, '0'); return `${h}:${mm}` }

function formatHMS(mins: number) { const sec = Math.max(0, Math.round(mins * 60)); const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` }

export default function MyActivityPage() {
  const { isTracking, localStats, startTracking } = useTracking()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [memberId, setMemberId] = useState('')
  const [data, setData] = useState<any>({ trackingOn: false, settings: { allowActivityTracking: false, allowScreenshots: false, maskPersonalWindows: true }, sessions: [], breaks: [], events: [], topApps: [], screenshots: [] })
  const [role, setRole] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getHeaders = () => {
    const headers: Record<string, string> = {}
    try {
      const cookies = document.cookie.split(';').map(c => c.trim())
      const uid = cookies.find(c => c.startsWith('current_user_id='))?.split('=')[1]
      const rid = cookies.find(c => c.startsWith('current_role='))?.split('=')[1]
      const oid = cookies.find(c => c.startsWith('current_org_id='))?.split('=')[1]
      if (uid) headers['x-user-id'] = uid
      if (rid) headers['x-role'] = rid
      if (oid) headers['x-org-id'] = oid
    } catch {}
    return headers
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const topApps = data.topApps || []
      if (topApps.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'App', accessor: 'app' },
        { header: 'Active Minutes', accessor: (a) => formatHM(a.minutes) },
        { header: 'Category', accessor: (a) => a.category || '-' }
      ]
      const filename = `my_top_apps_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') {
        await exportToCsv(topApps, exportColumns, filename)
      } else {
        await exportToPdf(topApps, exportColumns, 'Top Apps Today', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const loadOrgs = async () => {
    try {
      const headers = getHeaders()
      const endpoint = '/api/org/list'
      
      const res = await fetch(endpoint, { headers, cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load organizations')
      
      const d = await res.json()
      const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
      setOrgs(items)
      
      if (!orgId && items.length) {
        const preferred = items.find(o => o.id === headers['x-org-id'])?.id || items[0].id
        setOrgId(preferred)
      }
    } catch (e) {
      console.error('Failed to load orgs', e)
      setError('Could not load organizations. Please try refreshing.')
    }
  }

  const loadMembers = async (oid: string) => {
    try {
      const headers = getHeaders()
      const res = await fetch(`/api/user/list?orgId=${oid}`, { headers, cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load members')
        
      const d = await res.json()
      setMembers(d.items || [])
      
      if (!memberId && d.items?.length) {
        const preferredMember = (d.items as any[]).find(m => m.id === headers['x-user-id'])?.id || d.items[0].id
        setMemberId(preferredMember)
      }
    } catch (e) {
      console.error('Failed to load members', e)
      // Fallback: if we can't load members, at least assume the current user exists
      const headers = getHeaders()
      const myId = headers['x-user-id']
      if (myId && !memberId) {
        setMemberId(myId)
        // Optionally add a placeholder member so the UI doesn't say "No Members"
        setMembers([{ id: myId, firstName: 'Me', lastName: '' }])
      }
    }
  }

  const load = async (mid: string, oid: string) => { 
    setLoading(true)
    setError('')
    try {
      const headers = getHeaders()
      const res = await fetch(`/api/activity/today?member_id=${mid}&org_id=${oid}`, { headers, cache: 'no-store' }); 
      if (!res.ok) {
         if (res.status === 401) throw new Error('Unauthorized')
         throw new Error('Failed to fetch activity data')
      }
      const d = await res.json(); 
      setData(d) 
    } catch (e: any) {
      console.error('Failed to load activity', e)
      setError(e.message || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  const [insights, setInsights] = useState<any[]>([])
  const loadInsights = async (mid: string, oid: string) => { 
    try {
      const headers = getHeaders()
      const qs = new URLSearchParams({ org_id: oid, member_id: mid, limit: '5' }); 
      const res = await fetch(`/api/insights/list?${qs.toString()}`, { headers, cache: 'no-store' }); 
      if (res.ok) {
        const d = await res.json(); 
        setInsights(d.insights || d.items || []) 
      }
    } catch (e) {
      console.error('Failed to load insights', e)
    }
  }

  useEffect(() => { 
    try { 
      const headers = getHeaders()
      const r = normalizeRoleForApi(headers['x-role'] || ''); 
      setRole(r) 
    } catch { } 
  }, [])
  
  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(() => { if (orgId && memberId) { load(memberId, orgId); loadInsights(memberId, orgId) } }, [orgId, memberId])
  
  useEffect(() => {
    let t: any = null
    if (orgId && memberId && (data.trackingOn || isTracking || data.settings.allowScreenshots)) {
      t = setInterval(() => load(memberId, orgId), 10000) 
    }
    return () => { if (t) clearInterval(t) }
  }, [orgId, memberId, data.trackingOn, isTracking, data.settings?.allowScreenshots])

  // Auto-connect if server says tracking is on but we are not tracking locally
  useEffect(() => {
    if (data.trackingOn && !isTracking && data.trackingSessionId) {
      console.log('Auto-connecting to active session:', data.trackingSessionId)
      startTracking(data.trackingSessionId, data.settings)
    }
  }, [data.trackingOn, isTracking, data.trackingSessionId])

  const totalClicks = (data.events || []).reduce((acc: number, e: any) => acc + (e.clickCount || 0), 0)
  const totalKeys = (data.events || []).reduce((acc: number, e: any) => acc + (e.keyboardActivityScore || 0), 0)
  
  const totalSessionMinutes = (data.sessions || []).reduce((acc: number, s: any) => {
    const start = new Date(s.startTime).getTime()
    const end = s.endTime ? new Date(s.endTime).getTime() : Date.now()
    return acc + Math.max(0, (end - start) / 1000 / 60)
  }, 0)

  // Calculate active minutes logic...
  const sortedEvents = (data.events || []).slice().sort((a: any, b: any) => a.timestamp - b.timestamp)
  const appMinutesMap: Record<string, { minutes: number, category?: string }> = {}
  const addAppMinute = (event: any, minutes = 1) => {
      const name = event.appName || event.app_name || 'Web'
      if (!appMinutesMap[name]) appMinutesMap[name] = { minutes: 0, category: event.category }
      appMinutesMap[name].minutes += minutes
  }

  let adjustedActiveCount = 0
  let zombieChain: any[] = []

  for (const e of sortedEvents) {
    if (!e.isActive) {
      zombieChain = []
      continue
    }
    const isZombie = (e.keyboardActivityScore || 0) === 0 && (e.clickCount || 0) === 0 && (e.mouseActivityScore || 0) === 0
    if (isZombie) {
      zombieChain.push(e)
    } else {
      for (const z of zombieChain) { addAppMinute(z); adjustedActiveCount++ }
      zombieChain = []
      addAppMinute(e); adjustedActiveCount++ 
    }
  }

  let tailCorrection = 0
  const openSession = (data.sessions || []).find((s: any) => !s.endTime)
  if (openSession) {
    const lastEvent = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1] : null
    const lastTs = lastEvent ? lastEvent.timestamp : 0
    const now = Date.now()
    const sessionStart = new Date(openSession.startTime).getTime()
    const effectiveLastEventTime = Math.max(lastTs, sessionStart)
    const gap = Math.max(0, (now - effectiveLastEventTime) / 1000 / 60)
    
     const hasLocalActivity = (localStats.keys > 0 || localStats.clicks > 0 || localStats.mouse > 0)
     const isLastActive = (!lastEvent || lastEvent.isActive || hasLocalActivity)
     
     if (isLastActive) {
        if (zombieChain.length + gap < 10) {
          for (const z of zombieChain) { addAppMinute(z); adjustedActiveCount++ }
          tailCorrection = gap
          if (lastEvent) { addAppMinute(lastEvent, gap) } else { if (!appMinutesMap['Web']) appMinutesMap['Web'] = { minutes: 0 }; appMinutesMap['Web'].minutes += gap }
        }
     }
   } else {
     if (zombieChain.length < 10) { for (const z of zombieChain) { addAppMinute(z); adjustedActiveCount++ } }
   }
 
   const activeMinutes = adjustedActiveCount + tailCorrection
   const idleMinutes = Math.max(0, totalSessionMinutes - activeMinutes)
   
   const clientTopApps = Object.entries(appMinutesMap)
      .map(([app, v]) => ({ app, minutes: v.minutes, category: v.category }))
      .sort((a, b) => b.minutes - a.minutes)
 
   const showLocalStats = isTracking
   const pendingKeys = showLocalStats ? localStats.keys : 0
   const pendingClicks = showLocalStats ? localStats.clicks : 0
   

   return (
    <AppShell title="My Activity">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center gap-2">
              <Activity className="text-indigo-500" /> My Activity
            </h1>
            <p className="text-gray-500 mt-1">Real-time insights into your daily productivity and work sessions.</p>
          </div>
          
          <div className="flex items-center gap-3">
             {error && (
                <div className="text-red-500 text-sm flex items-center gap-1 bg-red-50 px-3 py-1 rounded-full">
                  <AlertCircle size={14} /> {error}
                </div>
             )}

             <div className="flex items-center gap-2 px-3 py-2 bg-white/50 rounded-xl border border-slate-200/50 shadow-sm backdrop-blur-sm hover:bg-white/80 transition-colors">
               <Building2 size={16} className="text-slate-400" />
               {(['employee', 'member'].includes(role) && orgs.length > 0) ? (
                 <span className="text-sm font-medium px-2 text-slate-700">{orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || 'Loading...'}</span>
               ) : (
                 <select 
                   value={orgId} 
                   onChange={(e)=>setOrgId(e.target.value)}
                   className="bg-transparent border-none outline-none text-sm font-medium min-w-[120px] cursor-pointer text-slate-700"
                   disabled={orgs.length === 0}
                 >
                   {orgs.length === 0 ? <option>No Organizations</option> : <option value="" disabled>Select Organization</option>}
                   {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                 </select>
               )}
             </div>

             <div className="flex items-center gap-2 px-3 py-2 bg-white/50 rounded-xl border border-slate-200/50 shadow-sm backdrop-blur-sm hover:bg-white/80 transition-colors">
               <UserIcon size={16} className="text-slate-400" />
               {(['employee', 'member'].includes(role) && members.length > 0) ? (
                 <span className="text-sm font-medium px-2 text-slate-700">{members.find(m => m.id === memberId) ? `${members.find(m => m.id === memberId)!.firstName} ${members.find(m => m.id === memberId)!.lastName}` : 'Me'}</span>
               ) : (
                 <select 
                   value={memberId} 
                   onChange={(e)=>setMemberId(e.target.value)}
                   className="bg-transparent border-none outline-none text-sm font-medium min-w-[120px] cursor-pointer text-slate-700"
                   disabled={members.length === 0}
                 >
                   {members.length === 0 ? <option>No Members</option> : <option value="" disabled>Select Member</option>}
                   {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                 </select>
               )}
             </div>

             <button 
                onClick={() => { if(orgId && memberId) load(memberId, orgId) }}
                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Refresh Data"
                disabled={loading}
             >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Privacy & Settings */}
          <GlassCard className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Shield size={120} />
             </div>
             <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-6">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                  <Shield size={20} />
                </div>
                Privacy & Tracking
             </h3>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 hover:border-emerald-200 transition-colors">
                   <div className="text-[11px] uppercase tracking-wider text-emerald-600/70 font-bold mb-2">Tracking Status</div>
                   <div className="flex items-center gap-3">
                      <div className={`relative flex h-3 w-3`}>
                        {data.trackingOn && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${data.trackingOn ? 'bg-emerald-500' : 'bg-rose-400'}`}></span>
                      </div>
                      <span className={`font-semibold ${data.trackingOn ? 'text-emerald-700' : 'text-rose-500'}`}>
                        {data.trackingOn ? 'Active' : 'Inactive'}
                      </span>
                   </div>
                </div>
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 hover:border-blue-200 transition-colors">
                   <div className="text-[11px] uppercase tracking-wider text-blue-600/70 font-bold mb-2">Screenshots</div>
                   <div className="flex items-center gap-3">
                      {data.settings.allowScreenshots ? <Eye size={18} className="text-blue-500"/> : <EyeOff size={18} className="text-slate-400"/>}
                      <span className={`font-semibold ${data.settings.allowScreenshots ? 'text-blue-700' : 'text-slate-500'}`}>
                        {data.settings.allowScreenshots ? 'Enabled' : 'Disabled'}
                      </span>
                   </div>
                </div>
             </div>
             
             <div className="mt-6 flex items-start gap-3 text-xs text-indigo-600/70 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                <Lock size={14} className="mt-0.5 text-indigo-400" />
                <span className="leading-relaxed">Your privacy is protected. Only active apps, websites, and work-related snapshots are logged during working hours.</span>
             </div>
          </GlassCard>

          {/* Activity Metrics */}
          <GlassCard className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Zap size={120} />
             </div>
             <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-6">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                  <Zap size={20} />
                </div>
                Activity Metrics
                {showLocalStats && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200 animate-pulse">LIVE</span>}
             </h3>

             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 hover:border-orange-200 transition-colors">
                   <div className="text-[10px] text-orange-600/70 uppercase font-bold mb-1 tracking-wider">Active Time</div>
                   <div className="text-2xl font-bold text-gray-900 tabular-nums tracking-tight">{formatHMS(activeMinutes)}</div>
                </div>
                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50 hover:border-rose-200 transition-colors">
                   <div className="text-[10px] text-rose-600/70 uppercase font-bold mb-1 tracking-wider">Idle Time</div>
                   <div className="text-2xl font-bold text-rose-500 tabular-nums tracking-tight">{Math.round(idleMinutes)}m</div>
                </div>
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 hover:border-indigo-200 transition-colors">
                   <div className="text-[10px] text-indigo-600/70 uppercase font-bold mb-1 tracking-wider">Clicks</div>
                   <div className="text-2xl font-bold text-gray-900 tabular-nums tracking-tight flex items-center justify-center gap-1">
                      {totalClicks}
                      {pendingClicks > 0 && <span className="text-xs text-emerald-500 font-medium">+{pendingClicks}</span>}
                   </div>
                </div>
                <div className="p-4 bg-violet-50/50 rounded-2xl border border-violet-100/50 hover:border-violet-200 transition-colors">
                   <div className="text-[10px] text-violet-600/70 dark:text-violet-400/70 uppercase font-bold mb-1 tracking-wider">Keys</div>
                   <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight flex items-center justify-center gap-1">
                      {totalKeys}
                      {pendingKeys > 0 && <span className="text-xs text-emerald-500 font-medium">+{pendingKeys}</span>}
                   </div>
                </div>
             </div>
          </GlassCard>
        </div>

        {/* Top Apps Table */}
        <GlassCard title={<div className="flex items-center gap-2"><div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400"><Monitor size={16}/></div> Top Apps Today</div>} right={<ExportMenu isExporting={isExporting} onExport={handleExport} />}>
           {clientTopApps.length > 0 ? (
             <GlassTable 
                columns={['App', 'Active Minutes', 'Category']} 
                rows={clientTopApps.map((a: any) => [
                  <div key={a.app} className="font-medium text-slate-900 dark:text-slate-100">{a.app}</div>,
                  <div key={`${a.app}-time`} className="font-mono text-slate-600 dark:text-slate-400">{formatHM(a.minutes)}</div>,
                  <span key={`${a.app}-cat`} className={`px-2 py-0.5 rounded text-xs font-medium ${a.category === 'productive' ? 'bg-emerald-100 text-emerald-700' : a.category === 'unproductive' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-50 text-indigo-600'}`}>
                    {a.category || 'Uncategorized'}
                  </span>
                ])} 
             />
           ) : (
             <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-blue-50/50 dark:ring-blue-900/5">
                  <Monitor size={32} className="text-blue-500/50 dark:text-blue-400/50" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Activity Yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
                   We haven't recorded any app usage for today. 
                   {data.trackingOn ? " Keep working and your stats will appear here soon." : " Start tracking to see your productivity insights."}
                </p>
             </div>
           )}
        </GlassCard>

        {/* Timeline & Screenshots Grid */}
        <div className="grid grid-cols-1 gap-6">
           
           {/* Timeline */}
           <div className="w-full">
              <GlassCard title={<div className="flex items-center gap-2"><div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md text-purple-600 dark:text-purple-400"><Clock size={16}/></div> Timeline</div>} className="h-full">
                 <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                    {data.sessions?.length === 0 && data.breaks?.length === 0 && (
                       <div className="py-8 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/10 rounded-full flex items-center justify-center mb-3">
                             <Clock size={20} className="text-purple-300" />
                          </div>
                          <p className="text-sm text-gray-400">No timeline events yet.</p>
                       </div>
                    )}
                    
                    {data.sessions?.map((s: any) => (
                       <div key={s.id} className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                          <div className="mt-1"><Zap size={14} className="text-blue-500" /></div>
                          <div>
                             <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Work Session</div>
                             <div className="text-xs text-gray-500">
                                {new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {s.endTime ? new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Now'}
                             </div>
                          </div>
                       </div>
                    ))}

                    {data.breaks?.map((b: any) => (
                       <div key={b.id} className="flex items-start gap-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                          <div className="mt-1"><Clock size={14} className="text-amber-500" /></div>
                          <div>
                             <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Break ({b.reason || 'Pause'})</div>
                             <div className="text-xs text-gray-500">
                                {new Date(b.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {b.endTime ? new Date(b.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Now'}
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </GlassCard>
           </div>
        </div>
      </div>
    </AppShell>
  )
}
