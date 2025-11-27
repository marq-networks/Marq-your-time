'use client'
import { useState } from 'react'
import Card from '@components/Card'
import Toast from '@components/Toast'

export default function InvitePage({ params }: { params: { orgId: string, token: string } }) {
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [accepted, setAccepted] = useState(false)
  const [rejected, setRejected] = useState(false)

  const accept = async () => {
    const res = await fetch(`/api/invite/${params.token}/accept`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ grantPermissions: true }) })
    const data = await res.json()
    if (res.ok) { setAccepted(true); setToast({ m:'Invite accepted', t:'success' }) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const reject = async () => {
    const res = await fetch(`/api/invite/${params.token}/reject`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setRejected(true); setToast({ m:'Invite revoked', t:'success' }) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  return (
    <div className="grid">
      <Card title="Organization Invite">
        <div className="subtitle" style={{marginBottom:12}}>Org ID: {params.orgId}</div>
        {!accepted && !rejected && (
          <div className="row" style={{gap:12}}>
            <button className="btn btn-primary" onClick={accept}>Accept Permissions</button>
            <button className="btn" onClick={reject}>Reject</button>
          </div>
        )}
        {accepted && <div className="subtitle">Accepted. You may close this page.</div>}
        {rejected && <div className="subtitle">Invite revoked.</div>}
      </Card>
      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}

