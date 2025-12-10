"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

type Org = { id: string, orgName: string }
type Member = { id: string, firstName: string, lastName: string }
type PrefRow = { eventType: string, inApp: boolean, email: boolean }

const EVENTS: { key: string, label: string }[] = [
  { key: 'member.check_in', label: 'Member check-in' },
  { key: 'member.check_out', label: 'Member check-out' },
  { key: 'time.daily_closed', label: 'Daily summary closed' },
  { key: 'leave.request_created', label: 'Leave request created' },
  { key: 'leave.request_approved', label: 'Leave request approved' },
  { key: 'leave.request_rejected', label: 'Leave request rejected' },
  { key: 'payroll.period_approved', label: 'Payroll period approved' }
]

export default function NotificationSettingsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [rows, setRows] = useState<PrefRow[]>([])
  const [digest, setDigest] = useState<'none'|'daily'|'weekly'>('none')

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if (!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]) }
  const loadPrefs = async (mid: string) => {
    const res = await fetch(`/api/notifications-settings/preferences?member_id=${mid}`, { cache:'no-store' })
    const d = await res.json()
    const map = new Map<string, { in_app?: boolean, email?: boolean }>()
    for (const it of (d.items||[])) {
      const cur = map.get(it.eventType) || {}
      if (it.channel === 'in_app') cur.in_app = !!it.enabled
      if (it.channel === 'email') cur.email = !!it.enabled
      map.set(it.eventType, cur)
    }
    const base = EVENTS.map(e => ({ eventType: e.key, inApp: map.get(e.key)?.in_app ?? true, email: map.get(e.key)?.email ?? true }))
    setRows(base)
  }
  const loadDigest = async (mid: string) => { const res = await fetch(`/api/notifications-settings/digests?member_id=${mid}`, { cache:'no-store' }); const d = await res.json(); setDigest((d.frequency||'none')) }

  const savePrefs = async () => {
    if (!memberId) return
    const items = rows.flatMap(r => ([{ event_type: r.eventType, channel: 'in_app', enabled: r.inApp }, { event_type: r.eventType, channel: 'email', enabled: r.email }]))
    await fetch('/api/notifications-settings/preferences/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: memberId, items }) })
  }
  const saveDigest = async () => { if (!memberId) return; await fetch('/api/notifications-settings/digests/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: memberId, frequency: digest }) }) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(()=>{ if (memberId) { loadPrefs(memberId); loadDigest(memberId) } }, [memberId])

  const columns = useMemo(()=>['Event', 'In-app', 'Email'], [])
  const tableRows = rows.map(r => [
    EVENTS.find(e=>e.key===r.eventType)?.label || r.eventType,
    <input type="checkbox" className="toggle" checked={r.inApp} onChange={e=> setRows(rows.map(rr=> rr.eventType===r.eventType ? { ...rr, inApp: e.target.checked } : rr))} />,
    <input type="checkbox" className="toggle" checked={r.email} onChange={e=> setRows(rows.map(rr=> rr.eventType===r.eventType ? { ...rr, email: e.target.checked } : rr))} />
  ])

  return (
    <AppShell title="Notification Settings">
      <GlassCard title="Select Member">
        <div className="grid grid-2">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Member</div>
            <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
              <option value="">Select member</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Event-based preferences">
        <GlassTable columns={columns} rows={tableRows} />
        <div className="row" style={{ marginTop: 12 }}>
          <GlassButton variant="primary" onClick={savePrefs} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Save Preferences</GlassButton>
        </div>
      </GlassCard>

      <GlassCard title="Digest settings">
        <div className="row" style={{ gap: 16 }}>
          <label className="row" style={{ gap: 8 }}>
            <input type="radio" name="digest" checked={digest==='none'} onChange={()=>setDigest('none')} />
            <span className="label">None</span>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="radio" name="digest" checked={digest==='daily'} onChange={()=>setDigest('daily')} />
            <span className="label">Daily</span>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="radio" name="digest" checked={digest==='weekly'} onChange={()=>setDigest('weekly')} />
            <span className="label">Weekly</span>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <GlassButton variant="primary" onClick={saveDigest} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Save Digest</GlassButton>
        </div>
      </GlassCard>
    </AppShell>
  )
}
