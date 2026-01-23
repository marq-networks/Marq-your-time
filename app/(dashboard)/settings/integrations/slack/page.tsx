
'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import { useRouter, useSearchParams } from 'next/navigation'

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

  if (loading) return <AppShell><div className="p-6 text-white">Loading Slack settings...</div></AppShell>

  return (
    <AppShell>
       <div className="max-w-4xl mx-auto space-y-6 p-6">
         <h1 className="text-2xl font-bold text-white mb-4">Slack Integration</h1>
         
         {!integration || !integration.is_enabled ? (
           <GlassCard>
             <div className="text-center py-8">
               <p className="text-gray-300 mb-4">Connect your workspace to receive real-time updates.</p>
               <GlassButton onClick={handleConnect} variant="primary">Connect Slack</GlassButton>
             </div>
           </GlassCard>
         ) : (
           <>
             <GlassCard title="Connection Status">
               <div className="flex justify-between items-center">
                 <div>
                   <p className="text-green-400 font-bold flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
                     Connected to {integration.slack_team_name}
                   </p>
                   <p className="text-xs text-gray-400 mt-1">Connected on {new Date(integration.connected_at).toLocaleDateString()}</p>
                 </div>
                 <div className="flex gap-2">
                    <GlassButton onClick={handleTest} variant="secondary">Test</GlassButton>
                    <GlassButton onClick={handleDisconnect} variant="danger">Disconnect</GlassButton>
                 </div>
               </div>
             </GlassCard>

             <GlassCard title="Configuration">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Default Channel</label>
                    <GlassSelect 
                      value={settings?.default_channel_id || ''}
                      onChange={(e) => setSettings({...settings, default_channel_id: e.target.value})}
                    >
                      <option value="">Select a channel...</option>
                      {channels.map(c => (
                        <option key={c.id} value={c.id}>#{c.name} {c.is_private ? '(private)' : ''}</option>
                      ))}
                    </GlassSelect>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Mentions (Optional)</label>
                    <p className="text-xs text-gray-500 mb-2">Comma separated Slack User IDs (e.g. U123456, U789012)</p>
                    <GlassInput 
                      value={settings?.mention_user_ids?.join(', ') || ''}
                      onChange={(e) => setSettings({
                        ...settings, 
                        mention_user_ids: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
                      })}
                      placeholder="U123456, U789012"
                    />
                  </div>
                </div>
             </GlassCard>

             <GlassCard title="Notification Events">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {Object.keys(settings?.notify_events || {}).map(key => (
                   <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                     <span className="capitalize text-sm text-gray-200">{key.replace(/_/g, ' ')}</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                         type="checkbox" 
                         className="sr-only peer"
                         checked={settings.notify_events[key]}
                         onChange={() => toggleEvent(key)}
                       />
                       <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#39ff14]"></div>
                     </label>
                   </div>
                 ))}
               </div>
             </GlassCard>

             <div className="flex justify-end">
               <GlassButton onClick={handleSave} variant="primary" disabled={saving}>
                 {saving ? 'Saving...' : 'Save Changes'}
               </GlassButton>
             </div>
           </>
         )}
       </div>
    </AppShell>
  )
}
