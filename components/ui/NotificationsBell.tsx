"use client"
import { useEffect, useRef, useState } from 'react'
import GlassButton from './GlassButton'

type NotificationItem = { id: string, title: string, message: string, isRead: boolean, createdAt: number, meta?: any }

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => { const res = await fetch('/api/notifications/list?limit=10', { cache:'no-store' }); const d = await res.json(); setItems(d.items || []) }
  const markAll = async () => { await fetch('/api/notifications/mark-all-read', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ member_id: null }) }); setItems(items.map(i=>({ ...i, isRead: true })))}
  useEffect(()=>{ load() }, [])
  useEffect(()=>{
    const handler = (e: MouseEvent) => { if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const unread = items.filter(i=>!i.isRead).length

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button className="btn-glass" onClick={()=>setOpen(!open)} style={{ position:'relative' }}>
        <span style={{ fontSize:16 }}>🔔</span>
        {unread>0 && (
          <span style={{ position:'absolute', top:-6, right:-6, background:'#39FF14', color:'#000', border:'1px solid rgba(255,255,255,0.7)', borderRadius:999, padding:'2px 6px', fontSize:12 }}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="glass-panel" style={{ position:'absolute', right:0, marginTop:8, width:360, padding:12, borderRadius:'var(--radius-large)' }}>
          <div style={{ display:'grid', gap:8 }}>
            {(items || []).map(i=> (
              <div key={i.id} style={{ display:'grid', gridTemplateColumns:'10px 1fr auto', gap:8, alignItems:'center', background:'rgba(255,255,255,0.28)', padding:'8px 10px', borderRadius:18 }}>
                <div style={{ width:10, height:10, borderRadius:999, background: i.isRead ? 'transparent' : '#39FF14' }} />
                <div>
                  <div style={{ fontWeight:600 }}>{i.title}</div>
                  <div style={{ fontSize:12, color:'rgba(31,31,31,0.7)' }}>{i.message}</div>
                </div>
                {i.meta?.url && <GlassButton variant="primary" href={i.meta.url} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Open</GlassButton>}
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent:'space-between', marginTop:8 }}>
            <GlassButton variant="secondary" onClick={markAll}>Mark all read</GlassButton>
            <GlassButton variant="primary" href="/notifications" style={{ background:'#39FF14', borderColor:'#39FF14' }}>View all</GlassButton>
          </div>
        </div>
      )}
    </div>
  )
}
