"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import AdjustmentLogTable from '@components/hr/AdjustmentLogTable'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }

export default function MyAdjustmentsPage() {
  const [role, setRole] = useState('')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Filters
  const [moduleId, setModuleId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { 
    try { 
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r) 
    } catch {} 
  }, [])

  const loadOrgs = async () => {
    // For employees, typically 'my' orgs
    const endpoint = '/api/orgs/my'
    const res = await fetch(endpoint, { cache: 'no-store' })
    const data = await res.json()
    const items: Org[] = Array.isArray(data.items) ? (data.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    }
  }

  const loadLogs = async () => {
    if (!orgId) return
    setLoading(true)
    // We don't pass employeeUserId because the API will infer it from the token/session for non-admins,
    // or if we are an employee, we want our own.
    // Actually, passing it explicitly as "me" or just relying on API default is fine.
    // API logic: "if not admin... ensure they are only requesting their own logs... targetEmployeeId = actorId"
    // So we don't need to pass it.
    let url = `/api/hr-adjustments-log/list?orgId=${orgId}`
    if (moduleId) url += `&module=${moduleId}`
    if (dateFrom) url += `&from=${dateFrom}`
    if (dateTo) url += `&to=${dateTo}`
    
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      setLogs(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) { loadLogs(); } }, [orgId])
  useEffect(() => { if (orgId) loadLogs() }, [moduleId, dateFrom, dateTo])

  return (
    <AppShell title="My Adjustments">
      <GlassCard>
        <div className="grid grid-3" style={{gap:16, marginBottom:20}}>
           {/* If user belongs to multiple orgs, they can switch. If only one, maybe hide or show as read-only */}
           {orgs.length > 1 ? (
              <div>
                <div className="label">Organization</div>
                <GlassSelect value={orgId} onChange={(e: any)=>setOrgId(e.target.value)}>
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              </div>
           ) : (
             <div/> 
           )}
          
          <div>
            <div className="label">Module</div>
            <GlassSelect value={moduleId} onChange={(e: any)=>setModuleId(e.target.value)}>
              <option value="">All Modules</option>
              <option value="time_logs">Time Logs</option>
              <option value="breaks">Breaks</option>
              <option value="attendance">Attendance</option>
              <option value="pto">PTO</option>
              <option value="payroll">Payroll</option>
            </GlassSelect>
          </div>
          
          <div className="grid grid-2" style={{gap:8}}>
             <div>
               <div className="label">From</div>
               <GlassInput type="date" value={dateFrom} onChange={(e: any)=>setDateFrom(e.target.value)} />
             </div>
             <div>
               <div className="label">To</div>
               <GlassInput type="date" value={dateTo} onChange={(e: any)=>setDateTo(e.target.value)} />
             </div>
          </div>
        </div>

        <AdjustmentLogTable logs={logs} loading={loading} />
      </GlassCard>
    </AppShell>
  )
}
