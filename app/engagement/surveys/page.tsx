'use client'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'

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
    const r = await fetch(`/api/surveys/results?survey_id=${sid}${q}`, { cache:'no-store', headers:{ 'x-role': 'admin' } })
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
    const r = await fetch('/api/surveys/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': 'admin', 'x-user-id': 'admin' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (d.survey) { setCreateOpen(false); setNewSurvey({ title:'', description:'', is_anonymous: true, closes_at: undefined, questions: [] }); loadList(orgId) }
  }

  const columns = ['Title','Created','Closes','Anonymous','Avg Scale','Response Rate','Actions']
  const rows = items.map(it => [ it.title, new Date(it.created_at).toLocaleDateString(), it.closes_at ? new Date(it.closes_at).toLocaleDateString() : '-', it.is_anonymous ? 'Yes' : 'No', (Math.round(it.avg_scale*100)/100).toFixed(2), it.response_rate===null?'-':`${Math.round((it.response_rate||0)*100)}%`, <div className="row" style={{gap:8}}><GlassButton onClick={()=>{ setViewSurveyId(it.id); }}>View Results</GlassButton></div> ])

  return (
    <AppShell title="Engagement Surveys">
      <GlassCard title="Surveys" right={<div className="row" style={{gap:8}}><GlassButton variant="primary" onClick={()=>setCreateOpen(true)}>Create Survey</GlassButton></div>}>
        <div className="row" style={{gap:12,marginBottom:12}}>
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          {viewSurveyId && (
            <div>
              <div className="label">Group by</div>
              <GlassSelect value={groupBy} onChange={(e:any)=>setGroupBy(e.target.value)}>
                <option value="none">None</option>
                <option value="department">Department</option>
                <option value="role">Role</option>
              </GlassSelect>
            </div>
          )}
        </div>
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={createOpen} title="Create Survey" onClose={()=>setCreateOpen(false)}>
        <div className="grid grid-2">
          <div>
            <div className="label">Title</div>
            <input className="input" value={newSurvey.title} onChange={e=>setNewSurvey({ ...newSurvey, title: e.target.value })} />
          </div>
          <div>
            <div className="label">Anonymous</div>
            <GlassSelect value={newSurvey.is_anonymous? 'true':'false'} onChange={(e:any)=>setNewSurvey({ ...newSurvey, is_anonymous: e.target.value==='true' })}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </GlassSelect>
          </div>
          <div className="grid-col-span-2">
            <div className="label">Description</div>
            <textarea className="input" value={newSurvey.description} onChange={e=>setNewSurvey({ ...newSurvey, description: e.target.value })} />
          </div>
          <div>
            <div className="label">Closes at</div>
            <input className="input" type="datetime-local" value={newSurvey.closes_at||''} onChange={e=>setNewSurvey({ ...newSurvey, closes_at: e.target.value })} />
          </div>
        </div>
        <div className="row" style={{marginTop:12,marginBottom:12,justifyContent:'space-between'}}>
          <div className="title">Questions</div>
          <GlassButton onClick={addQuestion}>Add Question</GlassButton>
        </div>
        {newSurvey.questions.map((q, i)=> (
          <div key={i} className="glass-panel" style={{padding:12,borderRadius:16,marginBottom:8}}>
            <div className="row" style={{gap:12}}>
              <div style={{flex:1}}>
                <div className="label">Type</div>
                <GlassSelect value={q.question_type} onChange={(e:any)=>updateQuestion(i, { question_type: e.target.value })}>
                  <option value="scale">Scale (1-5)</option>
                  <option value="text">Text</option>
                  <option value="mcq">Multiple Choice</option>
                </GlassSelect>
              </div>
              <div style={{flex:3}}>
                <div className="label">Question</div>
                <input className="input" value={q.question_text} onChange={e=>updateQuestion(i, { question_text: e.target.value })} />
              </div>
              <div style={{flex:2}}>
                <div className="label">Options (comma)</div>
                <input className="input" value={(q.options||[]).join(',')} onChange={e=>updateQuestion(i, { options: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
              </div>
              <GlassButton variant="secondary" onClick={()=>removeQuestion(i)}>Remove</GlassButton>
            </div>
          </div>
        ))}
        <div className="row" style={{marginTop:12,justifyContent:'flex-end',gap:8}}>
          <GlassButton variant="secondary" onClick={()=>setCreateOpen(false)}>Cancel</GlassButton>
          <GlassButton variant="primary" onClick={createSurvey}>Create</GlassButton>
        </div>
      </GlassModal>

      <GlassModal open={!!viewSurveyId} title="Survey Results" onClose={()=>{ setViewSurveyId(undefined); setResults(null) }}>
        {results ? (
          <div>
            {(results.questions||[]).map((q:any, idx:number)=> (
              <div key={idx} className="glass-panel" style={{padding:12,borderRadius:16,marginBottom:8}}>
                <div className="title">Question {idx+1}</div>
                <div className="subtitle">Type {q.questionType}</div>
                {q.questionType==='scale' && <div className="subtitle">Avg {(Math.round((q.avg||0)*100)/100).toFixed(2)} • Count {q.count||0}</div>}
                {q.questionType==='mcq' && (
                  <div>
                    {Object.entries(q.distribution||{}).map(([opt,val])=> (
                      <div key={opt} className="row" style={{justifyContent:'space-between'}}>
                        <div className="subtitle">{opt}</div>
                        <div className="subtitle">{val as number}</div>
                      </div>
                    ))}
                  </div>
                )}
                {q.questionType==='text' && (
                  <div>
                    {(q.texts||[]).map((t:string, i:number)=> <div key={i} className="subtitle">{t}</div>)}
                  </div>
                )}
              </div>
            ))}
            {(results.groups||[]).length>0 && (
              <div>
                <div className="title" style={{marginTop:12}}>Groups</div>
                {(results.groups||[]).map((g:any, gi:number)=> (
                  <div key={gi} className="glass-panel" style={{padding:12,borderRadius:16,marginBottom:8}}>
                    <div className="subtitle">{g.group_id}</div>
                    {(g.question_stats||[]).map((q:any, idx:number)=> (
                      <div key={idx} className="row" style={{justifyContent:'space-between'}}>
                        <div className="subtitle">Q{idx+1}</div>
                        {q.questionType==='scale' && <div className="subtitle">Avg {(Math.round((q.avg||0)*100)/100).toFixed(2)} • {q.count||0}</div>}
                        {q.questionType==='mcq' && <div className="subtitle">{Object.entries(q.distribution||{}).map(([k,v])=> `${k}:${v}`).join(' • ')}</div>}
                        {q.questionType==='text' && <div className="subtitle">{(q.texts||[]).length} responses</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="subtitle">Select a survey to view results</div>
        )}
      </GlassModal>
    </AppShell>
  )
}
