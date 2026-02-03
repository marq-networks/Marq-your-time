'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import NotificationsBell from './NotificationsBell'
import GlassSelect from './GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'
import usePermission from '@lib/hooks/usePermission'

type OrgItem = { id: string, orgName: string }

function getCookie(name: string) {
  const m = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
}

export default function TopBar({ title, profileImage }: { title: string, profileImage?: string }) {
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [current, setCurrent] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [userImage, setUserImage] = useState<string>('')
  
  useEffect(() => { 
      (async()=>{ try { const res = await fetch('/api/security/mfa/status', { cache:'no-store' }); const d = await res.json(); const n = d.name || d.email || ''; setUserName(n) } catch {} })() 
      const userId = getCookie('current_user_id')
      if (userId) {
          fetch(`/api/user/${userId}`).then(r=>r.json()).then(d=>setUserImage(d.user?.profileImage || '')).catch(()=>{})
      }
  }, [])

  const finalUserImage = profileImage !== undefined ? profileImage : userImage

  return (
    <div className="flex items-center justify-between px-8 py-5 mb-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/60 sticky top-0 z-40 shadow-sm transition-all duration-300">
      {/* Page Title & Breadcrumbs */}
      <div className="flex items-center gap-4">
         <div className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-white/20 ring-4 ring-blue-500/5 group-hover:scale-105 transition-transform duration-300">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </div>
            <div>
               <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-1">{title}</h1>
               <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                 <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Session</span>
               </div>
            </div>
         </div>
      </div>

      {/* Right Actions: Search, Bell, Profile */}
      <div className="flex items-center gap-6">
        {/* Search Bar */}
        <div className="relative group w-80 transition-all duration-300 focus-within:w-96">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search tasks, tags, feed..." 
            className="w-full pl-12 pr-4 py-3 rounded-full bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 shadow-sm hover:shadow-md focus:shadow-lg transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-400">
            ⌘ K
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200/60 dark:bg-slate-700/60 mx-2"></div>

        {/* Notification Bell */}
        <div className="relative cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 p-2.5 rounded-full transition-all duration-200 group hover:scale-105 active:scale-95">
           <NotificationsBell />
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2">
           <div className="relative group cursor-pointer">
             <div className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 p-0.5 shadow-md ring-2 ring-slate-100 dark:ring-slate-700 group-hover:ring-blue-500/30 transition-all duration-300 group-hover:scale-105">
               <div 
                 className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-700 bg-cover bg-center flex items-center justify-center overflow-hidden"
                 style={{ backgroundImage: finalUserImage ? `url(${finalUserImage})` : 'none' }}
               >
                 {!finalUserImage && <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{userName.slice(0,2).toUpperCase()}</span>}
               </div>
             </div>
             <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full shadow-sm"></div>
           </div>
        </div>
      </div>
    </div>
  )
}
