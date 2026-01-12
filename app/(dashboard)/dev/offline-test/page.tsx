'use client'
import { useState, useEffect } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function OfflineTestPage() {
  const [status, setStatus] = useState('')
  const [ids, setIds] = useState({ memberId: '', orgId: '' })

  useEffect(() => {
    const getCookie = (name: string) => {
      const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
      return v ? v[2] : null;
    }
    setIds({
      memberId: getCookie('current_user_id') || '',
      orgId: getCookie('current_org_id') || ''
    })
  }, [])

  const runTest = async () => {
    setStatus('Running...')
    const deviceId = 'manual-browser-' + uuid().slice(0,8)
    const localBatchId = uuid()
    const now = Date.now()
    const start = now - 1000 * 60 * 10 // 10 mins ago
    const end = now
    
    // 1. Time Session Batch
    const timePayload = {
      local_batch_id: localBatchId + '-time',
      batch_type: 'time',
      device_id: deviceId,
      member_id: ids.memberId,
      org_id: ids.orgId,
      items: [{
        local_session_id: uuid(),
        started_at: new Date(start).toISOString(),
        ended_at: new Date(end).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }]
    }

    // 2. Activity Batch
    const activityPayload = {
      local_batch_id: localBatchId + '-act',
      batch_type: 'activity',
      device_id: deviceId,
      member_id: ids.memberId,
      org_id: ids.orgId,
      items: [{
        timestamp: new Date(start + 1000 * 60 * 5).toISOString(), // 5 mins in
        app_name: 'Perfect Sync Test',
        window_title: 'Working Hard',
        is_active: true,
        keyboard_activity_score: 50,
        mouse_activity_score: 50,
        click_count: 10
      }]
    }

    try {
      // Send Time Session first
      setStatus('Sending Time Session...')
      const res1 = await fetch('/api/agent/offline/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
        body: JSON.stringify(timePayload)
      })
      const j1 = await res1.json()
      
      // Send Activity
      setStatus('Sending Activity...')
      const res2 = await fetch('/api/agent/offline/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
        body: JSON.stringify(activityPayload)
      })
      const j2 = await res2.json()

      setStatus('Done! \nTime Status: ' + JSON.stringify(j1) + '\nActivity Status: ' + JSON.stringify(j2))
    } catch (e: any) {
      setStatus('Error: ' + e.message)
    }
  }

  return (
    <AppShell title="Offline Sync Test">
      <div className="p-6 min-h-screen bg-gradient-to-br from-[#d9c7b2] via-[#e8ddce] to-[#c9b8a4]">
        <GlassCard title="Test Parameters">
          <div className="flex flex-col gap-2">
            <div>Member ID: {ids.memberId || 'Not found (Login first)'}</div>
            <div>Org ID: {ids.orgId || 'Not found (Login first)'}</div>
          </div>
        </GlassCard>
        <div className="mt-4">
          <GlassButton onClick={runTest} disabled={!ids.memberId} style={{ backgroundColor: '#39FF14' }}>Run Perfect Sync Test</GlassButton>
        </div>
        <pre className="mt-4 p-4 bg-black/10 rounded overflow-auto" style={{ maxHeight: 400 }}>{status}</pre>
        
        <div className="mt-4 text-sm text-gray-600">
          After running, go to <a href="/devices/offline-sync" className="underline text-blue-600">Offline Sync Dashboard</a> to verify.
          You should see 2 new batches:
          <ul className="list-disc ml-4">
            <li>Type: time (Applied, No Conflicts)</li>
            <li>Type: activity (Applied, No Conflicts)</li>
          </ul>
        </div>
      </div>
    </AppShell>
  )
}
