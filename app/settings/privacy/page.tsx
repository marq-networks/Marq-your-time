'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import ExportMenu from '@/components/shared/ExportMenu'

type Policy = { id?: string, category: string, retentionDays: number, hardDelete: boolean }
type RequestItem = { id: string, subjectType: string, subjectId: string, requestType: string, status: string, createdAt: number }

const CATEGORIES = ['activity_logs','screenshots','time_logs','audit_logs']

export default function PrivacySettingsPage() {
  const [orgId, setOrgId] = useState('')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [requestSearch, setRequestSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const loadPolicies = async (oid: string) => {
    const res = await fetch(`/api/privacy/retention-policies?org_id=${encodeURIComponent(oid)}`)
    const data = await res.json()
    const items: any[] = data.items || []
    const byCat = new Map<string, Policy>(items.map(r => [String(r.category), { id: r.id, category: r.category, retentionDays: Number(r.retention_days ?? r.retentionDays ?? 0), hardDelete: !!(r.hard_delete ?? r.hardDelete) }]))
    const list = CATEGORIES.map(c => byCat.get(c) || { category: c, retentionDays: 365, hardDelete: false })
    setPolicies(list)
  }

  const savePolicies = async () => {
    const res = await fetch('/api/privacy/retention-policies/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, policies: policies.map(p => ({ category: p.category, retention_days: p.retentionDays, hard_delete: p.hardDelete })) }) })
    if (res.ok) loadPolicies(orgId)
  }

  const loadRequests = async (oid: string, st?: string) => {
    const url = `/api/privacy/request/list?org_id=${encodeURIComponent(oid)}${st?`&status=${encodeURIComponent(st)}`:''}`
    const res = await fetch(url)
    const data = await res.json()
    setRequests((data.items || []).map((r:any)=>({ id:r.id, subjectType:r.subject_type||r.subjectType, subjectId:r.subject_id||r.subjectId, requestType:r.request_type||r.requestType, status:r.status, createdAt: Number(r.created_at?new Date(r.created_at).getTime():r.createdAt||Date.now()) })))
  }

  useEffect(() => {
    const oid = (localStorage.getItem('org_id') || localStorage.getItem('orgId') || '')
    if (oid) { setOrgId(oid); loadPolicies(oid); loadRequests(oid) }
  }, [])

  const filteredRequests = requests.filter(r=>{
    const q = requestSearch.trim().toLowerCase()
    if (!q) return true
    const text = `${r.id} ${r.subjectType}:${r.subjectId} ${r.requestType}`.toLowerCase()
    return text.includes(q)
  })

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = filteredRequests
      const exportColumns: ExportColumn[] = [
        { header: 'ID', accessor: 'id' },
        { header: 'Subject', accessor: (r) => `${r.subjectType}:${r.subjectId}` },
        { header: 'Type', accessor: 'requestType' },
        { header: 'Status', accessor: 'status' },
        { header: 'Created At', accessor: (r) => new Date(r.createdAt).toLocaleString() },
      ]
      const filename = `marq_privacy_requests_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'Privacy Requests', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell title="Privacy & GDPR">
      <div style={{display:'grid',gap:16}}>
        <GlassCard title="Retention Policies" right={<GlassButton onClick={savePolicies}>Save</GlassButton>}>
          <GlassTable columns={['Category','Retention Days','Hard Delete']} rows={policies.map((p,i)=>[
            p.category,
            <GlassInput key={`d-${i}`} type="number" value={String(p.retentionDays)} onChange={e=>{ const v = Number(e.target.value||0); setPolicies(prev=> prev.map((x,j)=> j===i ? { ...x, retentionDays: v } : x)) }} />,
            <GlassSelect key={`h-${i}`} value={p.hardDelete?'true':'false'} onChange={e=>{ const v = e.target.value==='true'; setPolicies(prev=> prev.map((x,j)=> j===i ? { ...x, hardDelete: v } : x)) }}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </GlassSelect>
          ])} />
        </GlassCard>

        <GlassCard title="Privacy Requests" right={
          <div className="row" style={{ gap: 8 }}>
            <GlassSelect value={statusFilter} onChange={e=>{ const v = e.target.value; setStatusFilter(v); loadRequests(orgId, v||undefined) }}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </GlassSelect>
            <ExportMenu onExport={handleExport} isExporting={isExporting} />
          </div>
        }>
          <div className="row" style={{margin:'0 0 12px 0'}}>
            <div style={{flex:1,minWidth:220}}>
              <div className="label">Search requests</div>
              <GlassInput value={requestSearch} onChange={e=>setRequestSearch(e.target.value)} placeholder="Search by ID or subject" />
            </div>
          </div>
          <GlassTable columns={['ID','Subject','Type','Status','Actions']} rows={filteredRequests.map(r=>[
            r.id,
            `${r.subjectType}:${r.subjectId}`,
            r.requestType,
            r.status,
            <div key={`act-${r.id}`} style={{display:'flex',gap:8}}>
              {r.requestType==='export' && r.status==='completed' ? <GlassButton variant="secondary" href={`/api/privacy/export/download?id=${encodeURIComponent(r.id)}`}>Download</GlassButton> : null}
              {r.status==='pending' ? <GlassButton onClick={async()=>{ await fetch('/api/privacy/request/process',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: r.id }) }); loadRequests(orgId, statusFilter||undefined) }}>Process</GlassButton> : null}
            </div>
          ])} />
        </GlassCard>
      </div>
    </AppShell>
  )
}
