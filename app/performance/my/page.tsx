"use client"
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import GlassModal from '@components/ui/GlassModal'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { Target, ClipboardCheck, Calendar, TrendingUp, CheckCircle2, User as UserIcon, Building2, Plus, Edit2 } from 'lucide-react'

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
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(false)

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

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadMembers(orgId) } }, [orgId])
  useEffect(()=>{ 
    if(orgId && memberId){ 
      setLoading(true)
      Promise.all([loadOKRs(), loadCheckins()]).finally(() => setLoading(false))
    } 
  }, [orgId, memberId])

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = checkins
      const exportColumns: ExportColumn[] = [
        { header: 'Period', accessor: (i) => `${i.period_start} - ${i.period_end}` },
        { header: 'Summary', accessor: 'summary' },
        { header: 'Self Score', accessor: (i) => i.self_score ?? '-' },
        { header: 'Manager Score', accessor: (i) => i.manager_score ?? '-' },
        { header: 'Date', accessor: (i) => new Date(i.created_at).toLocaleDateString() }
      ]
      
      const filename = `marq_my_performance_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'My Performance Check-ins', filename)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell title="My Performance">
      <div className="mb-6">
        <GlassCard>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 size={18} />
              <span className="font-medium text-sm">Organization</span>
            </div>
            <div className="w-64">
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select Organization</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>

            <div className="w-px h-8 bg-gray-200 mx-2 hidden md:block"></div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon size={18} />
              <span className="font-medium text-sm">Member</span>
            </div>
            <div className="w-64">
              <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
                <option value="">Select Member</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: OKRs */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Target className="text-primary" size={24} />
            <h2 className="text-xl font-semibold">Objectives & Key Results</h2>
          </div>
          
          <AnimatePresence mode="popLayout">
            {loading ? (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
                {[1,2].map(i => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                    <div className="h-6 w-1/3 bg-gray-100 rounded mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-20 bg-gray-50 rounded-xl"></div>
                      <div className="h-20 bg-gray-50 rounded-xl"></div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : okrs.length === 0 ? (
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="p-12 border border-dashed border-emerald-100 bg-emerald-50/30 rounded-3xl flex flex-col items-center justify-center text-center group"
               >
                 <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <Target size={32} />
                 </div>
                 <h3 className="text-lg font-semibold text-emerald-900 mb-1">No Objectives Found</h3>
                 <p className="text-emerald-800/60 max-w-xs">There are no active objectives assigned to you for this period.</p>
               </motion.div>
            ) : (
              okrs.map((set, setIndex) => (
                <motion.div 
                  key={set.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: setIndex * 0.1 }}
                  className="space-y-4"
                >
               <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{set.title}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {set.period_start} – {set.period_end}
                  </span>
               </div>
              
              {(set.objectives||[]).map(obj => (
                <GlassCard key={obj.id} className="relative overflow-hidden group transition-all hover:shadow-md">
                  <div className="mb-4">
                    <h4 className="font-medium text-lg leading-tight mb-1">{obj.title}</h4>
                    {obj.description && <p className="text-sm text-muted-foreground">{obj.description}</p>}
                  </div>
                  
                  <div className="space-y-4">
                    {(obj.key_results||[]).map(kr => {
                      const percentage = pct(kr)
                      return (
                        <div key={kr.id} className="bg-white/40 p-3 rounded-lg border border-white/20">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-800">{kr.label}</span>
                            <button 
                              onClick={()=>{ setTargetKr(kr); setNewValue(String(kr.current_value||'')); setUpdateOpen(true) }}
                              className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                            >
                              <Edit2 size={12} /> Update
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1.5">
                            <span>Current: <strong className="text-foreground">{kr.current_value}</strong></span>
                            <span>Target: <strong>{kr.target_value}</strong> {kr.unit}</span>
                            <span className="ml-auto font-bold text-primary">{percentage}%</span>
                          </div>
                          
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </GlassCard>
              ))}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Check-ins */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="text-purple-500" size={24} />
              <h2 className="text-xl font-semibold">Self Check-ins</h2>
            </div>
            <div className="flex gap-2">
               <ExportMenu onExport={handleExport} isExporting={isExporting} />
               <GlassButton onClick={()=>setCheckOpen(true)} className="flex items-center gap-2">
                 <Plus size={16} /> New Check-in
               </GlassButton>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse h-32"></div>
                  ))}
                </motion.div>
              ) : checkins.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-12 border border-dashed border-purple-100 bg-purple-50/30 rounded-3xl flex flex-col items-center justify-center text-center group"
                >
                  <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <ClipboardCheck size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-purple-900 mb-1">No Check-ins Yet</h3>
                  <p className="text-purple-800/60 max-w-xs mb-6">Keep track of your progress by adding regular check-ins.</p>
                  <GlassButton className="shadow-lg shadow-purple-200/50" href={`/performance/checkin/new?orgId=${orgId}&memberId=${memberId}`}>
                    <Plus size={16} /> Create your first check-in
                  </GlassButton>
                </motion.div>
              ) : (
                checkins.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <GlassCard className="transition-all duration-200">
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-100/80 px-2 py-1 rounded">
                            <Calendar size={12} />
                            {c.period_start} – {c.period_end}
                          </div>
                          <div className="flex gap-2">
                             {c.self_score !== null && (
                               <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
                                 User: {c.self_score}
                               </span>
                             )}
                             {c.manager_score !== null && (
                               <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                 Mgr: {c.manager_score}
                               </span>
                             )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">Summary</h4>
                          <p className="text-sm text-gray-600 leading-relaxed">{c.summary}</p>
                        </div>
                        
                        <div className="text-[10px] text-gray-400 text-right mt-1">
                          Submitted on {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <GlassModal open={updateOpen} title="Update Key Result" onClose={()=>setUpdateOpen(false)}>
        {targetKr && (
          <div className="space-y-4 p-1">
            <div>
              <div className="label mb-1">New Value ({targetKr.unit || 'units'})</div>
              <GlassInput 
                className="w-full" 
                type="number" 
                value={newValue} 
                onChange={e=>setNewValue(e.target.value)} 
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <GlassButton variant="secondary" onClick={()=>setUpdateOpen(false)}>Cancel</GlassButton>
              <GlassButton variant="primary" onClick={submitUpdate}>Save Update</GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}