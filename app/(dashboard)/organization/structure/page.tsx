"use client"
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import { useEffect, useMemo, useState } from 'react'

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function OrgStructurePage() {
  const [orgId, setOrgId] = useState<string>('')
  const [departments, setDepartments] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [addingDept, setAddingDept] = useState(false)
  const [addingRole, setAddingRole] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleLevel, setNewRoleLevel] = useState<number>(1)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchJSON('/api/org/list')
        const id = r?.items?.[0]?.id || ''
        if (id) setOrgId(id)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    if (!orgId) return
    ;(async () => {
      const [depsRes, rolesRes, usersRes] = await Promise.all([
        fetchJSON(`/api/department/list?orgId=${orgId}`),
        fetchJSON(`/api/org/roles?org_id=${orgId}`),
        fetchJSON(`/api/user/list?orgId=${orgId}`),
      ])
      setDepartments(depsRes.items || depsRes.departments || [])
      setRoles(rolesRes.items || [])
      setMembers(usersRes.items || usersRes.users || [])
    })()
  }, [orgId])

  const deptTree = useMemo(() => {
    const byParent: Record<string, any[]> = {}
    for (const d of departments) {
      const pid = d.parentId || d.parent_id || ''
      const arr = byParent[pid] || []
      arr.push(d)
      byParent[pid] = arr
    }
    const walk = (pid: string, depth: number, out: any[]) => {
      const arr = byParent[pid] || []
      for (const d of arr) { out.push({ ...d, depth }); walk(d.id, depth+1, out) }
    }
    const out: any[] = []
    walk('', 0, out)
    walk(null as any, 0, out)
    return out
  }, [departments])

  const onAddDept = async () => {
    if (!newDeptName.trim() || !orgId) return
    setAddingDept(true)
    try {
      const res = await fetchJSON('/api/org/departments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, name: newDeptName }) })
      setDepartments([res.department, ...departments])
      setNewDeptName('')
    } catch (e) {}
    setAddingDept(false)
  }

  const onAddRole = async () => {
    if (!newRoleName.trim() || !orgId) return
    setAddingRole(true)
    try {
      const res = await fetchJSON('/api/org/roles', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, name: newRoleName, level: newRoleLevel }) })
      setRoles([res.role, ...roles])
      setNewRoleName('')
      setNewRoleLevel(1)
    } catch (e) {}
    setAddingRole(false)
  }

  const onAssign = async (memberId: string, patch: { departmentId?: string, managerId?: string, memberRoleId?: string }) => {
    try {
      const res = await fetchJSON(`/api/members/${memberId}/structure`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, ...patch }) })
      setMembers(members.map(m => m.id === memberId ? res.user : m))
    } catch (e) { console.error(e) }
  }

  const deptColumns = ['Department','Actions']
  const deptRows = deptTree.map(d => [
    `${'—'.repeat(d.depth)} ${d.name}`,
    (
      <div className="row" style={{ gap: 8 }}>
        <GlassButton onClick={async()=>{
          const nn = prompt('Rename department', d.name)
          if (!nn) return
          const r = await fetchJSON(`/api/org/departments/${d.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: nn }) })
          setDepartments(departments.map(x => x.id === d.id ? r.department : x))
        }}>Rename</GlassButton>
        <GlassButton variant="secondary" onClick={async()=>{
          const used = members.some(m => (m.departmentId || m.department_id) === d.id)
          if (used) { alert('Cannot delete: department has members'); return }
          await fetchJSON(`/api/org/departments/${d.id}`, { method:'DELETE' })
          setDepartments(departments.filter(x => x.id !== d.id))
        }}>Delete</GlassButton>
      </div>
    )
  ])

  const roleColumns = ['Role','Level','Actions']
  const roleRows = roles.map(r => [
    r.name,
    String(r.level||0),
    (
      <div className="row" style={{ gap: 8 }}>
        <GlassButton onClick={async()=>{
          const nn = prompt('Rename role', r.name)
          if (!nn) return
          const rr = await fetchJSON(`/api/org/roles/${r.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: nn }) })
          setRoles(roles.map(x => x.id === r.id ? rr.role : x))
        }}>Rename</GlassButton>
        <GlassButton onClick={async()=>{
          const lv = Number(prompt('Set level', String(r.level||0))||String(r.level||0))
          const rr = await fetchJSON(`/api/org/roles/${r.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ level: lv }) })
          setRoles(roles.map(x => x.id === r.id ? rr.role : x))
        }}>Level</GlassButton>
        <GlassButton variant="secondary" onClick={async()=>{
          await fetchJSON(`/api/org/roles/${r.id}`, { method:'DELETE' })
          setRoles(roles.filter(x => x.id !== r.id))
        }}>Delete</GlassButton>
      </div>
    )
  ])

  const memberColumns = ['Member','Department','Role','Manager']
  const memberRows = members.map(m => {
    return [
      `${m.firstName||m.first_name} ${m.lastName||m.last_name}`.trim(),
      (
        <GlassSelect value={m.departmentId||''} onChange={(e:any)=> onAssign(m.id, { departmentId: e.target.value || undefined })}>
          <option value="">—</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </GlassSelect>
      ),
      (
        <GlassSelect value={m.memberRoleId||''} onChange={(e:any)=> onAssign(m.id, { memberRoleId: e.target.value || undefined })}>
          <option value="">—</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name} (L{String(r.level||0)})</option>)}
        </GlassSelect>
      ),
      (
        <GlassSelect value={m.managerId||''} onChange={(e:any)=> onAssign(m.id, { managerId: e.target.value || undefined })}>
          <option value="">—</option>
          {members.map(u => <option key={u.id} value={u.id}>{`${u.firstName||u.first_name} ${u.lastName||u.last_name}`.trim()}</option>)}
        </GlassSelect>
      )
    ]
  })

  return (
    <AppShell title="Organization Structure">
      <div className="col" style={{ gap: 16 }}>
        <GlassCard title="Department Tree" right={<div className="row" style={{ gap: 8 }}>
          <input value={newDeptName} onChange={e=>setNewDeptName(e.target.value)} placeholder="New department" />
          <GlassButton variant="primary" onClick={()=>{ if (!addingDept) onAddDept() }}>Add Dept</GlassButton>
        </div>}>
          <GlassTable columns={deptColumns} rows={deptRows} />
        </GlassCard>

        <GlassCard title="Roles" right={<div className="row" style={{ gap: 8 }}>
          <input value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} placeholder="New role" />
          <input type="number" value={newRoleLevel} onChange={e=>setNewRoleLevel(Number(e.target.value||1))} placeholder="Level" style={{ width: 80 }} />
          <GlassButton variant="primary" onClick={()=>{ if (!addingRole) onAddRole() }}>Add Role</GlassButton>
        </div>}>
          <GlassTable columns={roleColumns} rows={roleRows} />
        </GlassCard>

        <GlassCard title="Team Mapping">
          <GlassTable columns={memberColumns} rows={memberRows} />
        </GlassCard>
      </div>
    </AppShell>
  )
}
