import Card from '@components/Card'

export default function MembersPage() {
  return (
    <div className="grid">
      <Card title="Members">
        <div className="subtitle">This module manages invitations via Organizations.</div>
        <div className="row" style={{marginTop:12,gap:12}}>
          <a className="btn btn-primary" href="/org/list">Go to Organizations</a>
        </div>
      </Card>
    </div>
  )
}
