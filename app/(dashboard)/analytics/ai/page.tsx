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
  const [orgId, setOrgId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState('weekly')
  const [orgName, setOrgName] = useState('Loading...')
  
  // Get org from cookie or list
  useEffect(() => {
    if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').map(c => c.trim())
        const cOrgId = cookies.find(c => c.startsWith('current_org_id='))?.split('=')[1]
        const cRole = cookies.find(c => c.startsWith('current_role='))?.split('=')[1]
        
        if (cOrgId) {
            setOrgId(cOrgId)
            loadOrgName(cOrgId, cRole)
        }
        if (cRole) setUserRole(cRole.toLowerCase())
    }
  }, [])

  const loadOrgName = async (id: string, role?: string) => {
    try {
        // First try to find in org list if super_admin
        if (role === 'super_admin') {
             const res = await fetch('/api/org/list', { cache:'no-store' })
             const d = await res.json()
             const match = (d.items||[]).find((o:any) => o.id === id)
             if (match) {
                 setOrgName(match.orgName)
                 return
             }
        }
        
        // Otherwise fetch my orgs or specific details
        // Trying /api/orgs/my first which is standard for admins
        const res = await fetch('/api/orgs/my', { cache:'no-store' })
        if (res.ok) {
            const d = await res.json()
            const match = (d.items||[]).find((o:any) => o.id === id)
            if (match) {
                setOrgName(match.orgName)
                return
            }
        }

        // Fallback: If still not found, maybe just display "Organization" or try another endpoint if exists
        setOrgName('Organization') 
    } catch (e) {
        console.error(e)
        setOrgName('Organization')
    }
  }

  const loadInsights = async () => {
    if (!orgId) return
    setLoading(true)
    try {
        // Fetch all insights for the org (analytics, anomalies, predictions)
        const res = await fetch(`/api/ai/list?orgId=${orgId}&limit=100`, { cache: 'no-store' })
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

  const isAdmin = ['admin', 'owner', 'super_admin'].includes(userRole)

  return (
    <AppShell title="AI Analytics">
      <div className="flex flex-col gap-6">
        {/* Header Controls */}
        <div className="flex justify-between items-center">
            <div className="w-64">
                <div className="label">Organization</div>
                <div className="text-xl font-bold">{orgName}</div>
            </div>
            {isAdmin && (
                <div className="flex gap-2">
                    <GlassSelect value={period} onChange={(e:any)=>setPeriod(e.target.value)}>
                        <option value="daily">Run Daily Analysis</option>
                        <option value="weekly">Run Weekly Analysis</option>
                    </GlassSelect>
                    <GlassButton onClick={runAnalysis} variant="primary">Run Analysis</GlassButton>
                </div>
            )}
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isAdmin && (
                <GlassCard title="Productivity Trend">
                    <div className="text-2xl font-bold mb-2">
                        {analyticsInsights[0]?.details?.avg_per_user ? `${Math.round(Number(analyticsInsights[0].details.avg_per_user)/60)}h / user` : '--'}
                    </div>
                    <div className="text-sm opacity-70">
                        Based on latest weekly analysis
                    </div>
                </GlassCard>
            )}
            <GlassCard title={isAdmin ? "Active Anomalies" : "My Active Alerts"}>
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
        <div className="flex flex-col gap-6">
            {isAdmin && (
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
            )}

            <GlassCard title={isAdmin ? "Recent Anomalies & Alerts" : "My Insights & Coaching"}>
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
