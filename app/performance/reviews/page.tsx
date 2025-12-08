"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type Checkin = { id: string, member_id: string, period_start: string, period_end: string, summary: string, self_score: number|null, manager_score: number|null }

export default function ReviewsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [items, setItems] = useState<Checkin[]>([])

  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<Checkin | null>(null)
  const [mgrScore, setMgrScore] = useState('')
  const [comment, setComment] = useState('')

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]) }
  const loadItems = async () => { if(!orgId) return; const qs = new URLSearchParams(); qs.set('org_id', orgId); if (memberId) qs.set('member_id', memberId); const res = await fetch(`/api/performance/checkin/list?${qs.toString()}`, { cache:'no-store' }); const d = await res.json(); setItems(d.items||[]) }

  const submitReview = async () => {
    if (!target || !orgId) return
    const payload: any = { org_id: orgId, member_id: target.member_id, period_start: target.period_start, period_end: target.period_end, manager_score: mgrScore ? Number(mgrScore) : undefined, summary: comment }
    await fetch('/api/performance/checkin/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role':'manager' }, body: JSON.stringify(payload) })
    setOpen(false); setTarget(null); setMgrScore(''); setComment('')
    loadItems()
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadMembers(orgId); loadItems() } }, [orgId])
  useEffect(()=>{ loadItems() }, [memberId])

  return (
    <AppShell title="Team Reviews">
      <GlassCard title="Filters">
        <div className="grid grid-3">
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
              <option value="">All</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Check-ins">
        <div className="grid grid-1">
          {(items||[]).map(ci => (
            <div key={ci.id} className="row" style={{gap:8, alignItems:'center'}}>
              <span className="badge">{ci.period_start} – {ci.period_end}</span>
              <span className="subtitle">{ci.summary}</span>
              {ci.self_score !== null && <span className="badge">Self {ci.self_score}</span>}
              {ci.manager_score !== null && <span className="badge" style={{borderColor:'#39FF14', color:'#39FF14'}}>Mgr {ci.manager_score}</span>}
              <GlassButton variant="secondary" onClick={()=>{ setTarget(ci); setOpen(true) }}>Add Manager Score</GlassButton>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassModal open={open} title="Manager Review" onClose={()=>setOpen(false)}>
        {target && (
          <div>
            <div className="label">Manager Score</div>
            <input className="input" type="number" value={mgrScore} onChange={e=>setMgrScore(e.target.value)} />
            <div className="label" style={{marginTop:12}}>Comments</div>
            <input className="input" value={comment} onChange={e=>setComment(e.target.value)} />
            <div className="row" style={{justifyContent:'flex-end', gap:8, marginTop:12}}>
              <GlassButton variant="primary" onClick={submitReview}>Save</GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}

