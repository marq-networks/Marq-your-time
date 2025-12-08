"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import usePermission from '@lib/hooks/usePermission'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

function formatHM(mins: number) {
  const m = Math.max(0, Math.round(mins || 0))
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2,'0')
  return `${h}:${mm}`
}

export default function TimeLogsPage() {
  const canReports = usePermission('manage_reports').allowed
  const canTime = usePermission('manage_time').allowed
  const allowed = canReports || canTime
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [memberId, setMemberId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [items, setItems] = useState<any[]>([])
  const [detail, setDetail] = useState<{ memberId: string, orgId: string, date: string } | undefined>()
  const [detailData, setDetailData] = useState<any>({ sessions: [], breaks: [] })

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache: 'no-store', headers: { 'x-user-id': 'demo-user' } })
    const data = await res.json()
    setOrgs(data.items || [])
    if (!orgId && data.items?.length) setOrgId(data.items[0].id)
  }
  const loadMembers = async (oid: string) => {
    if (!oid) return
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setMembers(data.items || [])
  }
  const loadLogs = async (oid: string, dt: string, mid?: string) => {
    if (!oid || !dt) return
    const url = `/api/time/logs?org_id=${oid}&date=${dt}` + (mid ? `&member_id=${mid}` : '')
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    setItems(data.items || [])
  }
  const openDetail = async (mid: string) => {
    setDetail({ memberId: mid, orgId, date })
    const res = await fetch(`/api/time/logs?org_id=${orgId}&date=${date}&member_id=${mid}`, { cache: 'no-store' })
    const data = await res.json()
    setDetailData({ sessions: data.sessions || [], breaks: data.breaks || [] })
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) { loadMembers(orgId); loadLogs(orgId, date, memberId || undefined) } }, [orgId, date, memberId])

  const columns = ['Member','Department','Date','Scheduled','Worked','Extra','Short','Status','Action']
  const rows = items.map(it => [
    it.memberName,
    it.departmentName,
    it.date,
    formatHM(it.scheduledMinutes || 0),
    formatHM(it.workedMinutes || 0),
    formatHM(it.extraMinutes || 0),
    formatHM(it.shortMinutes || 0),
    <span className="badge">{it.isHoliday ? 'Holiday' : it.status}</span>,
    <GlassButton onClick={()=>openDetail(it.memberId)}>View day</GlassButton>
  ])

  if (!allowed) return (
    <AppShell title="Time Logs">
      <GlassCard title="Access Denied">
        <div className="subtitle">You do not have permission to view time logs.</div>
      </GlassCard>
    </AppShell>
  )

  return (
    <AppShell title="Time Logs">
      <GlassCard title="Filters">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Date</div>
            <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div>
            <div className="label">Member</div>
            <GlassSelect value={memberId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setMemberId(e.target.value)}>
              <option value="">All members</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Daily Time Logs">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={!!detail} title="Day Detail" onClose={()=>setDetail(undefined)}>
        <div className="subtitle">Sessions</div>
        <table className="glass-table">
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(detailData.sessions||[]).map((s: any) => (
              <tr key={s.id}>
                <td>{new Date(s.startTime).toLocaleTimeString()}</td>
                <td>{s.endTime ? new Date(s.endTime).toLocaleTimeString() : '...'}</td>
                <td>{formatHM(s.totalMinutes || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="subtitle" style={{marginTop:12}}>Breaks</div>
        <table className="glass-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Start</th>
              <th>End</th>
              <th>Minutes</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {(detailData.breaks||[]).map((b: any) => (
              <tr key={b.id}>
                <td>{b.label}</td>
                <td>{new Date(b.startTime).toLocaleTimeString()}</td>
                <td>{b.endTime ? new Date(b.endTime).toLocaleTimeString() : '...'}</td>
                <td>{formatHM(b.totalMinutes || 0)}</td>
                <td>{b.isPaid ? 'Paid' : 'Unpaid'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassModal>
    </AppShell>
  )
}
