"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

function formatHM(mins: number) { const m = Math.max(0, Math.round(mins||0)); const h=Math.floor(m/60); const mm=String(m%60).padStart(2,'0'); return `${h}:${mm}` }

export default function MyActivityPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [memberId, setMemberId] = useState('')
  const [data, setData] = useState<any>({ trackingOn:false, settings:{ allowActivityTracking:false, allowScreenshots:false, maskPersonalWindows:true }, sessions:[], breaks:[], events:[], topApps:[], screenshots:[] })
  const [shot, setShot] = useState<any | undefined>(undefined)

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'demo-user' } }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadMembers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setMembers(d.items||[]); if(!memberId && d.items?.length) setMemberId(d.items[0].id) }
  const load = async (mid: string, oid: string) => { const res = await fetch(`/api/activity/today?member_id=${mid}&org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); setData(d) }
  const [insights, setInsights] = useState<any[]>([])
  const loadInsights = async (mid: string, oid: string) => { const qs = new URLSearchParams({ org_id: oid, member_id: mid, limit: '5' }); const res = await fetch(`/api/insights/list?${qs.toString()}`, { cache:'no-store', headers:{ 'x-user-id': mid } }); const d = await res.json(); setInsights(d.insights||d.items||[]) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadMembers(orgId) }, [orgId])
  useEffect(()=>{ if(orgId && memberId) { load(memberId, orgId); loadInsights(memberId, orgId) } }, [orgId, memberId])

  const privacyLines = [ `Activity tracking: ${data.settings.allowActivityTracking? 'On':'Off'}`, `Screenshots: ${data.settings.allowScreenshots? 'On':'Off'}` ]

  return (
    <AppShell title="My Activity">
      <div className="grid grid-2">
        <GlassCard title="Privacy & Tracking">
          <div className="grid grid-2" style={{marginBottom:12}}>
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
                <option value="">Select member</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </div>
          </div>
          <div className="subtitle">{privacyLines.join(' • ')}</div>
          <div className="subtitle" style={{marginTop:8}}>Tracking is {data.trackingOn? 'ON':'OFF'}</div>
          <div className="subtitle" style={{marginTop:6}}>MARQ only logs active apps, websites, and work-related screen snapshots. Nothing is recorded outside your working hours.</div>
        </GlassCard>
        <GlassCard title="Top Apps Today">
          <GlassTable columns={[ 'App', 'Active Minutes', 'Category' ]} rows={(data.topApps||[]).map((a:any)=>[ a.app, formatHM(a.minutes), a.category || '-' ])} />
        </GlassCard>
      </div>

      <GlassCard title="Today Timeline">
        <div className="subtitle">Work sessions and breaks</div>
        <div>
          {(data.sessions||[]).map((s:any)=> (
            <div key={s.id} className="row" style={{gap:12}}>
              <span className="tag-pill">Session {new Date(s.startTime).toLocaleTimeString()} - {s.endTime? new Date(s.endTime).toLocaleTimeString() : '...'}</span>
            </div>
          ))}
          {(data.breaks||[]).map((b:any)=> (
            <div key={b.id} className="row" style={{gap:12}}>
              <span className="tag-pill accent">Break {new Date(b.startTime).toLocaleTimeString()} - {b.endTime? new Date(b.endTime).toLocaleTimeString() : '...'}</span>
            </div>
          ))}
        </div>
        <div className="subtitle" style={{marginTop:12}}>Idle segments</div>
        <div>
          {(() => {
            const idle = (data.events||[]).filter((e:any)=>!e.isActive)
            if (!idle.length) return <div className="subtitle">No idle segments</div>
            return idle.slice(0,8).map((e:any)=> <div key={e.id} className="tag-pill">Idle around {new Date(e.timestamp).toLocaleTimeString()}</div>)
          })()}
        </div>
      </GlassCard>

      {data.settings.allowScreenshots && (
        <GlassCard title="Today's Screenshots">
          <div className="grid grid-3">
            {(data.screenshots||[]).map((s:any)=> (
              <div key={s.id} onClick={()=>setShot(s)} style={{cursor:'pointer'}}>
                <img src={s.thumbnailPath} alt="shot" style={{width:'100%', borderRadius:12, filter:'blur(4px)'}} />
                <div className="subtitle">{new Date(s.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard title="Recent Insights">
        <div className="grid grid-1">
          {insights.length === 0 ? <div className="subtitle">No recent insights</div> : insights.map(it => (
            <div key={it.id} className="row" style={{gap:8,alignItems:'center'}}>
              <span className="badge">{it.insight_type}</span>
              <span className="badge">{it.severity}</span>
              <span className="subtitle">{it.summary}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassModal open={!!shot} title="Screenshot" onClose={()=>setShot(undefined)}>
        {shot && (
          <div>
            <img src={shot.storagePath} alt="shot" style={{maxWidth:'100%', borderRadius:12, filter:'blur(6px)'}} />
            <div className="subtitle">{new Date(shot.timestamp).toLocaleString()}</div>
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}
