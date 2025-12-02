"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

type Org = { id: string, orgName: string }
type Member = { id: string, firstName: string, lastName: string }

export default function NotificationPreferencesPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [inappEnabled, setInappEnabled] = useState(true)

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if (!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]) }
  const loadPrefs = async (mid: string) => { const res = await fetch(`/api/notifications/preferences?member_id=${mid}`, { cache:'no-store' }); const d = await res.json(); setEmailEnabled(!!d.prefs?.emailEnabled); setInappEnabled(!!d.prefs?.inappEnabled) }
  const save = async () => { if(!memberId) return; await fetch('/api/notifications/preferences/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: memberId, email_enabled: emailEnabled, inapp_enabled: inappEnabled }) }) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadMembers(orgId) }, [orgId])
  useEffect(()=>{ if(memberId) loadPrefs(memberId) }, [memberId])

  return (
    <AppShell title="Notification Preferences">
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
      <GlassCard title="Preferences">
        <div className="grid grid-1">
          <label className="row" style={{gap:8}}>
            <input type="checkbox" className="toggle" checked={emailEnabled} onChange={(e)=>setEmailEnabled(e.target.checked)} />
            <span className="label">Email notifications</span>
          </label>
          <label className="row" style={{gap:8}}>
            <input type="checkbox" className="toggle" checked={inappEnabled} onChange={(e)=>setInappEnabled(e.target.checked)} />
            <span className="label">In-app notifications</span>
          </label>
          <div className="row">
            <GlassButton variant="primary" onClick={save} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Save</GlassButton>
          </div>
        </div>
      </GlassCard>
    </AppShell>
  )
}
