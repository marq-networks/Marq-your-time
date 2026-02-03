"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import AdjustmentLogTable from '@components/hr/AdjustmentLogTable'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { Plus, Search, Calendar, Filter, FileText } from 'lucide-react'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

export default function HRAdjustmentsPage() {
  const [role, setRole] = useState('')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  // Filters
  const [moduleId, setModuleId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Manual Entry Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    module: 'time_logs',
    employeeUserId: '',
    fieldName: '',
    oldValue: '',
    newValue: '',
    reason: ''
  })
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function getCookie(name: string) {
    if (typeof document === 'undefined') return ''
    return document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.split('=')[1] || ''
  }

  useEffect(() => { 
    // Auth Check
    const uid = getCookie('current_user_id')
    const orgLogin = getCookie('org_login')
    
    if (!uid && !orgLogin) {
      // If no cookie, try to see if we are logged out
      window.location.href = '/auth/login'
      return
    }

    try { 
      let r = normalizeRoleForApi(getCookie('current_role'))
      if (!r && orgLogin) r = 'admin'
      setRole(r) 
    } catch {} 
  }, [])

  const loadOrgs = async () => {
    const orgLogin = getCookie('org_login')
    const endpoint = (role === 'super_admin' && !orgLogin) ? '/api/org/list' : '/api/orgs/my'
    
    // If Org Login, we can't use /api/orgs/my (requires user). Use /api/org/[id] instead.
    if (orgLogin) {
       const oid = getCookie('current_org_id')
       if (oid) {
         try {
           const res = await fetch(`/api/org/${oid}`, { cache: 'no-store' })
           const data = await res.json()
           if (data.org) {
             setOrgs([data.org])
             setOrgId(data.org.id)
           }
         } catch(e) { console.error(e) }
       }
       return
    }

    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (res.status === 401) {
         window.location.href = '/auth/login'
         return
      }
      const data = await res.json()
      const items: Org[] = Array.isArray(data.items) ? (data.items as Org[]) : []
      setOrgs(items)
      if (!orgId && items.length) {
        const cookieOrgId = getCookie('current_org_id')
        const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
        setOrgId(preferred)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadMembers = async (oid: string) => {
    if (!oid) return
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setMembers(data.items || [])
  }

  const loadLogs = async () => {
    if (!orgId) return
    setLoading(true)
    let url = `/api/hr-adjustments-log/list?orgId=${orgId}`
    if (moduleId) url += `&module=${moduleId}`
    if (employeeId) url += `&employeeUserId=${employeeId}`
    if (dateFrom) url += `&from=${dateFrom}`
    if (dateTo) url += `&to=${dateTo}`
    
    try {
      const res = await fetch(url, { 
        cache: 'no-store',
        headers: {
          'x-user-id': getCookie('current_user_id'),
          'x-role': getCookie('current_role')
        }
      })
      const data = await res.json()
      setLogs(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { if (orgId) { loadMembers(orgId); loadLogs(); } }, [orgId])

  // Reload when filters change
  useEffect(() => { if (orgId) loadLogs() }, [moduleId, employeeId, dateFrom, dateTo])

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      // Use current logs state
      const exportItems = logs
      
      const exportColumns: ExportColumn[] = [
        { header: 'Date', accessor: 'created_at' },
        { header: 'Module', accessor: 'module' },
        { header: 'Employee', accessor: (l) => `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}` },
        { header: 'Field', accessor: 'field_name' },
        { header: 'Old Value', accessor: (l) => JSON.stringify(l.old_value) },
        { header: 'New Value', accessor: (l) => JSON.stringify(l.new_value) },
        { header: 'Reason', accessor: 'reason' },
        { header: 'Actor', accessor: (l) => `${l.actor?.firstName || ''} ${l.actor?.lastName || ''}` },
      ]

      const filename = `marq_hr_adjustments_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'HR Adjustments Log', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const handleManualSubmit = async () => {
    if (!orgId || !formData.employeeUserId || !formData.reason || formData.reason.length < 8) {
      alert('Please fill in all required fields. Reason must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    try {
      let attachment = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('orgId', orgId)
        const upRes = await fetch('/api/hr-adjustments-log/upload', { 
          method: 'POST', 
          body: fd,
          headers: {
            'x-user-id': getCookie('current_user_id'),
            'x-role': getCookie('current_role')
          }
        })
        if (!upRes.ok) {
           const errData = await upRes.json().catch(() => ({}))
           throw new Error(errData.error || errData.details?.message || `Upload failed: ${upRes.statusText}`)
        }
        const upData = await upRes.json()
        attachment = { path: upData.path, url: upData.url, name: file.name }
      }

      const payload = {
        org_id: orgId,
        employee_user_id: formData.employeeUserId,
        module: formData.module,
        entity_table: 'manual_entry',
        entity_id: null,
        field_name: formData.fieldName || 'manual_adjustment',
        old_value: formData.oldValue,
        new_value: formData.newValue,
        reason: formData.reason,
        attachment_path: attachment ? attachment.path : null
      }

      const res = await fetch('/api/hr-adjustments-log/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': getCookie('current_user_id'),
          'x-role': getCookie('current_role')
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create log')
      }
      
      setModalOpen(false)
      setFormData({ module: 'time_logs', employeeUserId: '', fieldName: '', oldValue: '', newValue: '', reason: '' })
      setFile(null)
      loadLogs()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="HR Adjustments Log">
      <GlassCard 
        title={
          <div className="flex items-center gap-2">
            <FileText className="text-indigo-600" size={20} />
            <span>Audit Log</span>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            {['super_admin','admin','manager'].includes(role) && (       
               <GlassButton onClick={()=>setModalOpen(true)} variant="primary" className="flex items-center gap-2 px-4">
                 <Plus size={16} />
                 <span>New Entry</span>
               </GlassButton>
            )}
            <ExportMenu 
              onExport={handleExport} 
              isExporting={isExporting}
            />
          </div>
        }
      >
        <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
          <div className="flex-1 min-w-[200px]">
            <div className="label flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <Filter size={12} />
              Organization
            </div>
             {(['employee','member'].includes(role)) ? (
                <span className="tag-pill">{orgs.find(o=>o.id===orgId)?.orgName || orgs[0]?.orgName || ''}</span>
              ) : (
                <GlassSelect value={orgId} onChange={(e: any)=>setOrgId(e.target.value)} className="bg-white">
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              )}
          </div>
          
          <div className="flex-1 min-w-[160px]">
            <div className="label flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <Filter size={12} />
              Module
            </div>
            <GlassSelect value={moduleId} onChange={(e: any)=>setModuleId(e.target.value)} className="bg-white">
              <option value="">All Modules</option>
              <option value="time_logs">Time Logs</option>
              <option value="breaks">Breaks</option>
              <option value="attendance">Attendance</option>
              <option value="pto">PTO</option>
              <option value="payroll">Payroll</option>
            </GlassSelect>
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="label flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <Search size={12} />
              Employee
            </div>
            <GlassSelect value={employeeId} onChange={(e: any)=>setEmployeeId(e.target.value)} className="bg-white">
              <option value="">All Employees</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>

          <div className="flex items-end gap-2">
             <div>
               <div className="label flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                 <Calendar size={12} />
                 From
               </div>
               <GlassInput type="date" value={dateFrom} onChange={(e: any)=>setDateFrom(e.target.value)} className="bg-white" />
             </div>
             <div>
               <div className="label flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                 <Calendar size={12} />
                 To
               </div>
               <GlassInput type="date" value={dateTo} onChange={(e: any)=>setDateTo(e.target.value)} className="bg-white" />
             </div>
          </div>
        </div>

        <AdjustmentLogTable logs={logs} loading={loading} />
      </GlassCard>

      <GlassModal open={modalOpen} title="Add Manual Log Entry" onClose={()=>setModalOpen(false)}>
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <div>
            <div className="label">Module</div>
            <GlassSelect value={formData.module} onChange={(e:any)=>setFormData({...formData, module: e.target.value})}>
              <option value="time_logs">Time Logs</option>
              <option value="breaks">Breaks</option>
              <option value="attendance">Attendance</option>
              <option value="pto">PTO</option>
              <option value="payroll">Payroll</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Employee</div>
            <GlassSelect value={formData.employeeUserId} onChange={(e:any)=>setFormData({...formData, employeeUserId: e.target.value})}>
              <option value="">Select Employee</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Field Name (Optional)</div>
            <GlassInput value={formData.fieldName} onChange={(e:any)=>setFormData({...formData, fieldName: e.target.value})} placeholder="e.g. status, amount" />
          </div>
          <div className="grid grid-2" style={{gap:10}}>
             <div>
               <div className="label">Old Value (Optional)</div>
               <GlassInput value={formData.oldValue} onChange={(e:any)=>setFormData({...formData, oldValue: e.target.value})} />
             </div>
             <div>
               <div className="label">New Value (Optional)</div>
               <GlassInput value={formData.newValue} onChange={(e:any)=>setFormData({...formData, newValue: e.target.value})} />
             </div>
          </div>
          <div>
            <div className="label">Reason (Required, min 8 chars)</div>
            <GlassInput value={formData.reason} onChange={(e:any)=>setFormData({...formData, reason: e.target.value})} placeholder="Explanation for this adjustment..." />
          </div>
          <div>
            <div className="label">Attachment (Optional)</div>
            <input type="file" onChange={(e:any)=>setFile(e.target.files[0] || null)} style={{color:'var(--foreground)', marginTop:4}} />
          </div>
          <div style={{display:'flex', justifyContent:'flex-end', marginTop:10}}>
            <GlassButton onClick={handleManualSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Entry'}
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </AppShell>
  )
}
