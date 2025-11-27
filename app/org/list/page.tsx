import Card from '@components/Card'
import Table from '@components/Table'
import { headers } from 'next/headers'

async function fetchOrgs() {
  const h = headers()
  const host = h.get('host') || 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const res = await fetch(`${proto}://${host}/api/org/list`, { cache: 'no-store' })
  return res.json()
}

export default async function OrgList() {
  const data = await fetchOrgs()
  const columns = ['Logo','Name','Subscription','Seats Used/Total','Price/Login','Status','Actions']
  const rows = (data.items ?? []).map((o: any) => [
    <div key={o.id} style={{width:28,height:28,borderRadius:8,background:'#111',border:'1px solid var(--border)'}}></div>,
    o.orgName,
    o.subscriptionType,
    `${o.usedSeats}/${o.totalLicensedSeats}`,
    `$${o.pricePerLogin}`,
    <span className="badge">active</span>,
    <a className="btn btn-primary" href={`/org/${o.id}`}>Open</a>
  ])
  return (
    <Card title="Organization List">
      <Table columns={columns} rows={rows} />
    </Card>
  )
}
