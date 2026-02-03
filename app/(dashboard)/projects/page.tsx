"use client"
import { useEffect, useState } from 'react'
import AppShell from '@/components/ui/AppShell'
import GlassButton from '@/components/ui/GlassButton'
import GlassInput from '@/components/ui/GlassInput'
import GlassSelect from '@/components/ui/GlassSelect'
import GlassModal from '@/components/ui/GlassModal'
import { normalizeRoleForApi } from '@/lib/permissions'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import { Plus, Briefcase, Users, CheckSquare, Search, Filter } from 'lucide-react'

type Member = { id: string, firstName: string, lastName: string }

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'projects' | 'tasks'>('clients')
  const [orgId, setOrgId] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [role, setRole] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    try {
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r)
      const oid = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      setOrgId(oid)
    } catch {}
  }, [])

  const getHeaders = () => {
    const headers: any = {
      'Content-Type': 'application/json'
    }
    if (typeof document !== 'undefined') {
      const uid = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1]
      if (uid) headers['x-user-id'] = uid
      
      const r = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1]
      if (r) headers['x-role'] = normalizeRoleForApi(r)
      
      if (orgId) headers['x-org-id'] = orgId
    }
    return headers
  }

  const loadClients = async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/clients/list?org_id=${orgId}`, { 
        cache: 'no-store',
        headers: getHeaders()
      })
      const data = await res.json()
      setClients(data.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadProjects = async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/projects/list?org_id=${orgId}`, { 
        cache: 'no-store',
        headers: getHeaders()
      })
      const data = await res.json()
      setProjects(data.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadMembers = async (oid: string) => {
    try {
      const res = await fetch(`/api/user/list?orgId=${oid}`, { 
        cache: 'no-store',
        headers: getHeaders()
      })
      const data = await res.json()
      setMembers(data.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadTasks = async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/tasks/list?org_id=${orgId}`, { 
        cache: 'no-store',
        headers: getHeaders()
      })
      const data = await res.json()
      setTasks(data.items || [])
    } catch (e) {
      console.error(e)
    }
  }
  
  useEffect(() => {
    if (orgId) {
      loadClients()
      loadProjects()
      loadMembers(orgId)
    }
  }, [orgId])
  
  useEffect(() => {
    if (activeTab === 'tasks' && orgId) {
      loadTasks()
    }
  }, [activeTab, orgId])

  const handleCreate = async () => {
    if (!orgId) return
    let endpoint = ''
    let body: any = { ...formData, org_id: orgId }
    
    if (activeTab === 'clients') endpoint = '/api/clients/create'
    if (activeTab === 'projects') {
      endpoint = '/api/projects/create'
      if (formData.manager_id === '') delete body.manager_id
    }
    if (activeTab === 'tasks') {
      endpoint = '/api/tasks/create'
      if (formData.assignee_id === '') delete body.assignee_id
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    })
    
    if (res.ok) {
      setCreateModalOpen(false)
      setFormData({})
      if (activeTab === 'clients') loadClients()
      if (activeTab === 'projects') loadProjects()
      if (activeTab === 'tasks') loadTasks()
    } else {
      alert('Failed to create item')
    }
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      let exportItems: any[] = []
      let exportColumns: ExportColumn[] = []
      let filename = `marq_${activeTab}_${new Date().toISOString().split('T')[0]}`

      if (activeTab === 'clients') {
        exportItems = clients
        exportColumns = [
          { header: 'Name', accessor: 'name' },
          { header: 'Email', accessor: 'email' },
          { header: 'Status', accessor: 'status' },
          { header: 'Address', accessor: 'address' },
        ]
      } else if (activeTab === 'projects') {
        exportItems = projects
        exportColumns = [
          { header: 'Name', accessor: 'name' },
          { header: 'Client', accessor: (p) => clients.find(c => c.id === p.clientId)?.name || '-' },
          { header: 'Status', accessor: 'status' },
          { header: 'Code', accessor: 'code' },
          { header: 'Manager', accessor: (p) => members.find(m => m.id === p.managerId) ? `${members.find(m => m.id === p.managerId)!.firstName} ${members.find(m => m.id === p.managerId)!.lastName}` : '-' },
          { header: 'Description', accessor: 'description' },
        ]
      } else if (activeTab === 'tasks') {
        exportItems = tasks
        exportColumns = [
          { header: 'Title', accessor: 'title' },
          { header: 'Project', accessor: (t) => projects.find(p => p.id === t.projectId)?.name || '-' },
          { header: 'Status', accessor: 'status' },
          { header: 'Priority', accessor: 'priority' },
          { header: 'Assignee', accessor: (t) => members.find(m => m.id === t.assigneeId) ? `${members.find(m => m.id === t.assigneeId)!.firstName} ${members.find(m => m.id === t.assigneeId)!.lastName}` : '-' },
          { header: 'Description', accessor: 'description' },
        ]
      }

      if (exportItems.length === 0) {
        alert('No data to export')
        return
      }

      if (type === 'csv') {
        exportToCsv(exportItems, exportColumns, filename)
      } else {
        exportToPdf(exportItems, exportColumns, activeTab.charAt(0).toUpperCase() + activeTab.slice(1), filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Filter items based on search
  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase()))
  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  // Prepare table rows
  const clientRows = filteredClients.map(c => [
    <div key="n" className="font-semibold text-indigo-900">{c.name}</div>,
    <div key="e" className="text-slate-500 text-sm">{c.email || '-'}</div>,
    <span key="s" className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${c.status === 'active' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50' : 'bg-slate-100/50 text-slate-600 border-slate-200/50'}`}>{c.status}</span>,
    <div key="a" className="text-slate-500 truncate max-w-xs text-sm">{c.address || '-'}</div>
  ])

  const projectRows = filteredProjects.map(p => [
    <div key="n" className="font-semibold text-indigo-900">{p.name}</div>,
    <div key="c" className="text-slate-600 text-sm">{clients.find(c => c.id === p.clientId)?.name || '-'}</div>,
    <span key="s" className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${p.status === 'active' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50' : 'bg-slate-100/50 text-slate-600 border-slate-200/50'}`}>{p.status}</span>,
    <div key="code" className="font-mono text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100 w-fit">{p.code}</div>,
    <div key="m" className="text-slate-500 text-sm">{members.find(m => m.id === p.managerId) ? `${members.find(m => m.id === p.managerId)!.firstName} ${members.find(m => m.id === p.managerId)!.lastName}` : '-'}</div>
  ])

  const taskRows = filteredTasks.map(t => [
    <div key="t" className="font-medium text-slate-800">{t.title}</div>,
    <div key="p" className="text-indigo-600 text-sm font-medium">{projects.find(p => p.id === t.projectId)?.name || '-'}</div>,
    <span key="s" className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${t.status === 'completed' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50' : 'bg-amber-100/50 text-amber-700 border-amber-200/50'}`}>{t.status}</span>,
    <span key="pr" className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${t.priority === 'high' ? 'bg-rose-100/50 text-rose-700 border-rose-200/50' : t.priority === 'medium' ? 'bg-blue-100/50 text-blue-700 border-blue-200/50' : 'bg-slate-100/50 text-slate-600 border-slate-200/50'}`}>{t.priority}</span>,
    <div key="a" className="flex items-center gap-2 text-sm text-slate-600">
        {members.find(m => m.id === t.assigneeId) ? (
            <>
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold border border-indigo-200">
                    {members.find(m => m.id === t.assigneeId)!.firstName[0]}
                </div>
                <span>{members.find(m => m.id === t.assigneeId)!.firstName}</span>
            </>
        ) : '-'}
    </div>
  ])

  const CustomTable = ({ columns, rows }: { columns: string[], rows: React.ReactNode[][] }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-indigo-100/50 bg-indigo-50/30">
            {columns.map((col, i) => (
              <th key={i} className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider first:pl-8 last:pr-8">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-indigo-50">
          {rows.length > 0 ? (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-indigo-50/30 transition-colors group">
                {row.map((cell, j) => (
                  <td key={j} className="px-6 py-4 whitespace-nowrap first:pl-8 last:pr-8">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 text-sm">
                No items found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <AppShell title="Project Management">
      <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-10">
        {/* Controls */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-xl shadow-indigo-100/50 flex flex-col md:flex-row gap-6 justify-between items-center">
          <div className="flex gap-1 p-1.5 bg-white/50 border border-white/60 rounded-xl shadow-inner">
            {(['clients', 'projects', 'tasks'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30' 
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-white/80'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-72 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/80 border border-indigo-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-medium text-slate-700 placeholder-indigo-300 transition-all hover:border-indigo-300"
              />
            </div>
            
            <ExportMenu 
              onExport={handleExport}
              isExporting={isExporting} 
            />
            
            <GlassButton variant="primary" onClick={() => { setFormData({}); setCreateModalOpen(true) }}>
              <Plus size={18} className="mr-2" />
              New {activeTab.slice(0, -1)}
            </GlassButton>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100/50 min-h-[400px]">
          {activeTab === 'clients' && (
            <CustomTable 
              columns={['Name', 'Email', 'Status', 'Address']}
              rows={clientRows}
            />
          )}

          {activeTab === 'projects' && (
            <CustomTable 
              columns={['Name', 'Client', 'Status', 'Code', 'Manager']}
              rows={projectRows}
            />
          )}

          {activeTab === 'tasks' && (
            <CustomTable 
              columns={['Title', 'Project', 'Status', 'Priority', 'Assignee']}
              rows={taskRows}
            />
          )}
        </div>
      </div>

      <GlassModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title={`Create ${activeTab.slice(0, -1)}`}>
        <div className="flex flex-col gap-4">
          {activeTab === 'clients' && (
            <>
              <GlassInput placeholder="Name" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
              <GlassInput placeholder="Email" value={formData.email || ''} onChange={(e:any) => setFormData({...formData, email: e.target.value})} />
              <GlassInput placeholder="Address" value={formData.address || ''} onChange={(e:any) => setFormData({...formData, address: e.target.value})} />
            </>
          )}
          {activeTab === 'projects' && (
            <>
              <GlassInput placeholder="Name" value={formData.name || ''} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
              <GlassSelect value={formData.client_id || ''} onChange={(e:any) => setFormData({...formData, client_id: e.target.value})}>
                <option value="">Select Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </GlassSelect>
              <GlassInput placeholder="Code" value={formData.code || ''} onChange={(e:any) => setFormData({...formData, code: e.target.value})} />
              <GlassInput placeholder="Description" value={formData.description || ''} onChange={(e:any) => setFormData({...formData, description: e.target.value})} />
              <GlassSelect value={formData.manager_id || ''} onChange={(e:any) => setFormData({...formData, manager_id: e.target.value})}>
                <option value="">Select Manager (optional)</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </>
          )}
          {activeTab === 'tasks' && (
            <>
              <GlassInput placeholder="Title" value={formData.title || ''} onChange={(e:any) => setFormData({...formData, title: e.target.value})} />
              <GlassSelect value={formData.project_id || ''} onChange={(e:any) => setFormData({...formData, project_id: e.target.value})}>
                <option value="">Select Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </GlassSelect>
              <GlassInput placeholder="Description" value={formData.description || ''} onChange={(e:any) => setFormData({...formData, description: e.target.value})} />
              <GlassSelect value={formData.priority || 'medium'} onChange={(e:any) => setFormData({...formData, priority: e.target.value})}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </GlassSelect>
              <GlassSelect value={formData.assignee_id || ''} onChange={(e:any) => setFormData({...formData, assignee_id: e.target.value})}>
                <option value="">Assign to employee (optional)</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </>
          )}
          <GlassButton variant="primary" onClick={handleCreate}>Create</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
