import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'

export default function ApiDocsPage() {
  return (
    <AppShell title="Public API Docs">
      <div style={{background:'linear-gradient(to bottom right, #d9c7b2, #e8ddce, #c9b8a4)',borderRadius:'var(--radius-large)',padding:16}}>
        <GlassCard title="Authentication">
          <div>Header <code>Authorization: Bearer &lt;api_key&gt;</code>. Keys are scoped per org and require appropriate scopes.</div>
        </GlassCard>
        <div style={{height:12}} />
        <GlassCard title="Endpoints">
          <ul style={{display:'grid',gap:6}}>
            <li><code>GET /api/public/org</code> — Scope <code>read:org</code></li>
            <li><code>GET /api/public/members</code> — Scope <code>read:members</code>; Query <code>cursor, limit, status, department_id</code></li>
            <li><code>GET /api/public/time/daily-summary</code> — Scope <code>read:time</code>; Query <code>date_start, date_end, member_ids[], department_ids[]</code></li>
            <li><code>GET /api/public/time/sessions</code> — Scope <code>read:time</code>; Query <code>date_start, date_end, member_id</code></li>
            <li><code>GET /api/public/payroll/periods</code> — Scope <code>read:payroll</code>; Query <code>date_start, date_end</code></li>
            <li><code>GET /api/public/payroll/members</code> — Scope <code>read:payroll</code>; Query <code>payroll_period_id</code> or <code>date_start/date_end</code></li>
            <li><code>GET /api/public/leave/requests</code> — Scope <code>read:leave</code>; Query <code>date_start, date_end, status, member_id</code></li>
            <li><code>GET /api/public/billing/subscription</code> — Scope <code>read:billing</code></li>
          </ul>
        </GlassCard>
        <div style={{height:12}} />
        <GlassCard title="Webhooks">
          <div>Events: <code>member.check_in</code>, <code>member.check_out</code>, <code>time.daily_closed</code>, <code>payroll.period_approved</code>, <code>leave.request_created</code>, <code>leave.request_approved</code>, <code>leave.request_rejected</code>.</div>
          <div style={{marginTop:8}}>Headers: <code>X-Marq-Webhook-Id</code>, <code>X-Marq-Event</code>, <code>X-Marq-Signature</code> where signature is HMAC-SHA256 over the JSON body using the webhook secret.</div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
