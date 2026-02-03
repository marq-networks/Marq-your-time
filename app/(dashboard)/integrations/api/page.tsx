'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { 
  Key, Webhook, Terminal, Plus, Eye, EyeOff, Activity, 
  Shield, Building2, Copy, Check, AlertTriangle, Code,
  Server, RefreshCw, Trash2
} from 'lucide-react'

type ApiClient = { id: string, name: string, scopes: string[], is_active: boolean, created_at: string, last_used_at?: string|null }
type WebhookType = { id: string, name: string, target_url: string, events: string[], is_active: boolean, created_at: string, last_triggered_at?: string|null }
type EventRow = { id: string, event_type: string, status: string, attempt_count: number, last_attempt_at?: string|null, error_message?: string|null, created_at: string }

export default function IntegrationsApiPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [clients, setClients] = useState<ApiClient[]>([])
  const [hooks, setHooks] = useState<WebhookType[]>([])
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [createHookOpen, setCreateHookOpen] = useState(false)
  const [rawKey, setRawKey] = useState('')
  const [newKey, setNewKey] = useState({ name: '', scopes: [] as string[] })
  const [newHook, setNewHook] = useState({ name: '', target_url: '', events: [] as string[] })
  const [viewHook, setViewHook] = useState<WebhookType | null>(null)
  const [history, setHistory] = useState<EventRow[]>([])
  const [isExportingClients, setIsExportingClients] = useState(false)
  const [isExportingHooks, setIsExportingHooks] = useState(false)
  const [copied, setCopied] = useState(false)
  
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

  const handleCopyKey = () => {
    navigator.clipboard.writeText(rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportClients = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExportingClients(true)
    try {
      const filename = `marq_api_clients_${new Date().toISOString().split('T')[0]}`
      const exportColumns: ExportColumn[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Scopes', accessor: (c: any) => c.scopes.join(', ') },
        { header: 'Created', accessor: (c: any) => new Date(c.created_at).toLocaleString() },
        { header: 'Last Used', accessor: (c: any) => c.last_used_at ? new Date(c.last_used_at).toLocaleString() : '-' },
        { header: 'Status', accessor: (c: any) => c.is_active ? 'Active' : 'Inactive' }
      ]
      if (type === 'csv') await exportToCsv(clients, exportColumns, filename)
      else await exportToPdf(clients, exportColumns, 'API Keys', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExportingClients(false)
    }
  }

  const handleExportHooks = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExportingHooks(true)
    try {
      const filename = `marq_webhooks_${new Date().toISOString().split('T')[0]}`
      const exportColumns: ExportColumn[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Target URL', accessor: 'target_url' },
        { header: 'Events', accessor: (h: any) => h.events.join(', ') },
        { header: 'Status', accessor: (h: any) => h.is_active ? 'Active' : 'Inactive' },
        { header: 'Last Triggered', accessor: (h: any) => h.last_triggered_at ? new Date(h.last_triggered_at).toLocaleString() : '-' }
      ]
      if (type === 'csv') await exportToCsv(hooks, exportColumns, filename)
      else await exportToPdf(hooks, exportColumns, 'Webhooks', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExportingHooks(false)
    }
  }

  const apiColumns = ['Name', 'Scopes', 'Created', 'Last Used', 'Status', 'Actions']
  const apiRows = clients.map(c => [
    <div key="name" className="flex flex-col">
      <span className="font-medium text-slate-700">{c.name}</span>
      <span className="text-xs text-slate-400 font-mono">{c.id.substring(0, 8)}...</span>
    </div>,
    <div key="scopes" className="flex flex-wrap gap-1">
      {c.scopes.map(s => (
        <span key={s} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs border border-indigo-100">
          {s}
        </span>
      ))}
    </div>,
    <span key="created" className="text-sm text-slate-600">{new Date(c.created_at).toLocaleDateString()}</span>,
    <span key="last" className="text-sm text-slate-500">{c.last_used_at ? new Date(c.last_used_at).toLocaleDateString() : 'Never'}</span>,
    <span key="status" className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
      {c.is_active ? 'Active' : 'Inactive'}
    </span>,
    <div key="actions" className="flex items-center gap-2">
      <button 
        className={`p-1.5 rounded-lg transition-colors ${c.is_active ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600' : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'}`}
        title={c.is_active ? 'Deactivate' : 'Activate'} 
        onClick={()=>toggleClient(c.id, !c.is_active)}
      >
        {c.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  ])

  const hookColumns = ['Name', 'Target', 'Status', 'Last Trigger', 'Actions']
  const hookRows = hooks.map(h => [
    <span key="name" className="font-medium text-slate-700">{h.name}</span>,
    <div key="target" className="flex items-center gap-2 text-sm text-slate-600 max-w-[200px] truncate">
      <code className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-xs text-slate-500">{h.target_url}</code>
    </div>,
    <span key="status" className={`px-2 py-0.5 rounded-full text-xs font-medium ${h.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
      {h.is_active ? 'Active' : 'Inactive'}
    </span>,
    <span key="last" className="text-sm text-slate-500">{h.last_triggered_at ? new Date(h.last_triggered_at).toLocaleString() : 'Never'}</span>,
    <div key="actions" className="flex items-center gap-2">
      <button 
        className={`p-1.5 rounded-lg transition-colors ${h.is_active ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600' : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'}`}
        onClick={()=>toggleHook(h.id, !h.is_active)}
        title={h.is_active ? 'Deactivate' : 'Activate'}
      >
        {h.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <button 
        className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
        onClick={()=>{ setViewHook(h); loadHistory(h.id) }}
        title="View Events"
      >
        <Activity size={16} />
      </button>
    </div>
  ])

  const eventColumns = ['Event', 'Status', 'Attempts', 'Time', 'Error']
  const eventRows = history.map(e => [
    <span key="type" className="font-mono text-xs text-slate-600">{e.event_type}</span>,
    <span key="status" className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {e.status}
    </span>,
    <span key="attempts" className="text-sm text-slate-600">{e.attempt_count}</span>,
    <span key="time" className="text-sm text-slate-500">{e.last_attempt_at ? new Date(e.last_attempt_at).toLocaleString() : '-'}</span>,
    <span key="error" className="text-xs text-rose-600 max-w-[200px] truncate" title={e.error_message || ''}>{e.error_message || '-'}</span>
  ])

  const allScopes = ['read:org','read:members','read:time','read:payroll','read:billing','read:leave','webhooks:*']
  const allEvents = ['member.check_in','member.check_out','time.daily_closed','payroll.period_approved','leave.request_created','leave.request_approved','leave.request_rejected']

  return (
    <AppShell title="Integrations & API">
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
              <Terminal size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Integrations & API</h1>
              <p className="text-slate-500 text-sm">Manage API keys and webhooks for external integrations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <GlassSelect 
                value={orgId} 
                onChange={(e: any) => setOrgId(e.target.value)}
                className="pl-10 min-w-[200px]"
              >
                {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-end">
          <GlassButton onClick={()=>setCreateKeyOpen(true)} className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700">
            <Plus size={16} /> Create API Key
          </GlassButton>
          <GlassButton onClick={()=>setCreateHookOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white border-none">
            <Plus size={16} /> Add Webhook
          </GlassButton>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard 
            title={
              <div className="flex items-center gap-2">
                <Key className="text-indigo-600" size={20} />
                <span>API Keys</span>
              </div>
            }
            right={<ExportMenu onExport={handleExportClients} isExporting={isExportingClients} />}
            className="h-full relative overflow-hidden"
          >
            <Key size={120} className="text-indigo-900/5 absolute -bottom-4 -right-4 pointer-events-none z-0" />
            <div className="relative z-10">
              {clients.length > 0 ? (
                <GlassTable columns={apiColumns} rows={apiRows} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Key size={48} className="mb-4 text-slate-200" />
                  <p className="text-sm">No API keys found</p>
                  <GlassButton variant="link" onClick={()=>setCreateKeyOpen(true)} className="mt-2 text-indigo-600">
                    Create your first key
                  </GlassButton>
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard 
            title={
              <div className="flex items-center gap-2">
                <Webhook className="text-pink-600" size={20} />
                <span>Webhooks</span>
              </div>
            }
            right={<ExportMenu onExport={handleExportHooks} isExporting={isExportingHooks} />}
            className="h-full relative overflow-hidden"
          >
            <Webhook size={120} className="text-pink-900/5 absolute -bottom-4 -right-4 pointer-events-none z-0" />
            <div className="relative z-10">
              {hooks.length > 0 ? (
                <GlassTable columns={hookColumns} rows={hookRows} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Webhook size={48} className="mb-4 text-slate-200" />
                  <p className="text-sm">No webhooks configured</p>
                  <GlassButton variant="link" onClick={()=>setCreateHookOpen(true)} className="mt-2 text-pink-600">
                    Add a webhook
                  </GlassButton>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Create API Key Modal */}
        <GlassModal open={createKeyOpen} title="Create API Key" onClose={()=>setCreateKeyOpen(false)}>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Key Name</label>
              <GlassInput 
                placeholder="e.g. Production Server" 
                value={newKey.name} 
                onChange={(e: any)=>setNewKey(v=>({...v,name:e.target.value}))} 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-2 block">Scopes</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {allScopes.map(s => (
                  <label key={s} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={newKey.scopes.includes(s)} 
                      onChange={e=>{ const on=e.target.checked; setNewKey(v=> ({...v, scopes: on ? [...v.scopes, s] : v.scopes.filter(x=>x!==s) })) }} 
                    />
                    <span className="text-sm text-slate-700 font-mono">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <GlassButton variant='secondary' onClick={()=>setCreateKeyOpen(false)}>Cancel</GlassButton>
              <GlassButton onClick={createKey} disabled={!newKey.name || newKey.scopes.length === 0} className="bg-indigo-600 text-white hover:bg-indigo-700 border-none">
                Create Key
              </GlassButton>
            </div>
          </div>
        </GlassModal>

        {/* Create Webhook Modal */}
        <GlassModal open={createHookOpen} title="Add Webhook" onClose={()=>setCreateHookOpen(false)}>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Webhook Name</label>
              <GlassInput 
                placeholder="e.g. Payroll System" 
                value={newHook.name} 
                onChange={(e: any)=>setNewHook(v=>({...v,name:e.target.value}))} 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Target URL</label>
              <GlassInput 
                placeholder="https://api.example.com/webhooks/marq" 
                value={newHook.target_url} 
                onChange={(e: any)=>setNewHook(v=>({...v,target_url:e.target.value}))} 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-2 block">Trigger Events</label>
              <div className="grid grid-cols-1 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 max-h-[200px] overflow-y-auto">
                {allEvents.map(ev => (
                  <label key={ev} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                      checked={newHook.events.includes(ev)} 
                      onChange={e=>{ const on=e.target.checked; setNewHook(v=> ({...v, events: on ? [...v.events, ev] : v.events.filter(x=>x!==ev) })) }} 
                    />
                    <span className="text-sm text-slate-700 font-mono">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <GlassButton variant='secondary' onClick={()=>setCreateHookOpen(false)}>Cancel</GlassButton>
              <GlassButton onClick={createHook} disabled={!newHook.name || !newHook.target_url || newHook.events.length === 0} className="bg-pink-600 text-white hover:bg-pink-700 border-none">
                Add Webhook
              </GlassButton>
            </div>
          </div>
        </GlassModal>

        {/* View Events Modal */}
        <GlassModal open={!!viewHook} title={viewHook ? `Webhook Events — ${viewHook.name}` : ''} onClose={()=>{ setViewHook(null); setHistory([]) }}>
          <div className="mt-4">
            <GlassTable columns={eventColumns} rows={eventRows} />
          </div>
        </GlassModal>

        {/* Raw Key Modal */}
        <GlassModal open={!!rawKey} title="API Key Generated" onClose={()=>setRawKey('')} hideClose={true}>
          <div className="mt-2 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
              <AlertTriangle size={20} className="shrink-0" />
              <p className="text-sm">Make sure to copy this key now. You won't be able to see it again!</p>
            </div>
            
            <div className="relative group">
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-sm break-all border border-slate-800 shadow-inner">
                {rawKey}
              </div>
              <button 
                onClick={handleCopyKey}
                className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>

            <div className="flex justify-end">
              <GlassButton onClick={()=>setRawKey('')}>Done</GlassButton>
            </div>
          </div>
        </GlassModal>

      </div>
    </AppShell>
  )
}
