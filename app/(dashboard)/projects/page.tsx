"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'projects' | 'tasks'>('clients')
  const [orgId, setOrgId] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState<any>({})
  
  const [role, setRole] = useState('')

  useEffect(() => {
    try {
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r)
      const oid = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      setOrgId(oid)
    } catch {}
  }, [])

  const loadClients = async () => {
    if (!orgId) return
    const res = await fetch(`/api/clients/list?org_id=${orgId}`, { cache: 'no-store' })
    const data = await res.json()
    setClients(data.items || [])
  }

  const loadProjects = async () => {
    if (!orgId) return
    const res = await fetch(`/api/projects/list?org_id=${orgId}`, { cache: 'no-store' })
    const data = await res.json()
    setProjects(data.items || [])
  }

  const loadTasks = async () => {
    // For tasks, we might want to list all tasks in the org, but our API is project-centric.
    // However, we can iterate projects or add an "all tasks" endpoint.
    // For now, let's just list tasks for the first project if selected, or maybe we need a better way.
    // Actually, let's just fetch tasks for all projects or add an endpoint to list all tasks in org.
    // The current API `api/tasks/list` requires project_id.
    // I'll update it to allow listing by org_id if I want to show all tasks.
    // But for now let's just use what we have and maybe filter.
    // Let's rely on listing projects first.
    if (!projects.length) await loadProjects()
    // This is inefficient but okay for now: fetch tasks for each project
    // Actually, let's skip auto-loading all tasks and only load when a project is selected or just show per project.
    // For this UI, a simple list might be confusing if mixed.
    // Let's fetch all tasks by iterating projects for now.
    const allTasks: any[] = []
    for (const p of projects) {
      const res = await fetch(`/api/tasks/list?project_id=${p.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.items) allTasks.push(...data.items)
    }
    setTasks(allTasks)
  }
  
  useEffect(() => {
    if (orgId) {
      loadClients()
      loadProjects()
    }
  }, [orgId])
  
  useEffect(() => {
    if (activeTab === 'tasks' && projects.length) {
      loadTasks()
    }
  }, [activeTab, projects.length])

  const handleCreate = async () => {
    if (!orgId) return
    let endpoint = ''
    let body = { ...formData, org_id: orgId }
    
    if (activeTab === 'clients') endpoint = '/api/clients/create'
    if (activeTab === 'projects') endpoint = '/api/projects/create'
    if (activeTab === 'tasks') endpoint = '/api/tasks/create'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  return (
    <AppShell title="Project Management">
      <div className="row" style={{ gap: 16, marginBottom: 24 }}>
        <GlassButton variant={activeTab === 'clients' ? 'primary' : 'secondary'} onClick={() => setActiveTab('clients')}>Clients</GlassButton>
        <GlassButton variant={activeTab === 'projects' ? 'primary' : 'secondary'} onClick={() => setActiveTab('projects')}>Projects</GlassButton>
        <GlassButton variant={activeTab === 'tasks' ? 'primary' : 'secondary'} onClick={() => setActiveTab('tasks')}>Tasks</GlassButton>
        <div style={{ flex: 1 }} />
        <GlassButton onClick={() => { setFormData({}); setCreateModalOpen(true) }}>Create New {activeTab.slice(0, -1)}</GlassButton>
      </div>

      <div className="grid">
        {activeTab === 'clients' && (
          <GlassCard title="Clients">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.email}</td>
                    <td>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}

        {activeTab === 'projects' && (
          <GlassCard title="Projects">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{clients.find(c => c.id === p.clientId)?.name || '-'}</td>
                    <td>{p.status}</td>
                    <td>{p.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}

        {activeTab === 'tasks' && (
          <GlassCard title="Tasks">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{projects.find(p => p.id === t.projectId)?.name || '-'}</td>
                    <td>{t.status}</td>
                    <td>{t.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}
      </div>

      <GlassModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title={`Create ${activeTab.slice(0, -1)}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            </>
          )}
          <GlassButton variant="primary" onClick={handleCreate}>Create</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
