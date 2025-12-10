'use client'
import { useEffect, useState } from 'react'
import Card from '@components/Card'
import Toast from '@components/Toast'
import { usePathname } from 'next/navigation'
import AppShell from '@components/ui/AppShell'

export default function InviteUserPage() {
  const path = usePathname()
  const parts = path.split('/')
  const id = parts[2] || ''
  const [form, setForm] = useState({ email:'', roleId:'', assignSeat:true })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [roles, setRoles] = useState<{ id: string, name: string }[]>([])

  useEffect(() => {
    const loadRoles = async () => {
      if (!id) return
      try {
        const res = await fetch(`/api/role/list?orgId=${id}`, { cache: 'no-store' })
        const data = await res.json()
        const items = Array.isArray(data.items) ? data.items : []
        setRoles(items)
        setForm(f => ({ ...f, roleId: f.roleId || items[0]?.id || '' }))
      } catch {}
    }
    loadRoles()
  }, [id])

  const submit = async () => {
    const role = roles.find(r => r.id === form.roleId)
    const res = await fetch(`/api/org/${id}/invite`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ invitedEmail: form.email, role: role?.name || '', assignSeat: form.assignSeat }) })
    const data = await res.json()
    if (res.ok) setToast({ m:'Invite sent', t:'success' })
    else setToast({ m:data.error || 'Error', t:'error' })
  }

  return (
    <AppShell title="Invite User">
    <Card title="Invite User">
      <div className="grid">
        <div>
          <div className="label">Email</div>
          <input className="input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
        </div>
        <div>
          <div className="label">Role</div>
          <select className="input" value={form.roleId} onChange={e=>setForm({...form, roleId: e.target.value})}>
            <option value="">Select role</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="row" style={{gap:8}}>
          <input type="checkbox" checked={form.assignSeat} onChange={e=>setForm({...form,assignSeat:e.target.checked})} />
          <div className="label">Assign Seat</div>
        </div>
        <div className="row" style={{justifyContent:'flex-end'}}>
          <button className="btn btn-primary" onClick={submit}>Send Invite</button>
        </div>
      </div>
      <Toast message={toast.m} type={toast.t} />
    </Card>
    </AppShell>
  )
}
