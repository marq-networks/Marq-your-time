"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

type KR = { id: string, label: string, target_value: number|null, current_value: number, unit?: string|null }
type Objective = { id: string, title: string, description: string, weight: number, key_results: KR[] }
type OKRSet = { id: string, level: string, title: string, period_start: string, period_end: string, objectives: Objective[] }
type Checkin = { id: string, period_start: string, period_end: string, summary: string, self_score: number|null, manager_score: number|null, created_at: string }

function pct(kr: KR) { const t = kr.target_value ?? 0; if (!t) return 0; return Math.round(Math.min(100, Math.max(0, (kr.current_value / t) * 100))) }

export default function MyPerformancePage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [okrs, setOkrs] = useState<OKRSet[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])

  const [updateOpen, setUpdateOpen] = useState(false)
  const [targetKr, setTargetKr] = useState<KR | null>(null)
  const [newValue, setNewValue] = useState('')

  const [checkOpen, setCheckOpen] = useState(false)
  const [checkForm, setCheckForm] = useState({ period_start: '', period_end: '', summary: '', self_score: '' })

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]); if(!memberId && d.items?.length) setMemberId(d.items[0].id) }
  const loadOKRs = async () => { if(!orgId||!memberId) return; const res = await fetch(`/api/performance/okr-set/list?org_id=${orgId}&member_id=${memberId}`, { cache:'no-store' }); const d = await res.json(); setOkrs(d.items||[]) }
  const loadCheckins = async () => { if(!orgId||!memberId) return; const res = await fetch(`/api/performance/checkin/list?org_id=${orgId}&member_id=${memberId}`, { cache:'no-store' }); const d = await res.json(); setCheckins(d.items||[]) }

  const submitUpdate = async () => {
    if (!targetKr) return
    const value = Number(newValue)
    if (Number.isNaN(value)) return
    await fetch('/api/performance/kr/update', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': memberId, 'x-role':'member' }, body: JSON.stringify({ kr_id: targetKr.id, current_value: value }) })
    setUpdateOpen(false); setNewValue(''); setTargetKr(null)
    loadOKRs()
  }

  const submitCheckin = async () => {
    if (!orgId || !memberId || !checkForm.period_start || !checkForm.period_end) return
    const payload: any = { org_id: orgId, member_id: memberId, period_start: checkForm.period_start, period_end: checkForm.period_end, summary: checkForm.summary }
    if (checkForm.self_score) payload.self_score = Number(checkForm.self_score)
    await fetch('/api/performance/checkin/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': memberId, 'x-role':'member' }, body: JSON.stringify(payload) })
    setCheckOpen(false); setCheckForm({ period_start:'', period_end:'', summary:'', self_score:'' })
    loadCheckins()
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadMembers(orgId) } }, [orgId])
  useEffect(()=>{ if(orgId && memberId){ loadOKRs(); loadCheckins() } }, [orgId, memberId])

  return (
    <AppShell title="My Performance">
      <GlassCard title="Select">
        <div className="grid grid-2">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Me</div>
            <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
              <option value="">Select</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      {okrs.map(set => (
        <GlassCard key={set.id} title={`${set.title} (${set.period_start} – ${set.period_end})`}>
          {(set.objectives||[]).map(obj => (
            <div key={obj.id} className="glass-panel" style={{borderRadius:28,padding:16,marginBottom:12,background:'rgba(255,255,255,0.20)',border:'1px solid rgba(255,255,255,0.35)'}}>
              <div className="title">{obj.title}</div>
              {(obj.key_results||[]).map(kr => (
                <div key={kr.id} style={{marginTop:8}}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div className="subtitle">{kr.label}</div>
                    <div className="row" style={{gap:8, alignItems:'center'}}>
                      <div className="subtitle">{kr.current_value}{kr.unit?` ${kr.unit}`:''} / {kr.target_value ?? 0}{kr.unit?` ${kr.unit}`:''}</div>
                      <GlassButton variant="secondary" onClick={()=>{ setTargetKr(kr); setNewValue(String(kr.current_value||'')); setUpdateOpen(true) }}>Update</GlassButton>
                    </div>
                  </div>
                  <div style={{height:8, borderRadius:12, background:'rgba(255,255,255,0.18)'}}>
                    <div style={{height:8, borderRadius:12, width:`${pct(kr)}%`, background:'#39FF14'}}></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </GlassCard>
      ))}

      <GlassCard title="Self Check-ins" right={<GlassButton onClick={()=>setCheckOpen(true)}>New</GlassButton>}>
        <div className="grid grid-1">
          {(checkins||[]).map(c => (
            <div key={c.id} className="row" style={{gap:8, alignItems:'center'}}>
              <span className="badge">{c.period_start} – {c.period_end}</span>
              <span className="subtitle">{c.summary}</span>
              {c.self_score !== null && <span className="badge" style={{borderColor:'#39FF14', color:'#39FF14'}}>Self {c.self_score}</span>}
              {c.manager_score !== null && <span className="badge">Mgr {c.manager_score}</span>}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassModal open={updateOpen} title="Update Key Result" onClose={()=>setUpdateOpen(false)}>
        {targetKr && (
          <div>
            <div className="label">New Value</div>
            <input className="input" type="number" value={newValue} onChange={e=>setNewValue(e.target.value)} />
            <div className="row" style={{justifyContent:'flex-end', gap:8, marginTop:12}}>
              <GlassButton variant="primary" onClick={submitUpdate}>Save</GlassButton>
            </div>
          </div>
        )}
      </GlassModal>

      <GlassModal open={checkOpen} title="New Check-in" onClose={()=>setCheckOpen(false)}>
        <div className="grid grid-2">
          <div>
            <div className="label">Period Start</div>
            <input className="input" type="date" value={checkForm.period_start} onChange={e=>setCheckForm({...checkForm, period_start:e.target.value})} />
          </div>
          <div>
            <div className="label">Period End</div>
            <input className="input" type="date" value={checkForm.period_end} onChange={e=>setCheckForm({...checkForm, period_end:e.target.value})} />
          </div>
        </div>
        <div style={{marginTop:12}}>
          <div className="label">Summary</div>
          <input className="input" value={checkForm.summary} onChange={e=>setCheckForm({...checkForm, summary:e.target.value})} />
        </div>
        <div style={{marginTop:12}}>
          <div className="label">Self Score</div>
          <input className="input" type="number" value={checkForm.self_score} onChange={e=>setCheckForm({...checkForm, self_score:e.target.value})} />
        </div>
        <div className="row" style={{justifyContent:'flex-end', gap:8, marginTop:12}}>
          <GlassButton onClick={submitCheckin}>Submit</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}

