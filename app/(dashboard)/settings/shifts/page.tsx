'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'

type Org = { id: string, orgName: string }
type Shift = { id: string, orgId: string, name: string, startTime: string, endTime: string, isOvernight: boolean, graceMinutes: number, breakMinutes: number }

export default function ShiftsSettingsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<Shift[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name:'', start:'09:00', end:'17:00', overnight:false, grace:0, break:0 })
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [loadingShifts, setLoadingShifts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = items.map(s => ({
        name: s.name,
        start: s.startTime,
        end: s.endTime,
        overnight: s.isOvernight ? 'Yes' : 'No',
        grace: String(s.graceMinutes || 0),
        break: String(s.breakMinutes || 0)
      }))
      const exportColumns: ExportColumn[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Start Time', accessor: 'start' },
        { header: 'End Time', accessor: 'end' },
        { header: 'Overnight', accessor: 'overnight' },
        { header: 'Grace (min)', accessor: 'grace' },
        { header: 'Break (min)', accessor: 'break' },
      ]
      const filename = `shifts_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') await exportToCsv(exportItems, exportColumns, filename)
      else await exportToPdf(exportItems, exportColumns, 'Shifts', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const loadOrgs = async () => {
    setLoadingOrgs(true)
    setError('')
    try {
      const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
      const res = await fetch(endpoint, { cache:'no-store' })
      if (!res.ok) return
      const d = await res.json()
      const items: Org[] = Array.isArray(d.items) ? d.items as Org[] : []
      setOrgs(items)
      if (!orgId && items.length) {
        const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
        const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
        setOrgId(preferred)
      }
    } finally {
      setLoadingOrgs(false)
    }
  }

  const loadShifts = async (oid: string) => {
    if (!oid) return
    setLoadingShifts(true)
    try {
      const res = await fetch(`/api/shifts?org_id=${oid}`, { cache:'no-store' })
      if (!res.ok) return
      const d = await res.json()
      setItems(d.items||[])
    } finally {
      setLoadingShifts(false)
    }
  }
  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadShifts(orgId) }, [orgId])

  const addShift = async () => {
    if (!orgId) { setError('Select an organization first'); return }
    if (!form.name || !form.start || !form.end) { setError('Name, start and end time are required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/shifts', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin' }, body: JSON.stringify({ org_id: orgId, name: form.name, start_time: form.start, end_time: form.end, is_overnight: form.overnight, grace_minutes: form.grace, break_minutes: form.break }) })
      if (!res.ok) {
        let msg = 'Failed to save shift'
        try {
          const d = await res.json()
          if (typeof d?.error === 'string') msg = d.error
        } catch {}
        setError(msg)
        return
      }
      setOpen(false)
      setForm({ name:'', start:'09:00', end:'17:00', overnight:false, grace:0, break:0 })
      loadShifts(orgId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="Shift Management">
      <GlassCard title="Organization">
        <div className="grid grid-2">
          <div>
            <div className="label">Select organization</div>
            <select className="input" value={orgId} onChange={(e:any)=> setOrgId(e.target.value)} disabled={loadingOrgs}>
              <option value="">{loadingOrgs ? 'Loading organizations…' : 'Select org'}</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </select>
          </div>
          <div className="row" style={{alignItems:'end',gap:8}}>
            <GlassButton variant="primary" onClick={()=> { setError(''); setOpen(true) }} disabled={!orgId || loadingOrgs}>
              Add Shift
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Configured shifts" right={
        <div className="row" style={{ gap: 8 }}>
          {loadingShifts && <span className="subtitle">Loading…</span>}
          <ExportMenu onExport={handleExport} isExporting={isExporting} />
        </div>
      }>
        {items.length === 0 && !loadingShifts && (
          <div className="subtitle">No shifts configured yet. Click Add Shift to create one.</div>
        )}
        {items.length > 0 && (
          <GlassTable
            columns={['Name','Time','Details']}
            rows={items.map(s => [
              <span key={s.id} className="title">{s.name}</span>,
              <span>{s.startTime} → {s.endTime}{s.isOvernight ? ' (Overnight)' : ''}</span>,
              <div className="row" style={{gap:8}}>
                {s.breakMinutes ? <span className="tag-pill">Break {s.breakMinutes}m</span> : null}
                {s.graceMinutes ? <span className="tag-pill accent">Grace {s.graceMinutes}m</span> : null}
              </div>
            ])}
          />
        )}
      </GlassCard>

      {open && (
        <GlassModal open={open} title="Add Shift" onClose={()=> { if (!saving) setOpen(false) }}>
          <div className="grid grid-2" style={{marginTop:12}}>
            <div>
              <div className="label">Name</div>
              <input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
            </div>
            <div>
              <div className="label">Overnight</div>
              <label className="row" style={{gap:8,alignItems:'center'}}>
                <input type="checkbox" checked={form.overnight} onChange={e=>setForm({...form, overnight:e.target.checked})} />
                <span className="subtitle">Spans across midnight</span>
              </label>
            </div>
            <div>
              <div className="label">Start</div>
              <input className="input" type="time" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} />
            </div>
            <div>
              <div className="label">End</div>
              <input className="input" type="time" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} />
            </div>
            <div>
              <div className="label">Grace minutes</div>
              <input className="input" type="number" min={0} value={form.grace} onChange={e=>setForm({...form, grace:Number(e.target.value)})} />
            </div>
            <div>
              <div className="label">Break minutes</div>
              <input className="input" type="number" min={0} value={form.break} onChange={e=>setForm({...form, break:Number(e.target.value)})} />
            </div>
          </div>
          {error && <div className="subtitle" style={{color:'tomato',marginTop:8}}>{error}</div>}
          <div className="row" style={{gap:8,marginTop:16,justifyContent:'flex-end'}}>
            <GlassButton variant="secondary" onClick={()=> setOpen(false)} disabled={saving}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={addShift} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </GlassButton>
          </div>
        </GlassModal>
      )}
    </AppShell>
  )
}
