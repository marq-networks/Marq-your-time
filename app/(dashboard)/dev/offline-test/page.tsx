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

  const [verifyData, setVerifyData] = useState<any>(null)
  const [cookieDebug, setCookieDebug] = useState<any>({})

  useEffect(() => {
    // Cookie debug
    const getCookie = (name: string) => document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)')?.[2]
    setCookieDebug({
      cookie_member_id: getCookie('current_user_id'),
      cookie_org_id: getCookie('current_org_id'),
      ls_member_id: localStorage.getItem('marq_member_id'),
      ls_org_id: localStorage.getItem('marq_org_id')
    })

    const mid = getCookie('current_user_id') || localStorage.getItem('marq_member_id')
    const oid = getCookie('current_org_id') || localStorage.getItem('marq_org_id')
    if (mid && oid) setIds({ memberId: mid, orgId: oid })
  }, [])

  const verifyMyDay = async () => {
    if (!ids.memberId || !ids.orgId) return
    try {
      const res = await fetch(`/api/time/today?member_id=${ids.memberId}&org_id=${ids.orgId}`)
      const j = await res.json()
      setVerifyData(j)
    } catch (e) {
      console.error(e)
    }
  }

  const runTest = async () => {
    setStatus('Running...')
    // device_id must be a valid UUID for the database
    const deviceId = uuid()
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
        started_at: new Date(now - 1000 * 60 * 60 * 1).toISOString(), // 1 hour ago
        ended_at: new Date(now - 1000 * 60 * 50).toISOString(), // 50 mins ago (10 min duration)
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
        timestamp: new Date(now - 1000 * 60 * 55).toISOString(), // 55 mins ago
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
        <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
          <div><strong>Cookie Member ID:</strong> {cookieDebug?.cookie_member_id || 'MISSING'}</div>
          <div><strong>Cookie Org ID:</strong> {cookieDebug?.cookie_org_id || 'MISSING'}</div>
          <div><strong>LS Member ID:</strong> {cookieDebug?.ls_member_id || 'MISSING'}</div>
          <div><strong>LS Org ID:</strong> {cookieDebug?.ls_org_id || 'MISSING'}</div>
        </div>
        <GlassCard title="Test Parameters">
          <div className="flex flex-col gap-2">
            <div>Member ID: {ids.memberId || <span className="text-red-500">Not found (Login first)</span>}</div>
            <div>Org ID: {ids.orgId || <span className="text-red-500">Not found (Login first or Select Org)</span>}</div>
          </div>
        </GlassCard>
        <div className="mt-4">
          <GlassButton onClick={runTest} disabled={!ids.memberId || !ids.orgId} style={{ backgroundColor: '#39FF14' }}>Run Perfect Sync Test</GlassButton>
          <GlassButton onClick={verifyMyDay} disabled={!ids.memberId || !ids.orgId} style={{ marginLeft: 10 }}>Verify Server Data</GlassButton>
        </div>
        {verifyData && (
          <div className="mt-4 p-4 bg-white/50 rounded">
            <h3 className="font-bold">Server Data (My Day)</h3>
            <div>Date: {new Date().toISOString().slice(0,10)}</div>
            <div>Employee: <strong>{verifyData.member_name}</strong></div>
            <div>Worked: {verifyData.today_hours} ({verifyData.sessions?.length || 0} sessions)</div>
            
            <div className="mt-2 text-xs">
              <div className="font-bold mb-1">Sessions:</div>
              {verifyData.sessions?.map((s: any) => (
                <div key={s.id} className="mb-2 p-2 border rounded bg-white/80">
                  <div><strong>ID:</strong> {s.id}</div>
                  <div><strong>Employee:</strong> {verifyData.member_name}</div>
                  <div><strong>Time:</strong> {new Date(s.startTime || s.start_time).toLocaleTimeString()} - {s.endTime ? new Date(s.endTime || s.end_time).toLocaleTimeString() : 'Running'}</div>
                  <div><strong>Source:</strong> {s.source}</div>
                  <div><strong>Status:</strong> {s.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto" style={{ maxHeight: 400 }}>{status}</pre>
        
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
