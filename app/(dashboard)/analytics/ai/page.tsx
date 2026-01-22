'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/ui/AppShell'
import GlassCard from '@/components/ui/GlassCard'
import GlassTable from '@/components/ui/GlassTable'
import GlassButton from '@/components/ui/GlassButton'
import GlassSelect from '@/components/ui/GlassSelect'
import { AiInsight } from '@/lib/ai/types'

type Org = { id: string, orgName: string }

export default function AiAnalyticsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState('weekly')

  const loadOrgs = async () => {
    try {
        const res = await fetch('/api/org/list', { cache:'no-store' })
        const d = await res.json()
        setOrgs(d.items||[])
        if (!orgId && d.items?.length) setOrgId(d.items[0].id)
    } catch (e) {
        console.error(e)
    }
  }

  const loadInsights = async () => {
    if (!orgId) return
    setLoading(true)
    try {
        // Fetch org-wide analytics and high-level insights
        const res = await fetch(`/api/ai/list?orgId=${orgId}&orgWideOnly=true&limit=50`, { cache: 'no-store' })
        const d = await res.json()
        setInsights(d.items || [])
    } catch (e) {
        console.error(e)
    } finally {
        setLoading(false)
    }
  }

  const runAnalysis = async () => {
    if (!orgId) return
    if (!confirm('Run AI analysis now? This may take a moment.')) return
    try {
        const res = await fetch(`/api/ai/run-${period}?orgId=${orgId}`, { method: 'POST' })
        if (res.ok) {
            alert('Analysis started')
            setTimeout(loadInsights, 2000)
        } else {
            alert('Failed to start analysis')
        }
    } catch (e) {
        console.error(e)
    }
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if(orgId) loadInsights() }, [orgId])

  // Group insights by type
  const analyticsInsights = insights.filter(i => i.insight_type === 'analytics')
  const anomalies = insights.filter(i => i.insight_type === 'anomaly_explanation' || i.insight_type === 'smart_alert')
  const predictions = insights.filter(i => i.insight_type === 'productivity_prediction')

  const analyticsRows = analyticsInsights.map(i => [
    new Date(i.created_at).toLocaleDateString(),
    i.title,
    i.summary,
    <span key={i.id} className="badge" style={{background: '#39FF14', color: '#000'}}>{Math.round(i.confidence * 100)}% Conf</span>
  ])

  const anomalyRows = anomalies.map(i => [
    new Date(i.created_at).toLocaleDateString(),
    <span key={i.id} style={{color: i.severity === 'critical' ? '#ff4444' : (i.severity === 'warning' ? '#ffbb33' : '#fff')}}>{i.severity.toUpperCase()}</span>,
    i.title,
    i.summary
  ])

  return (
    <AppShell title="AI Analytics">
      <div className="flex flex-col gap-6">
        {/* Header Controls */}
        <div className="flex justify-between items-center">
            <div className="w-64">
                <div className="label">Organization</div>
                <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                    <option value="">Select org</option>
                    {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
            </div>
            <div className="flex gap-2">
                <GlassSelect value={period} onChange={(e:any)=>setPeriod(e.target.value)}>
                    <option value="daily">Run Daily Analysis</option>
                    <option value="weekly">Run Weekly Analysis</option>
                </GlassSelect>
                <GlassButton onClick={runAnalysis} variant="primary">Run Analysis</GlassButton>
            </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard title="Productivity Trend">
                <div className="text-2xl font-bold mb-2">
                    {analyticsInsights[0]?.details?.avg_per_user ? `${Math.round(Number(analyticsInsights[0].details.avg_per_user)/60)}h / user` : '--'}
                </div>
                <div className="text-sm opacity-70">
                    Based on latest weekly analysis
                </div>
            </GlassCard>
            <GlassCard title="Active Anomalies">
                <div className="text-2xl font-bold mb-2" style={{color: anomalies.length > 0 ? '#ffbb33' : '#39FF14'}}>
                    {anomalies.length}
                </div>
                <div className="text-sm opacity-70">
                    Requires attention
                </div>
            </GlassCard>
             <GlassCard title="Forecast">
                <div className="text-2xl font-bold mb-2">
                     {predictions.length > 0 ? 'Stable' : 'Insufficient Data'}
                </div>
                <div className="text-sm opacity-70">
                    Productivity prediction
                </div>
            </GlassCard>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard title="Org-Wide Insights">
                {analyticsRows.length > 0 ? (
                    <GlassTable 
                        columns={['Date', 'Title', 'Summary', 'Confidence']} 
                        rows={analyticsRows} 
                    />
                ) : (
                    <div className="p-4 text-center opacity-50">No analytics data generated yet.</div>
                )}
            </GlassCard>

            <GlassCard title="Recent Anomalies & Alerts">
                 {anomalyRows.length > 0 ? (
                    <GlassTable 
                        columns={['Date', 'Severity', 'Title', 'Summary']} 
                        rows={anomalyRows} 
                    />
                ) : (
                    <div className="p-4 text-center opacity-50">No anomalies detected.</div>
                )}
            </GlassCard>
        </div>
      </div>
    </AppShell>
  )
}
