"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type Period = { id: string, name: string, status: string }

function fmtCurrency(v: number, curr = 'USD') { try { return new Intl.NumberFormat(undefined, { style:'currency', currency: curr }).format(v) } catch { return `${curr} ${v.toFixed(2)}` } }
function fmtHM(mins: number) { const m = Math.max(0, Math.round(mins||0)); const h=Math.floor(m/60); const mm=String(m%60).padStart(2,'0'); return `${h}:${mm}` }

export default function MyEarningsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [memberId, setMemberId] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [periodId, setPeriodId] = useState('')
  const [line, setLine] = useState<any | undefined>()
  const [fines, setFines] = useState<any[]>([])
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [role, setRole] = useState('')

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache:'no-store' })
    const d = await res.json()
    const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    }
  }
  const loadMembers = async (oid: string) => {
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' })
    const d = await res.json()
    const items: User[] = Array.isArray(d.items) ? (d.items as User[]) : []
    setMembers(items)
    if (!memberId && items.length) {
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      const preferredMember = items.find(m => m.id === cookieUserId)?.id || items[0].id
      setMemberId(preferredMember)
    }
  }
  const loadPeriods = async (oid: string) => { const res = await fetch(`/api/payroll/periods?org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); setPeriods(d.items||[]); if(!periodId && d.items?.length) setPeriodId(d.items[0].id) }
  const loadLine = async (mid: string, oid: string, pid: string) => { const res = await fetch(`/api/payroll/member?member_id=${mid}&org_id=${oid}&period_id=${pid}`, { cache:'no-store' }); const d = await res.json(); setLine(d.line); }
  const loadExtras = async (mid: string, oid: string, pid: string) => { const [fRes, aRes] = await Promise.all([ fetch(`/api/payroll/fines?member_id=${mid}&org_id=${oid}&period_id=${pid}`, { cache:'no-store' }), fetch(`/api/payroll/adjustments?member_id=${mid}&org_id=${oid}&period_id=${pid}`, { cache:'no-store' }) ]); const [f,a] = await Promise.all([ fRes.json(), aRes.json() ]); setFines(f.items||[]); setAdjustments(a.items||[]) }

  useEffect(()=>{ try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(() => {
    try {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      if (!orgId && cookieOrgId) setOrgId(cookieOrgId)
      if (!memberId && cookieUserId) setMemberId(cookieUserId)
    } catch {}
  }, [])
  useEffect(()=>{ loadOrgs() }, [role])
  useEffect(()=>{ if(orgId) { loadMembers(orgId); loadPeriods(orgId) } }, [orgId])
  useEffect(()=>{ if(orgId && memberId && periodId) { loadLine(memberId, orgId, periodId); loadExtras(memberId, orgId, periodId) } }, [orgId, memberId, periodId])

  return (
    <AppShell title="My Earnings">
      <GlassCard title="Select Period">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">{orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}</span>
            ) : (
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            )}
          </div>
          <div>
            <div className="label">Me</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">
                {members.find(m => m.id === memberId) ? `${members.find(m => m.id === memberId)!.firstName} ${members.find(m => m.id === memberId)!.lastName}` : 'Me'}
              </span>
            ) : (
              <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
                <option value="">Select member</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            )}
          </div>
          <div>
            <div className="label">Payroll Period</div>
            <GlassSelect value={periodId} onChange={(e:any)=>setPeriodId(e.target.value)}>
              <option value="">Select period</option>
              {periods.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      {line && (
        <div className="grid grid-2">
          <GlassCard title="Net Payable">
            <div className="title">{fmtCurrency(line.netPayable, line.currency)}</div>
            <div className="subtitle">Base: {fmtCurrency(line.baseEarnings, line.currency)} • Extra: +{fmtCurrency(line.extraEarnings, line.currency)} • Short: -{fmtCurrency(line.deductionForShort, line.currency)} • Fines: -{fmtCurrency(line.finesTotal, line.currency)} • Adjustments: {line.adjustmentsTotal >= 0 ? '+' : ''}{fmtCurrency(line.adjustmentsTotal, line.currency)}</div>
          </GlassCard>
          <GlassCard title="Hours Summary">
            <div className="subtitle">Scheduled: {fmtHM(line.totalScheduledMinutes)} • Worked: {fmtHM(line.totalWorkedMinutes)}</div>
            <div className="subtitle">Extra: {fmtHM(line.totalExtraMinutes)} • Short: {fmtHM(line.totalShortMinutes)}</div>
          </GlassCard>
        </div>
      )}

      <GlassCard title="Fines & Adjustments">
        <GlassTable columns={[ 'Date', 'Type', 'Reason', 'Amount' ]} rows={[ ...fines.map(f=> [ f.date, 'Fine', f.reason, `-${fmtCurrency(f.amount, f.currency)}` ]), ...adjustments.map(a=> [ a.date, 'Adjustment', a.reason, `${a.amount >= 0 ? '+' : ''}${fmtCurrency(a.amount, a.currency)}` ]) ]} />
      </GlassCard>
    </AppShell>
  )
}
