"use client"
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

type NotificationItem = { id: string, title: string, message: string, isRead: boolean, createdAt: number, meta?: any }

function getCookie(name: string) {
  const m = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number, right: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  const load = async () => {
    let url = '/api/notifications/list?limit=10&unread_only=true'
    try {
      const memberId = typeof document !== 'undefined' ? (getCookie('current_user_id') || '') : ''
      if (memberId) url += `&member_id=${encodeURIComponent(memberId)}`
    } catch {}
    const res = await fetch(url, { cache: 'no-store' })
    const d = await res.json()
    setItems(d.items || [])
  }

  const markAll = async () => {
    try {
      const memberId = typeof document !== 'undefined' ? (getCookie('current_user_id') || '') : ''
      if (!memberId) return
      await fetch('/api/notifications/mark-all-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId }) })
      setItems([])
    } catch {}
  }
  useEffect(()=>{ load() }, [])
  useEffect(()=>{ setMounted(true) }, [])
  useEffect(()=>{
    const handler = (e: MouseEvent) => {
      if (!open) return
      const t = e.target as Node
      const insideBell = !!(ref.current && t && ref.current.contains(t))
      const insidePanel = !!(panelRef.current && t && panelRef.current.contains(t))
      if (!insideBell && !insidePanel) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])
  useEffect(() => {
    const update = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const right = Math.max(8, Math.round(window.innerWidth - r.right))
      const top = Math.round(r.bottom + 8)
      setPos({ top, right })
    }
    if (open) {
      update()
      window.addEventListener('resize', update)
      window.addEventListener('scroll', update, { passive: true })
      return () => {
        window.removeEventListener('resize', update)
        window.removeEventListener('scroll', update)
      }
    }
  }, [open])

  const unread = items.filter(i=>!i.isRead).length

  return (
    <div ref={ref} className="relative z-50">
      <button 
        onClick={()=>setOpen(!open)} 
        className="relative p-1 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>
      {open && mounted && createPortal(
        <div 
          ref={panelRef} 
          className="fixed z-[100] bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-4 w-[380px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-200"
          style={{ right: pos?.right ?? 20, top: pos?.top ?? 72 }}
        >
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                Mark all read
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No new notifications</div>
            ) : (
              items.map(i => (
                <div key={i.id} className={`flex gap-3 p-3 rounded-xl transition-colors ${i.isRead ? 'bg-slate-50/50' : 'bg-blue-50/50 border border-blue-100'}`}>
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${i.isRead ? 'bg-slate-300' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{i.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{i.message}</p>
                    {i.meta?.url && (
                      <Link href={i.meta.url} className="mt-2 inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-700">
                        View details →
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
            <Link href="/notifications" className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
              View all history
            </Link>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
