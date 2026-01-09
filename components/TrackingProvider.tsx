'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    electronAPI?: {
      onActivityUpdate: (cb: (stats: any) => void) => void
      startTracking: () => void
      stopTracking: () => void
      getSources: () => Promise<any[]>
    }
  }
}

interface TrackingContextType {
  trackingSessionId: string | null
  startTracking: (sessionId: string, settings?: any) => Promise<void>
  stopTracking: () => Promise<void>
  isTracking: boolean
  localStats: { keys: number, clicks: number, mouse: number }
  idleDuration: number
}

const TrackingContext = createContext<TrackingContextType>({
  trackingSessionId: null,
  startTracking: async () => {},
  stopTracking: async () => {},
  isTracking: false,
  localStats: { keys: 0, clicks: 0, mouse: 0 },
  idleDuration: 0,
})

export const useTracking = () => useContext(TrackingContext)

export default function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null)
  const [activityTimer, setActivityTimer] = useState<any>(null)
  const [screenshotTimer, setScreenshotTimer] = useState<any>(null)
  const mouseCountRef = useRef(0)
  const clickCountRef = useRef(0)
  const keyCountRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [localStats, setLocalStats] = useState({ keys: 0, clicks: 0, mouse: 0 })
  const [idleDuration, setIdleDuration] = useState(0)

  // Cleanup on unmount (of the provider, i.e., app close/refresh)
  useEffect(() => {
    return () => {
      // We don't necessarily want to stop the API session on refresh, 
      // but we lose the stream, so we must stop client-side tracking.
      stopLocalTracking()
    }
  }, [])

  useEffect(() => {
    if (!trackingSessionId) {
      setLocalStats({ keys: 0, clicks: 0, mouse: 0 })
      return
    }
    const t = setInterval(() => {
      setLocalStats({
        keys: keyCountRef.current,
        clicks: clickCountRef.current,
        mouse: mouseCountRef.current
      })
      const timeSinceActivity = Date.now() - lastActivityRef.current
      if (timeSinceActivity > 10 * 60 * 1000) {
        setIdleDuration(timeSinceActivity)
      } else {
        setIdleDuration(0)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [trackingSessionId])


  const clearTimers = () => {
    if (activityTimer) { clearInterval(activityTimer); setActivityTimer(null) }
    if (screenshotTimer) { clearTimeout(screenshotTimer); setScreenshotTimer(null) }
  }

  const stopLocalTracking = () => {
    clearTimers()
    if (window.electronAPI) {
      window.electronAPI.stopTracking()
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach(tr => tr.stop()); streamRef.current = null }
    if (videoRef.current) {
      try { videoRef.current.pause() } catch {}
      if (videoRef.current.parentElement) videoRef.current.parentElement.removeChild(videoRef.current)
      videoRef.current = null
    }
    setTrackingSessionId(null)
  }

  const stopTracking = async () => {
    if (trackingSessionId) {
      try {
        await fetch('/api/tracking/stop', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ tracking_session_id: trackingSessionId }) 
        })
      } catch (e) {
        console.error('Failed to stop tracking session:', e)
      }
    }
    stopLocalTracking()
  }

  const ensureStream = async () => {
    if (streamRef.current) {
      // Check if tracks are still active
      if (streamRef.current.getTracks().some(t => t.readyState === 'live')) {
        return streamRef.current
      } else {
        streamRef.current = null
      }
    }
    
    try {
      let ms: MediaStream
      
      if (window.electronAPI && window.electronAPI.getSources) {
        const sources = await window.electronAPI.getSources()
        const source = sources[0] // Main screen usually
        if (!source) throw new Error('No electron screen source found')
        
        ms = await (navigator.mediaDevices as any).getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              minWidth: 1280,
              maxWidth: 4000,
              minHeight: 720,
              maxHeight: 4000
            }
          }
        })
      } else {
        ms = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false })
      }

      streamRef.current = ms
      
      // Handle user stopping the stream via browser UI
      ms.getVideoTracks()[0].onended = () => {
        console.log('[Tracking] Stream ended by user')
        stopTracking() // Or just stop local? User cut the stream.
      }

      if (!videoRef.current) {
        const v = document.createElement('video')
        v.style.position = 'fixed'
        v.style.opacity = '0'
        v.style.pointerEvents = 'none'
        v.style.width = '1px'
        v.style.height = '1px'
        v.muted = true
        v.playsInline = true as any
        v.autoplay = true as any
        v.srcObject = ms
        document.body.appendChild(v)
        videoRef.current = v
        try { await v.play() } catch {}
      } else {
        videoRef.current.srcObject = ms
        try { await videoRef.current.play() } catch {}
      }
      return ms
    } catch (e) {
      console.error('[Tracking] Permission denied or error:', e)
      return null
    }
  }

  const captureAndSendScreenshot = async (tid: string) => {
    console.log('[Screenshot] Attempting capture for session:', tid)
    const ms = await ensureStream()
    if (!ms) return

    const video = videoRef.current
    if (!video) return

    // Ensure video is playing
    if (video.paused) {
      try { await video.play() } catch {}
    }

    // Wait for dimensions if needed
    let attempts = 0
    while ((video.videoWidth === 0 || video.videoHeight === 0) && attempts < 10) {
      await new Promise(r => setTimeout(r, 200))
      attempts++
    }

    if ((video as any).requestVideoFrameCallback) {
      await new Promise(r => (video as any).requestVideoFrameCallback(() => r(null)))
    } else {
      await new Promise(r => setTimeout(r, 1000))
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png', 0.8)

    try {
      const res = await fetch('/api/activity/screenshot', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ tracking_session_id: tid, timestamp: Date.now(), image: dataUrl }) 
      })
      const json = await res.json()
      console.log('[Screenshot] Server response:', json)
    } catch (e) {
      console.error('[Screenshot] Upload failed:', e)
    }
  }

  const startActivityLoop = (tid: string) => {
    if (activityTimer) return
    
    const t = setInterval(async () => {
      const isFocused = document.hasFocus()
      // 10 minutes idle threshold
      const timeSinceActivity = Date.now() - lastActivityRef.current
      const isIdle = timeSinceActivity > 10 * 60 * 1000
      
      // If focused, we are active unless we've been idle for > 1 min.
      // If not focused (background), we use a stricter check:
      // We allow "external work" (e.g. Excel) but if there is NO interaction with the browser 
      // for 5 minutes, we assume the user is truly idle/away.
      const backgroundGracePeriod = 5 * 60 * 1000
      const isBackgroundActive = timeSinceActivity < backgroundGracePeriod
      const isActive = isFocused ? !isIdle : isBackgroundActive 
      
      const currentKeys = keyCountRef.current
      const currentMouse = mouseCountRef.current
      const currentClicks = clickCountRef.current
      
      // If no activity, skip batch (optional, but saves bandwidth)
      // But we need to send "heartbeat" if active? 
      // The logic below sends even if counts are 0, which is fine (to update is_active status).
      
      const ev = {
        timestamp: Date.now(),
        app_name: 'Web',
        window_title: document.title || 'MARQ',
        url: location.href,
        is_active: isActive,
        keyboard_activity_score: currentKeys,
        mouse_activity_score: currentMouse,
        click_count: currentClicks
      }
      
      // Optimistically reset refs
      keyCountRef.current = 0
      mouseCountRef.current = 0
      clickCountRef.current = 0
      
      try {
        const res = await fetch('/api/activity/batch', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ tracking_session_id: tid, events: [ev] }) 
        })
        if (!res.ok) {
           // If 403, session is invalid/ended. Stop tracking to prevent infinite loops.
           if (res.status === 403) {
             console.error('[Activity] Tracking session invalid (403), stopping.')
             stopLocalTracking()
             return
           }

           // If other error, restore counts so we don't lose data
           console.warn('[Activity] Batch upload failed, restoring counts', res.status)
           keyCountRef.current += currentKeys
           mouseCountRef.current += currentMouse
           clickCountRef.current += currentClicks
        }
      } catch (e) {
        console.error('[Activity] Failed to send batch:', e)
        // Restore counts on network error
        keyCountRef.current += currentKeys
        mouseCountRef.current += currentMouse
        clickCountRef.current += currentClicks
      }
    }, 60 * 1000)
    
    setActivityTimer(t)
  }

  // Effect to manage event listeners based on tracking state
  useEffect(() => {
    if (!trackingSessionId) return
    
    // Initialize last activity to now when tracking starts
    lastActivityRef.current = Date.now()

    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Use Electron global tracking if available
    if (window.electronAPI) {
      console.log('[Tracking] Using Electron global hooks')
      window.electronAPI.startTracking()
      window.electronAPI.onActivityUpdate((stats: any) => {
        keyCountRef.current += stats.keyboard
        mouseCountRef.current += stats.mouse
        clickCountRef.current += stats.clicks
        updateActivity()
      })
      return () => {
        window.electronAPI?.stopTracking()
      }
    }

    const onMouse = () => { 
      mouseCountRef.current += 1 
      updateActivity()
    }
    const onClick = () => {
      clickCountRef.current += 1
      updateActivity()
    }
    const onKey = () => { 
      keyCountRef.current += 1 
      updateActivity()
    }
    
    window.addEventListener('mousemove', onMouse, true)
    window.addEventListener('mousedown', onClick, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', updateActivity, true) // Also track scroll as activity

    return () => {
      window.removeEventListener('mousemove', onMouse, true)
      window.removeEventListener('mousedown', onClick, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', updateActivity, true)
    }
  }, [trackingSessionId])

  const startTracking = async (sessionId: string, settings?: any) => {
    if (trackingSessionId === sessionId) return // Already tracking this session
    
    // clear any existing timers to prevent zombie loops
    clearTimers()

    setTrackingSessionId(sessionId)
    startActivityLoop(sessionId)

    if (settings?.allowScreenshots) {
      // Initial screenshot
      await captureAndSendScreenshot(sessionId)
      
      // Random interval between 0 and 20 minutes
      const scheduleNext = () => {
        const delay = Math.floor(Math.random() * 20 * 60 * 1000)
        const t = setTimeout(async () => {
          await captureAndSendScreenshot(sessionId)
          scheduleNext()
        }, delay)
        setScreenshotTimer(t)
      }
      scheduleNext()
    }
  }

  useEffect(() => {
    const resume = async () => {
      try {
        const res = await fetch('/api/tracking/current')
        const data = await res.json()
        if (data.trackingAllowed && data.trackingSessionId && !data.consentRequired) {
            console.log('[Tracking] Resuming session:', data.trackingSessionId)
            startTracking(data.trackingSessionId, data.settings)
        }
      } catch (e) {
        console.error('[Tracking] Failed to resume:', e)
      }
    }
    resume()
  }, [])

  return (
    <TrackingContext.Provider value={{ trackingSessionId, startTracking, stopTracking, isTracking: !!trackingSessionId, localStats, idleDuration }}>
      {children}
    </TrackingContext.Provider>
  )
}
