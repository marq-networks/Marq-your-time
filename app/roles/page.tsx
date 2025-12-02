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

type Org = { id: string, orgName: string }
type Role = { id: string, name: string, permissions: string[] }

const PERMS = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']

export default function RolesPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [newRole, setNewRole] = useState<{name:string,permissions:string[]}>({ name:'', permissions: [] })

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache: 'no-store' })
    const data = await res.json()
    setOrgs(data.items || [])
    if (!orgId && data.items?.length) setOrgId(data.items[0].id)
  }
  const loadRoles = async (oid: string) => {
    if (!oid) return
    const res = await fetch(`/api/role/list?orgId=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setRoles(data.items || [])
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadRoles(orgId) }, [orgId])

  const togglePerm = (list: string[], p: string) => list.includes(p) ? list.filter(x=>x!==p) : [...list, p]

  const create = async () => {
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
    const res = await fetch(`/api/role/${id}/delete`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Role deleted', t:'success' }); loadRoles(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const columns = ['Name','Permissions','Actions']
  const rows = roles.map(r => [
    <input className="input" value={r.name} onChange={e=>setRoles(roles.map(x=>x.id===r.id?{...x,name:e.target.value}:x))} disabled={['Owner','Admin','Employee'].includes(r.name)} />,
    <div className="grid grid-3">
      {PERMS.map(p => (
        <label key={p} className="row" style={{gap:8}}>
          <input type="checkbox" checked={r.permissions.includes(p)} onChange={()=>setRoles(roles.map(x=>x.id===r.id?{...x, permissions: togglePerm(x.permissions, p)}:x))} />
          <span className="label">{p}</span>
        </label>
      ))}
    </div>,
    <div className="row" style={{gap:8}}>
      {usePermission('manage_settings').allowed && <button className="btn" onClick={()=>update(r)}>Save</button>}
      {usePermission('manage_settings').allowed && <button className="btn" onClick={()=>del(r.id)}>Delete</button>}
    </div>
  ])

  const canManageRoles = usePermission('manage_users').allowed && usePermission('manage_settings').allowed
  return (
    <AppShell title="Roles & Permissions">
      <GlassCard title="Roles & Permissions" right={canManageRoles ? <GlassButton variant="primary" onClick={()=>setCreateOpen(true)}>Add Role</GlassButton> : undefined}>
        <div className="row" style={{marginBottom:12,gap:12}}>
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
        </div>
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={createOpen} title="Add Role" onClose={()=>setCreateOpen(false)}>
        <div>
          <div className="label">Name</div>
          <input className="input" value={newRole.name} onChange={e=>setNewRole({...newRole, name: e.target.value})} />
        </div>
        <div className="grid grid-3" style={{marginTop:8}}>
          {PERMS.map(p => (
            <label key={p} className="row" style={{gap:8}}>
              <input type="checkbox" checked={newRole.permissions.includes(p)} onChange={()=>setNewRole({...newRole, permissions: togglePerm(newRole.permissions, p)})} />
              <span className="label">{p}</span>
            </label>
          ))}
        </div>
        <div className="row" style={{marginTop:12}}>
          {canManageRoles && <GlassButton variant="primary" onClick={create}>Create</GlassButton>}
        </div>
      </GlassModal>

      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
