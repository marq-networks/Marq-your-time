'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import Toast from '@components/Toast'
import usePermission from '@lib/hooks/usePermission'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@lib/export-utils'
import { Shield, Users, Search, Plus, Trash2, Save, Building2, Check, X } from 'lucide-react'

type Org = { id: string, orgName: string }
type Role = { id: string, name: string, permissions: string[] }

const PERMS = [
  { key: 'manage_org', label: 'Manage Organization' },
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'manage_time', label: 'Manage Time' },
  { key: 'manage_screenshots', label: 'Manage Screenshots' },
  { key: 'manage_salary', label: 'Manage Salary' },
  { key: 'manage_fines', label: 'Manage Fines' },
  { key: 'manage_reports', label: 'Manage Reports' },
  { key: 'manage_settings', label: 'Manage Settings' }
]

export default function RolesPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([])
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [newRole, setNewRole] = useState<{name:string,permissions:string[]}>({ name:'', permissions: [] })
  const [isExporting, setIsExporting] = useState(false)
  const [search, setSearch] = useState('')

  const loadOrgs = async () => {
    try {
      const res = await fetch('/api/org/list', { cache: 'no-store' })
      const data = await res.json()
      setOrgs(data.items || [])
      if (!orgId && data.items?.length) setOrgId(data.items[0].id)
    } catch (e) {
      console.error(e)
    }
  }

  const loadRoles = async (oid: string) => {
    if (!oid) return
    try {
      const res = await fetch(`/api/role/list?orgId=${oid}`, { cache: 'no-store' })
      const data = await res.json()
      setRoles(data.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadRoles(orgId) }, [orgId])
  
  useEffect(() => {
    if (!search.trim()) {
      setFilteredRoles(roles)
    } else {
      setFilteredRoles(roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase())))
    }
  }, [roles, search])

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = roles
      const exportColumns: ExportColumn[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Permissions', accessor: (r) => r.permissions.join(', ') }
      ]

      const filename = `marq_roles_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'Roles & Permissions', filename)
      }
    } catch (e) {
      console.error(e)
      setToast({ m: 'Export failed', t: 'error' })
    } finally {
      setIsExporting(false)
    }
  }

  const togglePerm = (list: string[], p: string) => list.includes(p) ? list.filter(x=>x!==p) : [...list, p]

  const create = async () => {
    if (!newRole.name.trim()) return
    const res = await fetch('/api/role/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId, name: newRole.name, permissions: newRole.permissions }) })
    const data = await res.json()
    if (res.ok) { setCreateOpen(false); setNewRole({ name:'', permissions:[] }); setToast({ m:'Role created', t:'success' }); loadRoles(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const update = async (r: Role) => {
    const res = await fetch(`/api/role/${r.id}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: r.name, permissions: r.permissions }) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Role updated', t:'success' }); loadRoles(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const del = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return
    const res = await fetch(`/api/role/${id}/delete`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Role deleted', t:'success' }); loadRoles(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const canManageRoles = usePermission('manage_users').allowed && usePermission('manage_settings').allowed

  const columns = ['Name', 'Permissions', 'Actions']
  const rows = filteredRoles.map(r => [
    <div key={r.id} style={{minWidth: 150}}>
       <input 
        className="input-clean" 
        value={r.name} 
        onChange={e=>setRoles(roles.map(x=>x.id===r.id?{...x,name:e.target.value}:x))} 
        disabled={['Owner','Admin','Employee'].includes(r.name)} 
        style={{fontWeight: 600, color: 'var(--foreground)'}}
      />
    </div>,
    <div key={`${r.id}-perms`} className="grid grid-cols-2 gap-2" style={{maxWidth: 600}}>
      {PERMS.map(p => (
        <label key={p.key} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer">
          <input 
            type="checkbox" 
            checked={r.permissions.includes(p.key)} 
            onChange={()=>setRoles(roles.map(x=>x.id===r.id?{...x, permissions: togglePerm(x.permissions, p.key)}:x))}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">{p.label}</span>
        </label>
      ))}
    </div>,
    <div key={`${r.id}-actions`} className="flex gap-2">
      {canManageRoles && (
        <>
          <button className="btn-icon" onClick={()=>update(r)} title="Save Changes">
            <Save size={18} />
          </button>
          {!['Owner','Admin','Employee'].includes(r.name) && (
            <button className="btn-icon danger" onClick={()=>del(r.id)} title="Delete Role">
              <Trash2 size={18} />
            </button>
          )}
        </>
      )}
    </div>
  ])

  return (
    <AppShell title="Roles & Permissions">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center gap-2">
              <Shield className="text-indigo-500" /> Roles & Permissions
            </h1>
            <p className="text-gray-500 mt-1">Manage access levels and permissions for your organization members.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="glass-panel px-3 py-1.5 flex items-center gap-2" style={{borderRadius: 12}}>
               <Building2 size={16} className="text-gray-400" />
               <select 
                 value={orgId} 
                 onChange={(e)=>setOrgId(e.target.value)}
                 className="bg-transparent border-none outline-none text-sm font-medium min-w-[150px]"
               >
                 <option value="" disabled>Select Organization</option>
                 {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
               </select>
             </div>
             {canManageRoles && (
               <button 
                 onClick={()=>setCreateOpen(true)}
                 className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
               >
                 <Plus size={18} /> Add Role
               </button>
             )}
          </div>
        </div>

        {/* Content Card */}
        <GlassCard>
           <div className="flex items-center justify-between mb-6">
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Search roles..." 
                 value={search}
                 onChange={e=>setSearch(e.target.value)}
                 className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all shadow-sm"
               />
             </div>
             <ExportMenu onExport={handleExport} isExporting={isExporting} />
           </div>

           {roles.length > 0 ? (
             <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
               <GlassTable columns={columns} rows={rows} />
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-20 text-center">
               <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
                 <Shield size={32} className="text-indigo-500" />
               </div>
               <h3 className="text-lg font-semibold">No Roles Found</h3>
               <p className="text-gray-500 max-w-sm mt-1 mb-6">There are no roles defined for this organization yet.</p>
               {canManageRoles && (
                 <button 
                   onClick={()=>setCreateOpen(true)}
                   className="text-indigo-600 font-medium hover:underline"
                 >
                   Create your first role
                 </button>
               )}
             </div>
           )}
        </GlassCard>
      </div>

      <GlassModal open={createOpen} title="Create New Role" onClose={()=>setCreateOpen(false)} hideClose>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name</label>
            <input 
              autoFocus
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
              placeholder="e.g. Project Manager"
              value={newRole.name} 
              onChange={e=>setNewRole({...newRole, name: e.target.value})} 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Permissions</label>
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 max-h-60 overflow-y-auto custom-scrollbar">
              {PERMS.map(p => (
                <label key={p.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer select-none">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newRole.permissions.includes(p.key) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                    {newRole.permissions.includes(p.key) && <Check size={12} className="text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={newRole.permissions.includes(p.key)} 
                    onChange={()=>setNewRole({...newRole, permissions: togglePerm(newRole.permissions, p.key)})} 
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button 
              onClick={()=>setCreateOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={create}
              disabled={!newRole.name.trim()}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              Create Role
            </button>
          </div>
        </div>
      </GlassModal>

      <Toast message={toast.m} type={toast.t} />
      
      <style jsx global>{`
        .input-clean {
          background: transparent;
          border: 1px solid transparent;
          padding: 4px 8px;
          border-radius: 6px;
          width: 100%;
          transition: all 0.2s;
        }
        .input-clean:hover:not(:disabled) {
          background: rgba(100, 116, 139, 0.1);
        }
        .input-clean:focus {
          background: white;
          border-color: #e5e7eb;
          outline: none;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }
        .btn-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #6b7280;
          transition: all 0.2s;
        }
        .btn-icon:hover {
          background: rgba(100, 116, 139, 0.1);
          color: #4f46e5;
        }
        .btn-icon.danger:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(100, 116, 139, 0.2);
          border-radius: 20px;
        }
      `}</style>
    </AppShell>
  )
}
