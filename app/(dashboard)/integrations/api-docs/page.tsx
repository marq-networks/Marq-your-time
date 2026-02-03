import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import { Book, Shield, Server, Webhook, Code, Terminal, Lock, Activity } from 'lucide-react'

export default function ApiDocsPage() {
  return (
    <AppShell title="Public API Docs">
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
            <Book size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">API Documentation</h1>
            <p className="text-slate-500 text-sm">Reference for the Marq Public API</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <GlassCard 
            title={
              <div className="flex items-center gap-2">
                <Lock className="text-emerald-600" size={20} />
                <span>Authentication</span>
              </div>
            }
            className="relative overflow-hidden"
          >
            <Shield size={120} className="text-emerald-900/5 absolute -bottom-4 -right-4 pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <p className="text-slate-600">Authenticate requests by including your API key in the Authorization header.</p>
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-sm border border-slate-800 shadow-inner flex items-center gap-3">
                <span className="text-pink-400">Authorization:</span>
                <span className="text-emerald-400">Bearer</span>
                <span className="text-slate-500">&lt;your_api_key&gt;</span>
              </div>
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <Shield size={14} className="inline mr-1 text-slate-400" />
                Keys are scoped per organization and require appropriate scopes for each endpoint.
              </p>
            </div>
          </GlassCard>

          <GlassCard 
            title={
              <div className="flex items-center gap-2">
                <Server className="text-indigo-600" size={20} />
                <span>Endpoints</span>
              </div>
            }
            className="relative overflow-hidden"
          >
            <Server size={120} className="text-indigo-900/5 absolute -bottom-4 -right-4 pointer-events-none" />
            <div className="relative z-10">
              <div className="space-y-3">
                {[
                  { method: 'GET', path: '/api/public/org', scope: 'read:org', desc: 'Get organization details' },
                  { method: 'GET', path: '/api/public/members', scope: 'read:members', desc: 'List members with filtering', query: 'cursor, limit, status, department_id' },
                  { method: 'GET', path: '/api/public/time/daily-summary', scope: 'read:time', desc: 'Get daily time summaries', query: 'date_start, date_end, member_ids[], department_ids[]' },
                  { method: 'GET', path: '/api/public/time/sessions', scope: 'read:time', desc: 'Get detailed time sessions', query: 'date_start, date_end, member_id' },
                  { method: 'GET', path: '/api/public/payroll/periods', scope: 'read:payroll', desc: 'List payroll periods', query: 'date_start, date_end' },
                  { method: 'GET', path: '/api/public/payroll/members', scope: 'read:payroll', desc: 'Get member payroll data', query: 'payroll_period_id, date_start, date_end' },
                  { method: 'GET', path: '/api/public/leave/requests', scope: 'read:leave', desc: 'List leave requests', query: 'date_start, date_end, status, member_id' },
                  { method: 'GET', path: '/api/public/billing/subscription', scope: 'read:billing', desc: 'Get subscription status' },
                ].map((ep, i) => (
                  <div key={i} className="group p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">{ep.method}</span>
                        <code className="text-sm text-slate-700 font-semibold">{ep.path}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-mono border border-slate-200">
                          scope: {ep.scope}
                        </span>
                      </div>
                    </div>
                    {ep.query && (
                      <div className="ml-1 pl-3 border-l-2 border-slate-200 mb-1">
                        <p className="text-xs text-slate-500 font-mono">Query: {ep.query}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard 
            title={
              <div className="flex items-center gap-2">
                <Webhook className="text-pink-600" size={20} />
                <span>Webhooks</span>
              </div>
            }
            className="relative overflow-hidden"
          >
            <Webhook size={120} className="text-pink-900/5 absolute -bottom-4 -right-4 pointer-events-none" />
            <div className="relative z-10 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Activity size={16} className="text-pink-500" />
                  Supported Events
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {['member.check_in', 'member.check_out', 'time.daily_closed', 'payroll.period_approved', 'leave.request_created', 'leave.request_approved', 'leave.request_rejected'].map(ev => (
                    <div key={ev} className="px-3 py-2 bg-slate-50 rounded-lg text-xs font-mono text-slate-600 border border-slate-100">
                      {ev}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Code size={16} className="text-indigo-500" />
                  Headers & Security
                </h3>
                <div className="space-y-2">
                  {[
                    { name: 'X-Marq-Webhook-Id', desc: 'Unique ID for the event delivery' },
                    { name: 'X-Marq-Event', desc: 'The event type (e.g. member.check_in)' },
                    { name: 'X-Marq-Signature', desc: 'HMAC-SHA256 signature of the request body' },
                  ].map(h => (
                    <div key={h.name} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                      <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold border border-slate-200 min-w-[180px]">{h.name}</code>
                      <span className="text-slate-500 text-xs">{h.desc}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <Shield size={14} className="inline mr-1 text-slate-400" />
                  Verify signatures using your webhook secret to ensure authenticity.
                </p>
              </div>
            </div>
          </GlassCard>

        </div>
      </div>
    </AppShell>
  )
}
