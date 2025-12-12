'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'

type ApiClient = { id: string, name: string, scopes: string[], is_active: boolean, created_at: string, last_used_at?: string|null }
type Webhook = { id: string, name: string, target_url: string, events: string[], is_active: boolean, created_at: string, last_triggered_at?: string|null }
type EventRow = { id: string, event_type: string, status: string, attempt_count: number, last_attempt_at?: string|null, error_message?: string|null, created_at: string }

export default function IntegrationsApiPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [clients, setClients] = useState<ApiClient[]>([])
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [createHookOpen, setCreateHookOpen] = useState(false)
  const [rawKey, setRawKey] = useState('')
  const [newKey, setNewKey] = useState({ name: '', scopes: [] as string[] })
  const [newHook, setNewHook] = useState({ name: '', target_url: '', events: [] as string[] })
  const [viewHook, setViewHook] = useState<Webhook | null>(null)
  const [history, setHistory] = useState<EventRow[]>([])
  const role = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadClients = async (oid: string) => { if(!oid) return; const r = await fetch(`/api/integrations/api-clients?org_id=${oid}`, { cache:'no-store', headers:{ 'x-role': role || 'admin' } }); const d = await r.json(); setClients(d.items||[]) }
  const loadHooks = async (oid: string) => { if(!oid) return; const r = await fetch(`/api/integrations/webhooks?org_id=${oid}`, { cache:'no-store', headers:{ 'x-role': role || 'admin' } }); const d = await r.json(); setHooks(d.items||[]) }
  const loadHistory = async (hookId: string) => { const r = await fetch(`/api/integrations/webhook-events?webhook_id=${hookId}&limit=50`, { cache:'no-store', headers:{ 'x-role': role || 'admin' } }); const d = await r.json(); setHistory(d.items||[]) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId){ loadClients(orgId); loadHooks(orgId) } }, [orgId])

  const createKey = async () => {
    const r = await fetch('/api/integrations/api-clients', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ action:'create', org_id: orgId, name: newKey.name, scopes: newKey.scopes }) })
    const d = await r.json(); if(d.item){ setRawKey(d.raw_key||''); setCreateKeyOpen(false); setNewKey({ name:'', scopes:[] }); await loadClients(orgId) }
  }
  const toggleClient = async (id: string, active: boolean) => { await fetch('/api/integrations/api-clients', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ action:'toggle', id, is_active: active }) }); await loadClients(orgId) }
  const createHook = async () => {
    const r = await fetch('/api/integrations/webhooks', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ action:'create', org_id: orgId, name: newHook.name, target_url: newHook.target_url, events: newHook.events }) })
    const d = await r.json(); if(d.item){ setCreateHookOpen(false); setNewHook({ name:'', target_url:'', events:[] }); await loadHooks(orgId); alert(`Secret: ${d.secret}`) }
  }
  const toggleHook = async (id: string, active: boolean) => { await fetch('/api/integrations/webhooks', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ action:'toggle', id, is_active: active }) }); await loadHooks(orgId) }

  const apiColumns = ['Name','Scopes','Created','Last Used','Status','Actions']
  const apiRows = clients.map(c => [ c.name, c.scopes.join(', '), new Date(c.created_at).toLocaleString(), c.last_used_at ? new Date(c.last_used_at).toLocaleString() : '-', c.is_active ? <span className="badge">Active</span> : <span className="badge">Inactive</span>, <div style={{display:'flex',gap:8}}><GlassButton variant='secondary' onClick={()=>toggleClient(c.id, !c.is_active)}>{c.is_active?'Deactivate':'Activate'}</GlassButton></div> ])

  const hookColumns = ['Name','Target URL','Events','Status','Last Triggered','Actions']
  const hookRows = hooks.map(h => [ h.name, h.target_url, h.events.join(', '), h.is_active ? <span className="badge">Active</span> : <span className="badge">Inactive</span>, h.last_triggered_at ? new Date(h.last_triggered_at).toLocaleString() : '-', <div style={{display:'flex',gap:8}}><GlassButton variant='secondary' onClick={()=>toggleHook(h.id, !h.is_active)}>{h.is_active?'Deactivate':'Activate'}</GlassButton><GlassButton variant='secondary' onClick={()=>{ setViewHook(h); loadHistory(h.id) }}>View Events</GlassButton></div> ])

  const eventColumns = ['Event','Status','Attempts','Last Attempt','Error']
  const eventRows = history.map(e => [ e.event_type, e.status, String(e.attempt_count), e.last_attempt_at ? new Date(e.last_attempt_at).toLocaleString() : '-', e.error_message || '-' ])

  const allScopes = ['read:org','read:members','read:time','read:payroll','read:billing','read:leave','webhooks:*']
  const allEvents = ['member.check_in','member.check_out','time.daily_closed','payroll.period_approved','leave.request_created','leave.request_approved','leave.request_rejected']

  return (
    <AppShell title="Integrations & API">
      <div style={{background:'linear-gradient(to bottom right, #d9c7b2, #e8ddce, #c9b8a4)',borderRadius:'var(--radius-large)',padding:16}}>
        <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:12}}>
          <select className="input" value={orgId} onChange={e=>setOrgId(e.target.value)}>
            {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
          </select>
          <GlassButton onClick={()=>setCreateKeyOpen(true)}>Create API Key</GlassButton>
          <GlassButton onClick={()=>setCreateHookOpen(true)}>Add Webhook</GlassButton>
        </div>
        <GlassCard title="API Keys">
          <GlassTable columns={apiColumns} rows={apiRows} />
        </GlassCard>
        <div style={{height:12}} />
        <GlassCard title="Webhooks">
          <GlassTable columns={hookColumns} rows={hookRows} />
        </GlassCard>
      </div>

      <GlassModal open={createKeyOpen} title="Create API Key" onClose={()=>setCreateKeyOpen(false)}>
        <div style={{display:'grid',gap:8}}>
          <input className="input" placeholder="Name" value={newKey.name} onChange={e=>setNewKey(v=>({...v,name:e.target.value}))} />
          <div style={{display:'grid',gap:6}}>
            {allScopes.map(s => (
              <label key={s} style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="checkbox" checked={newKey.scopes.includes(s)} onChange={e=>{ const on=e.target.checked; setNewKey(v=> ({...v, scopes: on ? [...v.scopes, s] : v.scopes.filter(x=>x!==s) })) }} />
                <span>{s}</span>
              </label>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <GlassButton variant='secondary' onClick={()=>setCreateKeyOpen(false)}>Cancel</GlassButton>
            <GlassButton onClick={createKey}>Save</GlassButton>
          </div>
        </div>
      </GlassModal>

      <GlassModal open={createHookOpen} title="Add Webhook" onClose={()=>setCreateHookOpen(false)}>
        <div style={{display:'grid',gap:8}}>
          <input className="input" placeholder="Name" value={newHook.name} onChange={e=>setNewHook(v=>({...v,name:e.target.value}))} />
          <input className="input" placeholder="Target URL" value={newHook.target_url} onChange={e=>setNewHook(v=>({...v,target_url:e.target.value}))} />
          <div style={{display:'grid',gap:6}}>
            {allEvents.map(ev => (
              <label key={ev} style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="checkbox" checked={newHook.events.includes(ev)} onChange={e=>{ const on=e.target.checked; setNewHook(v=> ({...v, events: on ? [...v.events, ev] : v.events.filter(x=>x!==ev) })) }} />
                <span>{ev}</span>
              </label>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <GlassButton variant='secondary' onClick={()=>setCreateHookOpen(false)}>Cancel</GlassButton>
            <GlassButton onClick={createHook}>Save</GlassButton>
          </div>
        </div>
      </GlassModal>

      <GlassModal open={!!viewHook} title={viewHook ? `Webhook Events — ${viewHook.name}` : ''} onClose={()=>{ setViewHook(null); setHistory([]) }}>
        <GlassTable columns={eventColumns} rows={eventRows} />
      </GlassModal>

      <GlassModal open={!!rawKey} title="API Key (copy now)" onClose={()=>setRawKey('')}>
        <div className="glass-panel" style={{padding:12,borderRadius:'var(--radius-medium)'}}>
          <div style={{wordBreak:'break-all'}}>{rawKey}</div>
        </div>
      </GlassModal>
    </AppShell>
  )
}
