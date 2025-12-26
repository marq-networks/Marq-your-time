'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'

type Org = { id: string, orgName: string }
type Member = { id: string, firstName: string, lastName: string }
type SurveyItem = { id: string, title: string, created_at: number, closes_at?: number|null, is_anonymous: boolean }

export default function MyEngagementPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [surveys, setSurveys] = useState<SurveyItem[]>([])
  const [fillOpen, setFillOpen] = useState(false)
  const [activeSurveyId, setActiveSurveyId] = useState<string|undefined>(undefined)
  const [detail, setDetail] = useState<any|null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadMembers(orgId); loadSurveys(orgId) } }, [orgId])
  useEffect(()=>{ if(activeSurveyId){ loadDetail(activeSurveyId) } }, [activeSurveyId])

  const loadOrgs = async () => { const res = await fetch('/api/orgs/my', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if (!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]); if (!memberId && d.items?.length) setMemberId(d.items[0].id) }
  const loadSurveys = async (oid: string) => { const r = await fetch(`/api/surveys/list?org_id=${oid}`, { cache:'no-store' }); const d = await r.json(); const now = Date.now(); setSurveys((d.items||[]).filter((s:any)=> !s.closes_at || s.closes_at > now)) }
  const loadDetail = async (sid: string) => { const r = await fetch(`/api/surveys/detail?survey_id=${sid}`, { cache:'no-store' }); const d = await r.json(); setDetail(d); setAnswers({}) }

  const openFill = (sid: string) => { setActiveSurveyId(sid); setFillOpen(true) }
  const submit = async () => {
    if (!orgId || !memberId || !activeSurveyId) return
    const payload = { survey_id: activeSurveyId, org_id: orgId, answers: Object.entries(answers).map(([qid,val])=> ({ question_id: qid, answer_text: typeof val==='string'? val : undefined, answer_numeric: typeof val==='number'? val : undefined })) }
    const r = await fetch('/api/surveys/respond', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': 'member', 'x-user-id': memberId }, body: JSON.stringify(payload) })
    const d = await r.json(); if (d.ok) { setFillOpen(false); setActiveSurveyId(undefined); setDetail(null) }
  }

  const columns = ['Title','Closes','Actions']
  const rows = surveys.map(s => [ s.title, s.closes_at ? new Date(s.closes_at).toLocaleDateString() : '-', <GlassButton onClick={()=>openFill(s.id)}>Fill</GlassButton> ])

  return (
    <AppShell title="My Engagement">
      <GlassCard title="Open Surveys">
        <div className="row" style={{gap:12,marginBottom:12}}>
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
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={fillOpen} title="Fill Survey" onClose={()=>{ setFillOpen(false); setActiveSurveyId(undefined); setDetail(null) }}>
        {detail ? (
          <div>
            <div className="title" style={{marginBottom:8}}>{detail.survey?.title}</div>
            {(detail.questions||[]).map((q:any)=> (
              <div key={q.id} className="glass-panel" style={{padding:12,borderRadius:16,marginBottom:8}}>
                <div className="subtitle">{q.questionText}</div>
                {q.questionType==='scale' && (
                  <div className="row" style={{gap:8}}>
                    {[1,2,3,4,5].map(n=> (
                      <label key={n} className="row" style={{gap:6}}>
                        <input type="radio" name={`q_${q.id}`} checked={answers[q.id]===n} onChange={()=>setAnswers({ ...answers, [q.id]: n })} />
                        <span className="label">{n}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.questionType==='text' && (
                  <textarea className="input" value={answers[q.id]||''} onChange={e=>setAnswers({ ...answers, [q.id]: e.target.value })} />
                )}
                {q.questionType==='mcq' && (
                  <div className="row" style={{gap:8,flexWrap:'wrap'}}>
                    {(q.options||[]).map((opt:string)=> (
                      <label key={opt} className="row" style={{gap:6}}>
                        <input type="radio" name={`q_${q.id}`} checked={answers[q.id]===opt} onChange={()=>setAnswers({ ...answers, [q.id]: opt })} />
                        <span className="label">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="row" style={{justifyContent:'flex-end',gap:8}}>
              <GlassButton variant="secondary" onClick={()=>{ setFillOpen(false); setActiveSurveyId(undefined); setDetail(null) }}>Cancel</GlassButton>
              <GlassButton variant="primary" onClick={submit}>Submit</GlassButton>
            </div>
          </div>
        ) : (
          <div className="subtitle">Loading...</div>
        )}
      </GlassModal>
    </AppShell>
  )
}

