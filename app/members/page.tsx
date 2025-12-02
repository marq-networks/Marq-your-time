import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'

export default function MembersPage() {
  return (
    <AppShell title="Members">
      <GlassCard title="Members">
        <div className="subtitle">This module manages invitations via Organizations.</div>
        <div className="row" style={{marginTop:12,gap:12}}>
          <GlassButton variant="primary" href="/org/list">Go to Organizations</GlassButton>
        </div>
      </GlassCard>
    </AppShell>
  )
}
