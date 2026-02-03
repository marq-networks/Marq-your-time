"use client"
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@lib/export-utils'
import { normalizeRoleForApi } from '@lib/permissions'
import { DollarSign, Clock, FileText, AlertCircle, Calendar, Building2, User as UserIcon, TrendingUp, TrendingDown } from 'lucide-react'

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

  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const allItems = [
        ...fines.map(f => ({ date: f.date, type: 'Fine', reason: f.reason, amount: -f.amount, currency: f.currency })),
        ...adjustments.map(a => ({ date: a.date, type: 'Adjustment', reason: a.reason, amount: a.amount, currency: a.currency }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      if (allItems.length === 0) {
        alert('No data to export')
        return
      }

      const exportColumns: ExportColumn[] = [
        { header: 'Date', accessor: 'date' },
        { header: 'Type', accessor: 'type' },
        { header: 'Reason', accessor: 'reason' },
        { header: 'Amount', accessor: (item) => fmtCurrency(Math.abs(item.amount), item.currency) + (item.amount < 0 ? ' (Deduction)' : '') }
      ]

      const filename = `my_earnings_extras_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(allItems, exportColumns, filename)
      } else {
        await exportToPdf(allItems, exportColumns, 'Fines & Adjustments', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

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
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center gap-3">
            <div className="p-2 bg-emerald-100/50 rounded-xl backdrop-blur-sm shadow-sm">
              <DollarSign className="text-emerald-600" size={28} />
            </div>
            My Earnings
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">Review your payroll history, earnings, and adjustments.</p>
        </motion.div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap items-center gap-4"
        >
          <div className="min-w-[200px]">
             {(['employee','member'].includes(role)) ? (
               <div className="flex items-center gap-2 px-4 py-2.5 bg-white/50 rounded-xl border border-slate-200/50 shadow-sm backdrop-blur-sm">
                 <Building2 size={16} className="text-slate-400" />
                 <span className="text-sm font-medium px-2 text-slate-700">{orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}</span>
               </div>
             ) : (
               <GlassSelect 
                 value={orgId} 
                 onChange={(e: any)=>setOrgId(e.target.value)}
                 icon={Building2}
               >
                 <option value="">Select org</option>
                 {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
               </GlassSelect>
             )}
          </div>

          <div className="min-w-[200px]">
             {(['employee','member'].includes(role)) ? (
               <div className="flex items-center gap-2 px-4 py-2.5 bg-white/50 rounded-xl border border-slate-200/50 shadow-sm backdrop-blur-sm">
                 <UserIcon size={16} className="text-slate-400" />
                 <span className="text-sm font-medium px-2 text-slate-700">
                   {members.find(m => m.id === memberId) ? `${members.find(m => m.id === memberId)!.firstName} ${members.find(m => m.id === memberId)!.lastName}` : 'Me'}
                 </span>
               </div>
             ) : (
               <GlassSelect 
                 value={memberId} 
                 onChange={(e: any)=>setMemberId(e.target.value)}
                 icon={UserIcon}
                 disabled={!orgId}
               >
                 <option value="">Select member</option>
                 {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
               </GlassSelect>
             )}
          </div>

          <div className="min-w-[200px]">
             <GlassSelect 
               value={periodId} 
               onChange={(e: any)=>setPeriodId(e.target.value)}
               icon={Calendar}
               disabled={!orgId}
             >
               <option value="">Select period</option>
               {periods.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
             </GlassSelect>
          </div>
        </motion.div>

        {line ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Net Payable */}
            <GlassCard className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-white/80 to-emerald-50/50 border-emerald-100/50">
               <div className="absolute top-0 right-0 p-6 opacity-[0.05] rotate-12 transform translate-x-4 -translate-y-4">
                  <DollarSign size={200} />
               </div>
               <div className="flex items-center gap-3 mb-6 relative z-10">
                 <div className="p-2.5 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl text-emerald-600 shadow-sm">
                   <DollarSign size={24} />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800 tracking-tight">Net Payable</h3>
                   <p className="text-sm text-slate-500 font-medium">Total earnings after all adjustments</p>
                 </div>
               </div>

               <div className="flex flex-col md:flex-row md:items-end gap-6 mb-8 relative z-10">
                  <div className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
                    {fmtCurrency(line.netPayable, line.currency)}
                  </div>
                  {line.adjustmentsTotal !== 0 && (
                    <div className={`mb-2 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${line.adjustmentsTotal > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {line.adjustmentsTotal > 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                      {line.adjustmentsTotal > 0 ? '+' : ''}{fmtCurrency(line.adjustmentsTotal, line.currency)} adjustments
                    </div>
                  )}
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                     <div className="text-xs font-medium text-indigo-600/70 uppercase tracking-wider mb-1">Base Earnings</div>
                     <div className="text-lg font-semibold text-indigo-900">{fmtCurrency(line.baseEarnings, line.currency)}</div>
                  </div>
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                     <div className="text-xs font-medium text-blue-600/70 uppercase tracking-wider mb-1">Extra</div>
                     <div className="text-lg font-semibold text-blue-700">+{fmtCurrency(line.extraEarnings, line.currency)}</div>
                  </div>
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                     <div className="text-xs font-medium text-amber-600/70 uppercase tracking-wider mb-1">Short</div>
                     <div className="text-lg font-semibold text-amber-700">-{fmtCurrency(line.deductionForShort, line.currency)}</div>
                  </div>
                  <div className="p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                     <div className="text-xs font-medium text-red-600/70 uppercase tracking-wider mb-1">Fines</div>
                     <div className="text-lg font-semibold text-red-700">-{fmtCurrency(line.finesTotal, line.currency)}</div>
                  </div>
               </div>
            </GlassCard>

            {/* Hours Summary */}
            <GlassCard>
               <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                   <Clock size={20} />
                 </div>
                 <h3 className="text-lg font-semibold text-slate-800">Hours Summary</h3>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                     <div className="text-sm font-medium text-indigo-700">Scheduled</div>
                     <div className="text-lg font-bold text-indigo-900">{fmtHM(line.totalScheduledMinutes)}</div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                     <div className="text-sm font-medium text-emerald-700">Worked</div>
                     <div className="text-lg font-bold text-emerald-700">{fmtHM(line.totalWorkedMinutes)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-center">
                        <div className="text-xs font-medium text-blue-600/70 uppercase mb-1">Extra</div>
                        <div className="text-lg font-bold text-blue-700">{fmtHM(line.totalExtraMinutes)}</div>
                     </div>
                     <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 text-center">
                        <div className="text-xs font-medium text-amber-600/70 uppercase mb-1">Short</div>
                        <div className="text-lg font-bold text-amber-700">{fmtHM(line.totalShortMinutes)}</div>
                     </div>
                  </div>
               </div>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="py-20 text-center"
          >
             <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-indigo-50/50 shadow-sm">
               <DollarSign size={40} className="text-indigo-400" />
             </div>
             <h3 className="text-xl font-semibold text-indigo-900 mb-2">No Period Selected</h3>
             <p className="text-indigo-500/70 max-w-sm mx-auto">Select an organization, member, and payroll period to view earnings details.</p>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
           <div className="lg:col-span-2">
              <GlassCard title={<div className="flex items-center gap-2"><div className="p-1.5 bg-orange-100 rounded-md text-orange-600"><AlertCircle size={16}/></div> Fines & Adjustments</div>} right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}>
                 {fines.length === 0 && adjustments.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">No fines or adjustments for this period.</div>
                 ) : (
                    <GlassTable 
                      columns={[ 'Date', 'Type', 'Reason', 'Amount' ]} 
                      rows={[ 
                        ...fines.map(f=> [ f.date, <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Fine</span>, f.reason, <span className="font-mono text-red-600">-{fmtCurrency(f.amount, f.currency)}</span> ]), 
                        ...adjustments.map(a=> [ a.date, <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.amount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>Adjustment</span>, a.reason, <span className={`font-mono ${a.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{a.amount >= 0 ? '+' : ''}{fmtCurrency(a.amount, a.currency)}</span> ]) 
                      ]} 
                    />
                 )}
              </GlassCard>
           </div>
           
           <div>
              <GlassCard title={<div className="flex items-center gap-2"><div className="p-1.5 bg-indigo-100 rounded-md text-indigo-600"><FileText size={16}/></div> Documents</div>}>
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50 mb-4">
                   <h4 className="font-medium text-indigo-900 mb-1">My Payslips</h4>
                   <p className="text-xs text-indigo-600/80 mb-4">Access and download your detailed payslips for all periods.</p>
                   <GlassButton
                      variant="primary"
                      href="/my/payslips"
                      className="w-full justify-center bg-gradient-to-r from-indigo-500 to-violet-500 border-none text-white shadow-md hover:shadow-lg transition-all"
                    >
                      View All Payslips
                    </GlassButton>
                </div>
              </GlassCard>
           </div>
        </motion.div>
      </div>
    </AppShell>
  )
}
