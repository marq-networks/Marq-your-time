'use client'
import { useEffect, useState } from 'react'
import Card from '@components/Card'
import Toast from '@components/Toast'
import { usePathname } from 'next/navigation'

export default function InviteUserPage() {
  const path = usePathname()
  const parts = path.split('/')
  const id = parts[2] || ''
  const [form, setForm] = useState({ email:'', role:'member', assignSeat:true })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})

  const submit = async () => {
    const res = await fetch(`/api/org/${id}/invite`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ invitedEmail: form.email, role: form.role, assignSeat: form.assignSeat }) })
    const data = await res.json()
    if (res.ok) setToast({ m:'Invite sent', t:'success' })
    else setToast({ m:data.error || 'Error', t:'error' })
  }

  return (
    <Card title="Invite User">
      <div className="grid">
        <div>
          <div className="label">Email</div>
          <input className="input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
        </div>
        <div>
          <div className="label">Role</div>
          <select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
            <option value="member">member</option>
            <option value="admin">admin</option>
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
  )
}
