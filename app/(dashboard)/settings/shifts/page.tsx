'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'

type Org = { id: string, orgName: string }
type Shift = { id: string, orgId: string, name: string, startTime: string, endTime: string, isOvernight: boolean, graceMinutes: number, breakMinutes: number }

import { Clock, Building, Calendar, Moon, Sun, Briefcase, Plus, AlertCircle, Info } from 'lucide-react'

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
      <div className="flex flex-col gap-6">
        <GlassCard 
          className="relative overflow-hidden"
          title={
            <div className="relative z-10 flex items-center gap-2 text-slate-700">
              <Building size={20} className="text-indigo-600" />
              <span>Organization Config</span>
            </div>
          }
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Building size={120} className="text-indigo-500" />
          </div>
          <div className="relative z-10">
          <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="flex-1 w-full">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Building size={12} /> Select Organization
              </div>
              <GlassSelect 
                value={orgId} 
                onChange={(e:any)=> setOrgId(e.target.value)} 
                disabled={loadingOrgs}
                className="w-full bg-white"
              >
                <option value="">{loadingOrgs ? 'Loading organizations…' : 'Select org'}</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            <GlassButton 
              variant="primary" 
              onClick={()=> { setError(''); setOpen(true) }} 
              disabled={!orgId || loadingOrgs}
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-200 flex items-center gap-2"
            >
              <Plus size={16} /> Add New Shift
            </GlassButton>
          </div>
          </div>
        </GlassCard>

        <GlassCard 
          className="relative overflow-hidden"
          title={
            <div className="relative z-10 flex items-center gap-2 text-slate-700">
              <Clock size={20} className="text-indigo-600" />
              <span>Configured Shifts</span>
            </div>
          }
          right={
            <div className="relative z-10 flex items-center gap-2">
              {loadingShifts && <span className="text-xs text-slate-400 animate-pulse">Syncing...</span>}
              <ExportMenu onExport={handleExport} isExporting={isExporting} />
            </div>
          }
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Clock size={120} className="text-indigo-500" />
          </div>
          <div className="relative z-10">
          {items.length === 0 && !loadingShifts ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Clock size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600 mb-1">No shifts configured</h3>
              <p className="text-sm text-slate-500">Create a shift pattern to start tracking attendance.</p>
            </div>
          ) : (
            <GlassTable
              columns={['Name','Schedule','Configuration']}
              rows={items.map(s => [
                <div key={s.id} className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Briefcase size={16} />
                  </div>
                  <span className="font-semibold text-slate-700">{s.name}</span>
                </div>,
                <div key="time" className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{s.startTime}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{s.endTime}</span>
                  {s.isOvernight && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 font-medium">
                      <Moon size={10} /> Overnight
                    </span>
                  )}
                </div>,
                <div key="config" className="flex items-center gap-2">
                  {s.breakMinutes ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <Sun size={10} /> Break {s.breakMinutes}m
                    </span>
                  ) : null}
                  {s.graceMinutes ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Clock size={10} /> Grace {s.graceMinutes}m
                    </span>
                  ) : null}
                </div>
              ])}
            />
          )}
          </div>
        </GlassCard>

        {open && (
          <GlassModal 
            open={open} 
            title={
              <div className="flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} />
                <span>Add New Shift Pattern</span>
              </div>
            }
            onClose={()=> { if (!saving) setOpen(false) }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Shift Name</div>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  placeholder="e.g. Morning Shift"
                  value={form.name} 
                  onChange={e=>setForm({...form, name:e.target.value})} 
                />
              </div>
              
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Start Time</div>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  type="time" 
                  value={form.start} 
                  onChange={e=>setForm({...form, start:e.target.value})} 
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">End Time</div>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  type="time" 
                  value={form.end} 
                  onChange={e=>setForm({...form, end:e.target.value})} 
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Grace Period (minutes)</div>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  type="number" 
                  min={0} 
                  value={form.grace} 
                  onChange={e=>setForm({...form, grace:Number(e.target.value)})} 
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Break Duration (minutes)</div>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  type="number" 
                  min={0} 
                  value={form.break} 
                  onChange={e=>setForm({...form, break:Number(e.target.value)})} 
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 cursor-pointer hover:bg-indigo-50 transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    checked={form.overnight} 
                    onChange={e=>setForm({...form, overnight:e.target.checked})} 
                  />
                  <div>
                    <span className="text-sm font-semibold text-indigo-900">Overnight Shift</span>
                    <p className="text-xs text-indigo-600/80">Enable this if the shift spans across midnight (e.g. 10 PM to 6 AM)</p>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-lg border border-rose-100">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <GlassButton variant="secondary" onClick={()=> setOpen(false)} disabled={saving}>Cancel</GlassButton>
              <GlassButton variant="primary" onClick={addShift} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white border-none">
                {saving ? 'Saving...' : 'Create Shift'}
              </GlassButton>
            </div>
          </GlassModal>
        )}
      </div>
    </AppShell>
  )
}
