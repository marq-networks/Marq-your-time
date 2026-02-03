'use client'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassInput from '@components/ui/GlassInput'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { Plus, Search, Filter, BarChart2, MessageSquare, Calendar, Users, PieChart, Trash2, X } from 'lucide-react'

type Org = { id: string, orgName: string }
type SurveyItem = { id: string, title: string, created_at: number, closes_at?: number|null, is_anonymous: boolean, avg_scale: number, response_rate: number|null }
type QuestionInput = { question_type: 'scale'|'text'|'mcq', question_text: string, options?: string[] }

export default function SurveysAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<SurveyItem[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [groupBy, setGroupBy] = useState<'none'|'department'|'role'>('none')
  const [newSurvey, setNewSurvey] = useState<{ title: string, description: string, is_anonymous: boolean, closes_at?: string, questions: QuestionInput[] }>({ title:'', description:'', is_anonymous: true, closes_at: undefined, questions: [] })
  const [results, setResults] = useState<any|null>(null)
  const [viewSurveyId, setViewSurveyId] = useState<string|undefined>(undefined)
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadList(orgId) } }, [orgId])
  useEffect(()=>{ if(viewSurveyId){ loadResults(viewSurveyId, groupBy) } }, [viewSurveyId, groupBy])

  const loadOrgs = async () => {
    const r = await fetch('/api/org/list', { cache:'no-store' })
    const d = await r.json()
    setOrgs(d.items||[])
    if (!orgId && d.items?.length) setOrgId(d.items[0].id)
  }
  const loadList = async (oid: string) => {
    const r = await fetch(`/api/surveys/list?org_id=${oid}`, { cache:'no-store' })
    const d = await r.json()
    setItems(d.items||[])
  }
  const loadResults = async (sid: string, gb: 'none'|'department'|'role') => {
    const q = gb !== 'none' ? `&group_by=${gb}` : ''
    const r = await fetch(`/api/surveys/results?survey_id=${sid}${q}`, { cache:'no-store', headers:{ 'x-role': role || 'admin' } })
    const d = await r.json()
    setResults(d)
  }

  const addQuestion = () => setNewSurvey({ ...newSurvey, questions: [...newSurvey.questions, { question_type: 'scale', question_text: '', options: [] }] })
  const updateQuestion = (idx: number, patch: Partial<QuestionInput>) => {
    const arr = newSurvey.questions.slice()
    arr[idx] = { ...arr[idx], ...patch }
    setNewSurvey({ ...newSurvey, questions: arr })
  }
  const removeQuestion = (idx: number) => {
    const arr = newSurvey.questions.slice()
    arr.splice(idx, 1)
    setNewSurvey({ ...newSurvey, questions: arr })
  }
  const createSurvey = async () => {
    if (!orgId || !newSurvey.title || newSurvey.questions.length === 0) return
    const body = { org_id: orgId, title: newSurvey.title, description: newSurvey.description, is_anonymous: newSurvey.is_anonymous, closes_at: newSurvey.closes_at, questions: newSurvey.questions }
    const r = await fetch('/api/surveys/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin', 'x-user-id': 'admin' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (d.survey) { setCreateOpen(false); setNewSurvey({ title:'', description:'', is_anonymous: true, closes_at: undefined, questions: [] }); loadList(orgId) }
  }

  const columns = ['Title','Created','Closes','Anonymous','Avg Scale','Response Rate','Actions']
  const filteredItems = items.filter(it => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const text = `${it.title||''}`.toLowerCase()
    return text.includes(q)
  })
  const rows = filteredItems.map(it => [
    it.title,
    new Date(it.created_at).toLocaleDateString(),
    it.closes_at ? new Date(it.closes_at).toLocaleDateString() : '-',
    it.is_anonymous ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        No
      </span>
    ),
    (Math.round(it.avg_scale*100)/100).toFixed(2),
    it.response_rate===null ? '-' : (
      <span className="font-medium text-slate-700">
        {Math.round((it.response_rate||0)*100)}%
      </span>
    ),
    <div className="flex items-center gap-2">
      <GlassButton onClick={()=>{ setViewSurveyId(it.id); }} size="sm" variant="secondary" className="flex items-center gap-1.5">
        <BarChart2 size={14} />
        <span>Results</span>
      </GlassButton>
    </div>
  ])

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (filteredItems.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'Title', accessor: 'title' },
        { header: 'Created', accessor: (item) => new Date(item.created_at).toLocaleDateString() },
        { header: 'Closes', accessor: (item) => item.closes_at ? new Date(item.closes_at).toLocaleDateString() : '-' },
        { header: 'Anonymous', accessor: (item) => item.is_anonymous ? 'Yes' : 'No' },
        { header: 'Avg Scale', accessor: (item) => (Math.round(item.avg_scale*100)/100).toFixed(2) },
        { header: 'Response Rate', accessor: (item) => item.response_rate===null ? '-' : `${Math.round((item.response_rate||0)*100)}%` }
      ]
      const filename = `marq_surveys_${orgId}_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') {
        await exportToCsv(filteredItems, exportColumns, filename)
      } else {
        await exportToPdf(filteredItems, exportColumns, 'Surveys', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell title="Engagement Surveys">
      <GlassCard 
        title={
          <div className="flex items-center gap-2">
            <MessageSquare className="text-indigo-600" size={20} />
            <span>Surveys</span>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <ExportMenu onExport={handleExport} isExporting={isExporting} />
            <GlassButton variant="primary" onClick={()=>setCreateOpen(true)} className="flex items-center gap-2 px-4">
              <Plus size={16} />
              <span>Create Survey</span>
            </GlassButton>
          </div>
        }
      >
        <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <Users size={12} />
              Organization
            </div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)} className="w-full bg-white">
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <Search size={12} />
              Search
            </div>
            <div className="relative">
              <input 
                className="input w-full bg-white pl-9" 
                placeholder="Search by title..." 
                value={search} 
                onChange={e=>setSearch(e.target.value)} 
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>
          </div>

          {viewSurveyId && (
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Filter size={12} />
                Group Results
              </div>
              <GlassSelect value={groupBy} onChange={(e:any)=>setGroupBy(e.target.value)} className="w-full bg-white">
                <option value="none">No Grouping</option>
                <option value="department">By Department</option>
                <option value="role">By Role</option>
              </GlassSelect>
            </div>
          )}
        </div>

        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={createOpen} title="Create Survey" onClose={()=>setCreateOpen(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="col-span-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Title</div>
            <input className="input w-full" value={newSurvey.title} onChange={e=>setNewSurvey({ ...newSurvey, title: e.target.value })} placeholder="Survey Title" />
          </div>
          <div className="col-span-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Anonymous</div>
            <GlassSelect value={newSurvey.is_anonymous? 'true':'false'} onChange={(e:any)=>setNewSurvey({ ...newSurvey, is_anonymous: e.target.value==='true' })} className="w-full">
              <option value="true">Yes (Anonymous)</option>
              <option value="false">No (Public)</option>
            </GlassSelect>
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Description</div>
            <textarea className="input w-full min-h-[80px]" value={newSurvey.description} onChange={e=>setNewSurvey({ ...newSurvey, description: e.target.value })} placeholder="Describe the purpose of this survey..." />
          </div>
          <div className="col-span-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <Calendar size={12} />
              Closes At (Optional)
            </div>
            <input className="input w-full" type="datetime-local" value={newSurvey.closes_at||''} onChange={e=>setNewSurvey({ ...newSurvey, closes_at: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 pt-4 border-t border-slate-100">
          <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-500" />
            Questions ({newSurvey.questions.length})
          </div>
          <GlassButton onClick={addQuestion} size="sm" variant="secondary" className="flex items-center gap-1.5">
            <Plus size={14} />
            Add Question
          </GlassButton>
        </div>

        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
          {newSurvey.questions.map((q, i)=> (
            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative group transition-all hover:border-indigo-100 hover:shadow-sm">
              <button 
                onClick={()=>removeQuestion(i)}
                className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove Question"
              >
                <Trash2 size={14} />
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pr-8">
                <div className="md:col-span-3">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Type</div>
                  <GlassSelect value={q.question_type} onChange={(e:any)=>updateQuestion(i, { question_type: e.target.value })} className="w-full text-sm">
                    <option value="scale">Scale (1-5)</option>
                    <option value="text">Text Response</option>
                    <option value="mcq">Multiple Choice</option>
                  </GlassSelect>
                </div>
                <div className="md:col-span-9">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Question Text</div>
                  <input className="input w-full text-sm" value={q.question_text} onChange={e=>updateQuestion(i, { question_text: e.target.value })} placeholder="Enter your question here..." />
                </div>
                {(q.question_type === 'mcq') && (
                  <div className="md:col-span-12">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Options (comma separated)</div>
                    <input className="input w-full text-sm" value={(q.options||[]).join(', ')} onChange={e=>updateQuestion(i, { options: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} placeholder="Option 1, Option 2, Option 3..." />
                  </div>
                )}
              </div>
            </div>
          ))}
          {newSurvey.questions.length === 0 && (
            <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <p className="text-sm">No questions added yet.</p>
              <p className="text-xs mt-1">Click "Add Question" to start building your survey.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <GlassButton variant="secondary" onClick={()=>setCreateOpen(false)}>Cancel</GlassButton>
          <GlassButton variant="primary" onClick={createSurvey} disabled={!newSurvey.title || newSurvey.questions.length === 0}>
            Create Survey
          </GlassButton>
        </div>
      </GlassModal>

      <GlassModal open={!!viewSurveyId} title="Survey Results" onClose={()=>{ setViewSurveyId(undefined); setResults(null) }}>
        {results ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Summary stats could go here if available in the future */}
            </div>

            <div className="space-y-4">
              {(results.questions||[]).map((q:any, idx:number)=> (
                <div key={idx} className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-slate-800 text-sm">Q{idx+1}. {q.questionText || `Question ${idx+1}`}</h4>
                      <span className="text-xs text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {q.questionType === 'scale' ? 'Scale (1-5)' : q.questionType}
                      </span>
                    </div>
                    {q.questionType==='scale' && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-600">{(Math.round((q.avg||0)*100)/100).toFixed(1)}</div>
                        <div className="text-xs text-slate-500">Average</div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pl-1 border-l-2 border-slate-100">
                    {q.questionType==='mcq' && (
                      <div className="space-y-2">
                        {Object.entries(q.distribution||{}).map(([opt,val])=> (
                          <div key={opt} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{opt}</span>
                            <div className="flex items-center gap-2">
                              <div className="h-2 bg-slate-100 rounded-full w-24 overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{width: `${Math.min(100, ((val as number)/(q.count||1))*100)}%`}}></div>
                              </div>
                              <span className="font-medium text-slate-700 w-8 text-right">{val as number}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.questionType==='text' && (
                      <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {(q.texts||[]).length > 0 ? (
                          (q.texts||[]).map((t:string, i:number)=> (
                            <div key={i} className="text-xs p-2 bg-slate-50 rounded text-slate-600 italic">"{t}"</div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">No responses yet</div>
                        )}
                      </div>
                    )}
                    {q.questionType==='scale' && (
                       <div className="text-xs text-slate-500 mt-2">
                         Total Responses: <span className="font-medium text-slate-700">{q.count||0}</span>
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(results.groups||[]).length>0 && (
              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PieChart size={16} className="text-indigo-500" />
                  Group Breakdown
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {(results.groups||[]).map((g:any, gi:number)=> (
                    <div key={gi} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-medium text-slate-700 mb-3 pb-2 border-b border-slate-200/50 flex items-center gap-2">
                        <Users size={14} className="text-slate-400" />
                        {g.group_id}
                      </div>
                      <div className="space-y-2">
                        {(g.question_stats||[]).map((q:any, idx:number)=> (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                            <span className="text-slate-600 font-medium">Q{idx+1}</span>
                            <div className="text-slate-500">
                              {q.questionType==='scale' && <span>Avg <strong className="text-indigo-600">{(Math.round((q.avg||0)*100)/100).toFixed(1)}</strong> • {q.count||0} resp</span>}
                              {q.questionType==='mcq' && <span>{Object.entries(q.distribution||{}).map(([k,v])=> `${k}:${v}`).join(' • ')}</span>}
                              {q.questionType==='text' && <span>{(q.texts||[]).length} responses</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <BarChart2 size={48} className="mb-4 text-slate-200" />
            <p>Select a survey to view results</p>
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}
