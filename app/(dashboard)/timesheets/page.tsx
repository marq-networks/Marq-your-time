'use client'
import { useEffect, useState } from 'react'
import AppShell from '@/components/ui/AppShell'
import GlassCard from '@/components/ui/GlassCard'
import GlassTable from '@/components/ui/GlassTable'
import GlassButton from '@/components/ui/GlassButton'
import GlassSelect from '@/components/ui/GlassSelect'
import GlassInput from '@/components/ui/GlassInput'
import GlassModal from '@/components/ui/GlassModal'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { Calendar, Users, Building, FileText, Plus, Filter, Search } from 'lucide-react'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

export default function TimesheetsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [range, setRange] = useState<'week'|'month'>('week')
  const [days, setDays] = useState<string[]>([])
  const [rows, setRows] = useState<React.ReactNode[][]>([])
  const [leave, setLeave] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ date:'', reason:'', new_start:'', new_end:'', new_minutes:'' })
  const [timesheetData, setTimesheetData] = useState<any[]>([])
  const [isExporting, setIsExporting] = useState(false)

  const loadOrgs = async () => {
    const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id': 'admin' } })
    const d = await r.json()
    setOrgs(d.items || [])
  }

  const loadUsers = async (org: string) => {
    const r = await fetch(`/api/user/list?orgId=${org}`, { cache:'no-store' })
    const d = await r.json()
    setUsers(d.items || [])
  }

  const computeDays = (mode: 'week'|'month') => {
    const today = new Date()
    let arr: string[] = []
    if (mode === 'week') {
      const start = new Date(today)
      const diff = start.getDay()
      start.setDate(start.getDate() - diff)
      for (let i = 0; i < 7; i++) arr.push(new Date(start.getTime() + i*24*60*60*1000).toISOString().slice(0,10))
    } else {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth()+1, 0)
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24*60*60*1000)) arr.push(d.toISOString().slice(0,10))
    }
    setDays(arr)
  }

  const loadLeave = async () => {
    if (!orgId || !memberId || days.length === 0) { setLeave([]); return }
    const start = days[0]
    const end = days[days.length-1]
    const r = await fetch(`/api/leave/requests?org_id=${orgId}&member_id=${memberId}&status=approved&start_date=${start}&end_date=${end}`, { cache:'no-store' })
    const d = await r.json()
    setLeave(d.items||[])
  }

  const loadRows = async () => {
    if (!orgId || !memberId || days.length === 0) { setRows([]); setTimesheetData([]); return }
    const out: React.ReactNode[][] = []
    const raw: any[] = []
    for (const day of days) {
      const r = await fetch(`/api/time/logs?org_id=${orgId}&date=${day}&member_id=${memberId}`, { cache:'no-store' })
      const d = await r.json()
      const s = (d.items || []).find((x:any) => x.memberId === memberId)
      const worked = s ? s.workedMinutes : 0
      const extra = s ? s.extraMinutes : 0
      const short = s ? s.shortMinutes : 0
      const isLeave = leave.some((lr:any)=> day >= lr.start_date && day <= lr.end_date)
      
      out.push([ 
        <div key="d" className="font-medium text-gray-700">{day}</div>, 
        isLeave ? <span key="s" className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">Leave</span> 
                : <span key="s" className="text-gray-600">{Math.floor(worked/60)}:{String(worked%60).padStart(2,'0')}</span>, 
        <span key="e" className="text-green-600">+{Math.floor(extra/60)}:{String(extra%60).padStart(2,'0')}</span>, 
        <span key="sh" className="text-red-500">-{Math.floor(short/60)}:{String(short%60).padStart(2,'0')}</span>, 
        <GlassButton key="a" variant="secondary" onClick={()=>{ setForm({ date:day, reason:'', new_start:'', new_end:'', new_minutes:'' }); setOpen(true) }}>Request change</GlassButton> 
      ])
      
      raw.push({
        date: day,
        workedMinutes: worked,
        extraMinutes: extra,
        shortMinutes: short,
        status: isLeave ? 'Leave' : 'Working'
      })
    }
    setRows(out)
    setTimesheetData(raw)
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (timesheetData.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'Date', accessor: 'date' },
        { header: 'Status', accessor: 'status' },
        { header: 'Worked', accessor: (item) => `${Math.floor(item.workedMinutes/60)}:${String(item.workedMinutes%60).padStart(2,'0')}` },
        { header: 'Extra', accessor: (item) => `${Math.floor(item.extraMinutes/60)}:${String(item.extraMinutes%60).padStart(2,'0')}` },
        { header: 'Short', accessor: (item) => `${Math.floor(item.shortMinutes/60)}:${String(item.shortMinutes%60).padStart(2,'0')}` }
      ]
      const filename = `marq_timesheets_${orgId}_${memberId}_${days[0]}_${days[days.length-1]}`
      if (type === 'csv') {
        await exportToCsv(timesheetData, exportColumns, filename)
      } else {
        await exportToPdf(timesheetData, exportColumns, 'Timesheet', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const submit = async () => {
    const items = [ { target_date: form.date, new_start: form.new_start ? new Date(form.new_start).toISOString() : undefined, new_end: form.new_end ? new Date(form.new_end).toISOString() : undefined, new_minutes: form.new_minutes ? Number(form.new_minutes) : undefined, note: form.reason } ]
    const res = await fetch('/api/timesheets/change/request', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': memberId }, body: JSON.stringify({ org_id: orgId, member_id: memberId, reason: form.reason, items }) })
    setOpen(false)
    await loadRows()
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadUsers(orgId); setMemberId('') }, [orgId])
  useEffect(()=>{ computeDays(range) }, [range])
  useEffect(()=>{ loadLeave() }, [orgId, memberId, days.length])
  useEffect(()=>{ loadRows() }, [orgId, memberId, days.length, leave.length])

  const columns = ['Date','Worked/Status','Extra','Short','Actions']

  return (
    <AppShell title="Timesheets">
      <div className="flex flex-col gap-6">
        {/* Controls */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
              <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
                <option value="">Select member</option>
                {users.map(u=> <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </GlassSelect>
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Range</label>
              <GlassSelect value={range} onChange={(e:any)=>setRange(e.target.value)}>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </GlassSelect>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ExportMenu onExport={handleExport} isExporting={isExporting} />
          </div>
        </div>

        {/* Content */}
        {rows.length > 0 ? (
          <GlassTable columns={columns} rows={rows} />
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No timesheet data</h3>
            <p className="text-gray-500">Select an organization and member to view timesheets</p>
          </div>
        )}

        <GlassModal open={open} title="Request Change" onClose={()=>setOpen(false)}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <GlassInput type="date" value={form.date} onChange={(e:any)=>setForm({...form, date:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <GlassInput type="text" value={form.reason} onChange={(e:any)=>setForm({...form, reason:e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Start</label>
                <GlassInput type="datetime-local" value={form.new_start} onChange={(e:any)=>setForm({...form, new_start:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New End</label>
                <GlassInput type="datetime-local" value={form.new_end} onChange={(e:any)=>setForm({...form, new_end:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Minutes</label>
                <GlassInput type="number" value={form.new_minutes} onChange={(e:any)=>setForm({...form, new_minutes:e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <GlassButton variant="secondary" onClick={()=>setOpen(false)}>Cancel</GlassButton>
              <GlassButton variant="primary" onClick={submit}>Submit Request</GlassButton>
            </div>
          </div>
        </GlassModal>
      </div>
    </AppShell>
  )
}
