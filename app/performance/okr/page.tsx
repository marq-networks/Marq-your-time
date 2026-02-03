"use client"
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { Target, Filter, RefreshCw, Calendar, Layers, Users, Building2, Search, ArrowRight, LayoutGrid, CheckCircle2 } from 'lucide-react'

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
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (items.length === 0) {
        // No op
        return
      }

      // Flatten data for export
      const exportItems: any[] = []
      items.forEach(set => {
        set.objectives.forEach(obj => {
          obj.key_results.forEach(kr => {
            exportItems.push({
              setTitle: set.title,
              level: set.level,
              objectiveTitle: obj.title,
              weight: obj.weight,
              krLabel: kr.label,
              current: kr.current_value,
              target: kr.target_value,
              unit: kr.unit || '',
              progress: progressPercent(kr)
            })
          })
        })
      })

      const exportColumns: ExportColumn[] = [
        { header: 'OKR Set', accessor: 'setTitle' },
        { header: 'Level', accessor: 'level' },
        { header: 'Objective', accessor: 'objectiveTitle' },
        { header: 'Weight', accessor: (i) => String(i.weight) },
        { header: 'Key Result', accessor: 'krLabel' },
        { header: 'Current', accessor: (i) => `${i.current}${i.unit ? ' ' + i.unit : ''}` },
        { header: 'Target', accessor: (i) => `${i.target}${i.unit ? ' ' + i.unit : ''}` },
        { header: 'Progress', accessor: (i) => `${i.progress}%` }
      ]

      const filename = `marq_okrs_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'Performance OKRs', filename)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsExporting(false)
    }
  }

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadDepartments = async (oid: string) => { const res = await fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setDepartments(d.items||[]) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]) }
  const loadOKRs = async () => {
    if (!orgId) {
      if (orgs.length === 0) loadOrgs()
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('org_id', orgId)
      if (level) params.set('level', level)
      if (departmentId) params.set('department_id', departmentId)
      if (memberId) params.set('member_id', memberId)
      if (periodStart && periodEnd) { params.set('period_start', periodStart); params.set('period_end', periodEnd) }
      const res = await fetch(`/api/performance/okr-set/list?${params.toString()}`, { cache:'no-store' })
      const d = await res.json()
      setItems(d.items||[])
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadDepartments(orgId); loadMembers(orgId); loadOKRs() } }, [orgId])
  useEffect(()=>{ if(orgId) loadOKRs() }, [level, departmentId, memberId, periodStart, periodEnd])

  return (
    <AppShell title="Performance & OKRs">
      <div className="mb-6">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 text-primary">
              <Filter size={20} />
              <h3 className="font-semibold text-lg">Filters</h3>
            </div>
            <div className="flex gap-2">
               <GlassButton 
                 variant="ghost" 
                 size="sm" 
                 onClick={() => loadOKRs()} 
                 className="text-muted-foreground hover:text-primary"
                 disabled={loading}
               >
                 <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
               </GlassButton>
               <ExportMenu isExporting={isExporting} onExport={handleExport} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Building2 size={12} />
                Organization
              </div>
              <GlassSelect className="w-full" value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Layers size={12} />
                Level
              </div>
              <GlassSelect className="w-full" value={level} onChange={(e:any)=>setLevel(e.target.value)}>
                <option value="">All Levels</option>
                <option value="company">Company</option>
                <option value="department">Department</option>
                <option value="member">Member</option>
              </GlassSelect>
            </div>
            
            <div className="lg:col-span-1">
               <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <LayoutGrid size={12} />
                Department
              </div>
              <GlassSelect className="w-full" value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
              </GlassSelect>
            </div>

            <div className="lg:col-span-1">
               <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Users size={12} />
                Member
              </div>
              <GlassSelect className="w-full" value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
                <option value="">All Members</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </div>
            
            <div className="lg:col-span-2">
               <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Calendar size={12} />
                Period Range
              </div>
              <div className="flex gap-2">
                <GlassInput className="w-full" type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} />
                <span className="self-center text-gray-400">-</span>
                <GlassInput className="w-full" type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <AnimatePresence mode="popLayout">
        {loading ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
             {[1,2,3].map(i => (
               <div key={i} className="bg-white/50 p-6 rounded-3xl border border-white/40 shadow-sm animate-pulse h-48"></div>
             ))}
          </motion.div>
        ) : items.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-12 text-center"
          >
             <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <Target size={40} />
             </div>
             <h3 className="text-xl font-bold text-gray-800 mb-2">No OKRs Found</h3>
             <p className="text-gray-500 max-w-md mb-8">
               Try adjusting your filters or selecting a different organization to see performance objectives.
             </p>
             <GlassButton onClick={() => loadOKRs()} variant="secondary">
               <RefreshCw size={16} className="mr-2" /> Refresh Data
             </GlassButton>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {items.map((set, idx) => (
              <motion.div 
                key={set.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <GlassCard className="overflow-hidden">
                   <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-bold text-gray-900">{set.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                            set.level === 'company' ? 'bg-blue-100 text-blue-700' :
                            set.level === 'department' ? 'bg-purple-100 text-purple-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {set.level}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                           <Calendar size={14} />
                           {set.period_start} — {set.period_end}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                         <div className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Total Objectives</div>
                         <div className="text-2xl font-bold text-gray-800">{(set.objectives||[]).length}</div>
                      </div>
                   </div>

                   <div className="grid gap-6">
                      {(set.objectives||[]).map(obj => (
                        <div key={obj.id} className="relative pl-6 border-l-2 border-gray-200 hover:border-primary transition-colors duration-300">
                           <div className="flex justify-between items-start mb-4">
                              <div>
                                 <h4 className="text-lg font-semibold text-gray-800 mb-1">{obj.title}</h4>
                                 {obj.description && <p className="text-sm text-gray-500 max-w-2xl">{obj.description}</p>}
                              </div>
                              <span className="text-xs font-medium bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-100">
                                Weight: {obj.weight}
                              </span>
                           </div>

                           <div className="space-y-3">
                              {(obj.key_results||[]).map(kr => {
                                const pct = progressPercent(kr)
                                return (
                                  <div key={kr.id} className="bg-gray-50/50 rounded-xl p-4 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100">
                                     <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                           <div className={`w-2 h-2 rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                           <span className="font-medium text-sm text-gray-700">{kr.label}</span>
                                        </div>
                                        <div className="text-xs font-semibold text-gray-900 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                                           {pct}%
                                        </div>
                                     </div>
                                     
                                     <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <motion.div 
                                          className={`absolute top-0 left-0 h-full rounded-full ${
                                            pct >= 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                                          }`}
                                          initial={{ width: 0 }}
                                          animate={{ width: `${pct}%` }}
                                          transition={{ duration: 1, ease: "easeOut" }}
                                        />
                                     </div>
                                     
                                     <div className="flex justify-between mt-2 text-xs text-gray-500 font-medium">
                                        <span>0</span>
                                        <span className="text-gray-900">{kr.current_value} / {kr.target_value} {kr.unit}</span>
                                     </div>
                                  </div>
                                )
                              })}
                           </div>
                        </div>
                      ))}
                   </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
