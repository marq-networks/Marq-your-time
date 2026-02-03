'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import { useRouter, useSearchParams } from 'next/navigation'
import { Hash, Bell, Users, CheckCircle, AlertCircle, Link, Power, Save, Send } from 'lucide-react'

export default function SlackSettingsPage() {
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)
  const [integration, setIntegration] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [channels, setChannels] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const oid = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || ''
    setOrgId(oid)
  }, [])

  useEffect(() => {
    if (orgId) {
      loadData()
      if (searchParams.get('connected')) {
        router.replace('/settings/integrations/slack')
      }
    }
  }, [orgId])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/slack/settings?orgId=${orgId}`)
      const data = await res.json()
      if (data.integration) {
        setIntegration(data.integration)
        setSettings(data.settings)
        if (data.integration.is_enabled) {
          fetchChannels()
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchChannels = async () => {
    try {
      const res = await fetch(`/api/integrations/slack/channels?orgId=${orgId}`)
      const data = await res.json()
      if (data.channels) setChannels(data.channels)
    } catch (e) { console.error(e) }
  }

  const handleConnect = () => {
    window.location.href = `/api/integrations/slack/install?orgId=${orgId}`
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return
    try {
      await fetch('/api/integrations/slack/disconnect', {
        method: 'POST',
        body: JSON.stringify({ orgId })
      })
      setIntegration(null)
      setSettings(null)
    } catch (e) { console.error(e) }
  }

  const handleTest = async () => {
    try {
      const res = await fetch('/api/integrations/slack/test', {
        method: 'POST',
        body: JSON.stringify({ orgId })
      })
      const data = await res.json()
      if (data.sent) {
        alert('Test notification sent!')
      } else {
        alert('Failed to send: ' + (data.reason || 'Unknown error'))
      }
    } catch (e) {
      console.error(e)
      alert('Error sending test notification')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Find channel name
      const channel = channels.find(c => c.id === settings.default_channel_id)
      
      const payload = {
        orgId,
        ...settings,
        default_channel_name: channel ? channel.name : settings.default_channel_name
      }
      
      await fetch('/api/integrations/slack/settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      alert('Settings saved')
    } catch (e) {
      console.error(e)
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const toggleEvent = (key: string) => {
    setSettings({
      ...settings,
      notify_events: {
        ...settings.notify_events,
        [key]: !settings.notify_events[key]
      }
    })
  }

  if (loading) return (
    <AppShell title="Slack Settings">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p>Loading Slack settings...</p>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell title="Slack Settings">
       <div className="space-y-6">
         
         {/* Header */}
         <div className="flex items-center gap-3">
           <div className="p-2 bg-[#4A154B]/10 rounded-lg text-[#4A154B] border border-[#4A154B]/20">
             <Hash size={24} />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-800">Slack Integration</h1>
             <p className="text-slate-500 text-sm">Connect your workspace to receive real-time updates</p>
           </div>
         </div>
         
         {!integration || !integration.is_enabled ? (
           <GlassCard className="relative overflow-hidden">
             <Hash size={120} className="text-[#4A154B]/5 absolute -bottom-4 -right-4 pointer-events-none" />
             <div className="flex flex-col items-center justify-center py-12 relative z-10">
               <div className="bg-slate-50 p-4 rounded-full mb-6">
                 <Hash size={48} className="text-[#4A154B]" />
               </div>
               <h2 className="text-xl font-semibold text-slate-800 mb-2">Connect to Slack</h2>
               <p className="text-slate-500 mb-8 max-w-md text-center">
                 Receive notifications for check-ins, leave requests, and payroll updates directly in your Slack channels.
               </p>
               <GlassButton onClick={handleConnect} className="bg-[#4A154B] hover:bg-[#611f69] text-white border-none px-8 py-2 h-auto text-lg">
                 <img src="https://cdn.icon-icons.com/icons2/2699/PNG/512/slack_logo_icon_169766.png" className="w-5 h-5 mr-2 brightness-0 invert" alt="" />
                 Connect Slack Workspace
               </GlassButton>
             </div>
           </GlassCard>
         ) : (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-2 space-y-6">
               <GlassCard 
                 title={
                   <div className="flex items-center gap-2">
                     <Link className="text-emerald-600" size={20} />
                     <span>Connection Status</span>
                   </div>
                 }
                 className="relative overflow-hidden"
               >
                 <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 border border-emerald-100">
                       <CheckCircle size={24} />
                     </div>
                     <div>
                       <p className="font-bold text-slate-800 flex items-center gap-2">
                         Connected to {integration.slack_team_name}
                       </p>
                       <p className="text-xs text-slate-500 mt-0.5">
                         Connected on {new Date(integration.connected_at).toLocaleDateString()}
                       </p>
                     </div>
                   </div>
                   <div className="flex gap-2">
                      <GlassButton onClick={handleTest} variant="secondary" className="text-indigo-600">
                        <Send size={14} className="mr-2" /> Test
                      </GlassButton>
                      <GlassButton onClick={handleDisconnect} variant="secondary" className="text-rose-600 hover:bg-rose-50 border-rose-200">
                        <Power size={14} className="mr-2" /> Disconnect
                      </GlassButton>
                   </div>
                 </div>
               </GlassCard>

               <GlassCard 
                 title={
                   <div className="flex items-center gap-2">
                     <Bell className="text-indigo-600" size={20} />
                     <span>Notification Events</span>
                   </div>
                 }
                 className="relative overflow-hidden"
               >
                 <Bell size={120} className="text-indigo-900/5 absolute -bottom-4 -right-4 pointer-events-none" />
                 <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                   {Object.keys(settings?.notify_events || {}).map(key => (
                     <label key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer group">
                       <span className="capitalize text-sm font-medium text-slate-700">{key.replace(/_/g, ' ')}</span>
                       <div className="relative inline-flex items-center cursor-pointer">
                         <input 
                           type="checkbox" 
                           className="sr-only peer"
                           checked={settings.notify_events[key]}
                           onChange={() => toggleEvent(key)}
                         />
                         <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                       </div>
                     </label>
                   ))}
                 </div>
               </GlassCard>
             </div>

             <div className="space-y-6">
               <GlassCard 
                  title={
                    <div className="flex items-center gap-2">
                      <Hash className="text-slate-600" size={20} />
                      <span>Configuration</span>
                    </div>
                  }
                  className="h-full relative overflow-hidden"
               >
                  <div className="space-y-6 relative z-10">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Default Channel</label>
                      <GlassSelect 
                        value={settings?.default_channel_id || ''}
                        onChange={(e: any) => setSettings({...settings, default_channel_id: e.target.value})}
                      >
                        <option value="">Select a channel...</option>
                        {channels.map(c => (
                          <option key={c.id} value={c.id}>#{c.name} {c.is_private ? '(private)' : ''}</option>
                        ))}
                      </GlassSelect>
                      <p className="text-xs text-slate-400 mt-1.5">
                        <AlertCircle size={12} className="inline mr-1" />
                        Notifications will be sent here by default
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mentions (Optional)</label>
                      <GlassInput 
                        value={settings?.mention_user_ids?.join(', ') || ''}
                        onChange={(e: any) => setSettings({
                          ...settings, 
                          mention_user_ids: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
                        })}
                        placeholder="U123456, U789012"
                      />
                      <p className="text-xs text-slate-400 mt-1.5">
                        Comma separated Slack User IDs to mention
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <GlassButton onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-none" disabled={saving}>
                        {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Save size={16} className="mr-2" />}
                        {saving ? 'Saving...' : 'Save Changes'}
                      </GlassButton>
                    </div>
                  </div>
               </GlassCard>
             </div>
           </div>
         )}
       </div>
    </AppShell>
  )
}
