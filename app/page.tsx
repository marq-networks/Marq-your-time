import Card from '@components/Card'

export default function Page() {
  return (
    <div className="grid grid-3">
      <Card title="Quick Actions">
        <div className="row" style={{gap:12}}>
          <a className="btn btn-primary" href="/org/create">Create Organization</a>
          <a className="btn" href="/org/list">View Organizations</a>
        </div>
      </Card>
      <Card title="Subscriptions">
        <div className="subtitle">Managed via MARQ module</div>
      </Card>
      <Card title="Seat Usage">
        <div className="subtitle">Track usage across orgs</div>
      </Card>
    </div>
  )
}
