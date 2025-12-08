"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

type Org = { id: string, orgName: string }
type Dept = { id: string, name: string }
type User = { id: string, firstName: string, lastName: string }

type KR = { id: string, label: string, target_value: number|null, current_value: number, unit?: string|null, direction?: string|null }
type Objective = { id: string, title: string, description: string, weight: number, key_results: KR[] }
type OKRSet = { id: string, level: string, title: string, period_start: string, period_end: string, department_id?: string|null, member_id?: string|null, objectives: Objective[] }

function progressPercent(kr: KR) {
  const target = (kr.target_value ?? 0)
  const cur = Math.max(0, kr.current_value || 0)
  if (!target) return 0
  const pct = Math.round(Math.min(100, Math.max(0, (cur / target) * 100)))
  return pct
}

export default function OKRPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [departments, setDepartments] = useState<Dept[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [level, setLevel] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [items, setItems] = useState<OKRSet[]>([])

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadDepartments = async (oid: string) => { const res = await fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setDepartments(d.items||[]) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]) }
  const loadOKRs = async () => {
    if (!orgId) return
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    if (level) params.set('level', level)
    if (departmentId) params.set('department_id', departmentId)
    if (memberId) params.set('member_id', memberId)
    if (periodStart && periodEnd) { params.set('period_start', periodStart); params.set('period_end', periodEnd) }
    const res = await fetch(`/api/performance/okr-set/list?${params.toString()}`, { cache:'no-store' })
    const d = await res.json()
    setItems(d.items||[])
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadDepartments(orgId); loadMembers(orgId); loadOKRs() } }, [orgId])
  useEffect(()=>{ loadOKRs() }, [level, departmentId, memberId, periodStart, periodEnd])

  return (
    <AppShell title="Performance & OKRs">
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
            <div className="label">Level</div>
            <GlassSelect value={level} onChange={(e:any)=>setLevel(e.target.value)}>
              <option value="">All</option>
              <option value="company">Company</option>
              <option value="department">Department</option>
              <option value="member">Member</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Department</div>
            <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
              <option value="">All</option>
              {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </GlassSelect>
          </div>
        </div>
        <div className="grid grid-3" style={{marginTop:12}}>
          <div>
            <div className="label">Member</div>
            <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
              <option value="">All</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Period Start</div>
            <input className="input" type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} />
          </div>
          <div>
            <div className="label">Period End</div>
            <input className="input" type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} />
          </div>
        </div>
      </GlassCard>

      {items.map(set => (
        <GlassCard key={set.id} title={`${set.title} (${set.level})`}>
          {(set.objectives||[]).map(obj => (
            <div key={obj.id} className="glass-panel" style={{borderRadius:28, padding:16, marginBottom:12, background:'rgba(255,255,255,0.20)', border:'1px solid rgba(255,255,255,0.35)', backdropFilter:'blur(12px)'}}>
              <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div className="subtitle">Objective</div>
                  <div className="title">{obj.title}</div>
                </div>
                <div className="badge" style={{borderColor:'#39FF14', color:'#39FF14'}}>Weight {obj.weight}</div>
              </div>
              {(obj.key_results||[]).map(kr => {
                const pct = progressPercent(kr)
                return (
                  <div key={kr.id} style={{marginTop:12}}>
                    <div className="row" style={{justifyContent:'space-between'}}>
                      <div className="subtitle">{kr.label}</div>
                      <div className="subtitle">{kr.current_value}{kr.unit?` ${kr.unit}`:''} / {kr.target_value ?? 0}{kr.unit?` ${kr.unit}`:''}</div>
                    </div>
                    <div style={{height:8, borderRadius:12, background:'rgba(255,255,255,0.18)'}}>
                      <div style={{height:8, borderRadius:12, width:`${pct}%`, background:'#39FF14'}}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </GlassCard>
      ))}

      {!items.length && (
        <div className="row" style={{justifyContent:'center', marginTop:16}}>
          <GlassButton variant="secondary" onClick={loadOKRs}>Refresh</GlassButton>
        </div>
      )}
    </AppShell>
  )
}
