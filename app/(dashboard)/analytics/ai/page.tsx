'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@/components/ui/AppShell'
import GlassCard from '@/components/ui/GlassCard'
import GlassButton from '@/components/ui/GlassButton'
import GlassSelect from '@/components/ui/GlassSelect'
import { AiInsight } from '@/lib/ai/types'
import { 
  Sparkles, 
  BrainCircuit, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  Activity, 
  Calendar,
  Building2,
  Play,
  BarChart3,
  Search
} from 'lucide-react'

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
        if (role === 'super_admin') {
             const res = await fetch('/api/org/list', { cache:'no-store' })
             const d = await res.json()
             const match = (d.items||[]).find((o:any) => o.id === id)
             if (match) { setOrgName(match.orgName); return }
        }
        const res = await fetch('/api/orgs/my', { cache:'no-store' })
        if (res.ok) {
            const d = await res.json()
            const match = (d.items||[]).find((o:any) => o.id === id)
            if (match) { setOrgName(match.orgName); return }
        }
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

  // Group insights
  const analyticsInsights = insights.filter(i => i.insight_type === 'analytics')
  const anomalies = insights.filter(i => i.insight_type === 'anomaly_explanation' || i.insight_type === 'smart_alert')
  const predictions = insights.filter(i => i.insight_type === 'productivity_prediction')

  const isAdmin = ['admin', 'owner', 'super_admin'].includes(userRole)

  return (
    <AppShell title="AI Analytics">
      <div className="space-y-8">
        {/* Header Section */}
        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 p-32 bg-blue-500/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>
          
          <div className="relative flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                <BrainCircuit className="text-white" size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">AI Insights Engine</h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Building2 size={14} />
                  <span className="font-medium">{orgName}</span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto bg-white/50 p-2 rounded-xl border border-white/40 shadow-sm">
                <div className="w-full sm:w-48">
                    <GlassSelect value={period} onChange={(e:any)=>setPeriod(e.target.value)} className="w-full h-10">
                        <option value="daily">Daily Analysis</option>
                        <option value="weekly">Weekly Analysis</option>
                    </GlassSelect>
                </div>
                <GlassButton onClick={runAnalysis} variant="primary" className="h-10 whitespace-nowrap shadow-md shadow-indigo-200">
                  <Play size={16} className="mr-2" /> Run Analysis
                </GlassButton>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isAdmin && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <GlassCard className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                        <TrendingUp size={20} />
                      </div>
                      <span className="text-xs font-semibold bg-white/80 text-blue-700 px-2 py-1 rounded-full border border-blue-100">Trend</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                        {analyticsInsights[0]?.details?.avg_per_user ? `${Math.round(Number(analyticsInsights[0].details.avg_per_user)/60)}h` : '--'}
                    </div>
                    <div className="text-sm text-blue-700/70 font-medium">Avg. Hours / User</div>
                  </GlassCard>
                </motion.div>
            )}
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <GlassCard className={`h-full border-opacity-50 ${anomalies.length > 0 ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2.5 rounded-xl ${anomalies.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {anomalies.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                  </div>
                  <span className={`text-xs font-semibold bg-white/80 px-2 py-1 rounded-full border ${anomalies.length > 0 ? 'text-amber-700 border-amber-100' : 'text-emerald-700 border-emerald-100'}`}>
                    {isAdmin ? "Anomalies" : "Alerts"}
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                    {anomalies.length}
                </div>
                <div className={`text-sm font-medium ${anomalies.length > 0 ? 'text-amber-700/70' : 'text-emerald-700/70'}`}>
                    {anomalies.length > 0 ? 'Requires Attention' : 'All Systems Normal'}
                </div>
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <GlassCard className="h-full bg-gradient-to-br from-purple-50 to-fuchsia-50 border-purple-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <span className="text-xs font-semibold bg-white/80 text-purple-700 px-2 py-1 rounded-full border border-purple-100">Forecast</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                     {predictions.length > 0 ? 'Stable' : 'N/A'}
                </div>
                <div className="text-sm text-purple-700/70 font-medium">Productivity Prediction</div>
              </GlassCard>
            </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Analytics */}
            {isAdmin && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="text-indigo-500" size={20} />
                        <h3 className="text-lg font-semibold text-gray-800">Org-Wide Insights</h3>
                    </div>
                    
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                             [1,2].map(i => <div key={i} className="h-32 bg-white/50 animate-pulse rounded-2xl border border-white/40"></div>)
                        ) : analyticsInsights.length === 0 ? (
                            <GlassCard className="p-8 flex flex-col items-center text-center text-gray-500">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <Search size={20} />
                                </div>
                                <p>No analytics generated yet.</p>
                                <p className="text-xs opacity-60 mt-1">Run an analysis to see insights.</p>
                            </GlassCard>
                        ) : (
                            analyticsInsights.map((insight, idx) => (
                                <motion.div 
                                    key={insight.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                >
                                    <GlassCard className="hover:shadow-md transition-shadow group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                                {new Date(insight.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                                                <Zap size={10} /> {Math.round(insight.confidence * 100)}% Conf
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{insight.title}</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">{insight.summary}</p>
                                    </GlassCard>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Right Column: Anomalies & Alerts */}
            <div className="space-y-4 lg:col-span-1">
                 <div className="flex items-center gap-2 mb-2">
                    <Activity className={isAdmin ? "text-amber-500" : "text-emerald-500"} size={20} />
                    <h3 className="text-lg font-semibold text-gray-800">{isAdmin ? "Recent Anomalies & Alerts" : "My Insights & Coaching"}</h3>
                </div>

                <AnimatePresence mode="popLayout">
                    {loading ? (
                        [1,2].map(i => <div key={i} className="h-24 bg-white/50 animate-pulse rounded-2xl border border-white/40"></div>)
                    ) : anomalies.length === 0 ? (
                        <GlassCard className="p-8 flex flex-col items-center text-center text-gray-500">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 size={24} />
                            </div>
                            <p>No anomalies detected.</p>
                            <p className="text-xs opacity-60 mt-1">Everything is running smoothly.</p>
                        </GlassCard>
                    ) : (
                        anomalies.map((insight, idx) => (
                            <motion.div 
                                key={insight.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <GlassCard className={`hover:shadow-md transition-shadow border-l-4 ${
                                    insight.severity === 'critical' ? 'border-l-red-500' : 
                                    insight.severity === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'
                                }`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                            insight.severity === 'critical' ? 'bg-red-100 text-red-700' : 
                                            insight.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {insight.severity}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(insight.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                                    <p className="text-sm text-gray-600">{insight.summary}</p>
                                </GlassCard>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
      </div>
    </AppShell>
  )
}
