'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import { CalendarEvent } from '@lib/calendar-service'
import { MonthView } from './_components/MonthView'
import { WeekView } from './_components/WeekView'
import { DayView } from './_components/DayView'
import { DayDetailModal } from './_components/DayDetailModal'

type ViewMode = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month')
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDayModal, setSelectedDayModal] = useState<Date | null>(null)
  
  // For Admin filtering
  const [users, setUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [role, setRole] = useState('')
  
  // Mock filter states
  const [department, setDepartment] = useState('')
  const [project, setProject] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    // Check role
    const r = (typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_role='))?.split('=')[1] || '') : '')
    setRole(r)
    const uid = (typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_user_id='))?.split('=')[1] || '') : '')
    if (!selectedUserId) setSelectedUserId(uid)

    if (r === 'admin' || r === 'super_admin' || r === 'owner') {
      // Load users
      loadUsers()
    }
  }, [])

  const loadUsers = async () => {
    // Basic fetch users, assuming current org
    const orgId = (typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '') : '')
    if (!orgId) return
    try {
        const res = await fetch(`/api/user/list?orgId=${orgId}`)
        const d = await res.json()
        if (d.items) setUsers(d.items)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (selectedUserId) fetchEvents()
  }, [date, view, selectedUserId])

  const fetchEvents = async () => {
    setLoading(true)
    let from = new Date(date)
    let to = new Date(date)

    if (view === 'month') {
      from = new Date(date.getFullYear(), date.getMonth(), 1)
      to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    } else if (view === 'week') {
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
      from = new Date(date.setDate(diff))
      to = new Date(date.setDate(diff + 6))
      // Reset date object for next calc
      from = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
      to = new Date(from.getTime() + 6 * 24 * 60 * 60 * 1000)
    } else {
      // Day
      from = date
      to = date
    }

    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)

    try {
      const endpoint = role === 'admin' || role === 'super_admin' || role === 'owner' 
        ? `/api/calendar/user/${selectedUserId}?from=${fromStr}&to=${toStr}`
        : `/api/calendar/my?from=${fromStr}&to=${toStr}`
      
      const res = await fetch(endpoint)
      const data = await res.json()
      if (data.events) {
        setEvents(data.events)
      } else {
        setEvents([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const navigate = (dir: 'prev' | 'next') => {
    const newDate = new Date(date)
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (dir === 'next' ? 1 : -1))
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (dir === 'next' ? 7 : -7))
    } else {
      newDate.setDate(newDate.getDate() + (dir === 'next' ? 1 : -1))
    }
    setDate(newDate)
  }

  return (
    <AppShell title="Calendar">
      <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
        {/* Controls Header */}
        <div className="flex flex-col gap-6 relative z-20">
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white/40 p-2.5 rounded-[24px] border border-white/40 backdrop-blur-xl shadow-lg shrink-0 transition-all hover:shadow-xl hover:bg-white/50">
            
            {/* Left: Navigation & Date - FORCED ROW */}
            <div className="flex flex-row items-center justify-between gap-2 md:gap-4 order-2 xl:order-1 w-full xl:w-auto">
              <GlassButton 
                onClick={() => navigate('prev')} 
                className="!p-2 !rounded-full !w-10 !h-10 flex items-center justify-center hover:bg-white hover:scale-110 active:scale-95 transition-all text-gray-600 hover:text-primary bg-white/60 border border-white/50 shadow-sm shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </GlassButton>
              
              <div className="flex flex-col items-center flex-1 min-w-0 px-2">
                <h2 className="text-lg md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-800 tracking-tight leading-none text-center truncate w-full">
                  {view === 'month' && date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  {view === 'day' && date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {view === 'week' && date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-2 justify-center mt-1">
                  {view === 'week' && (
                     <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80 whitespace-nowrap">
                       Week {Math.ceil(date.getDate() / 7)}
                     </span>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {date.getFullYear()}
                  </span>
                </div>
              </div>

              <GlassButton 
                onClick={() => navigate('next')} 
                className="!p-2 !rounded-full !w-10 !h-10 flex items-center justify-center hover:bg-white hover:scale-110 active:scale-95 transition-all text-gray-600 hover:text-primary bg-white/60 border border-white/50 shadow-sm shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </GlassButton>
            </div>

            {/* Right: View Switcher & Actions */}
            <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end order-1 xl:order-2">
               <button 
                onClick={() => setDate(new Date())}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 hover:bg-white hover:text-primary border border-white/60 hover:border-primary/30 rounded-full text-xs font-bold transition-all duration-200 shadow-sm text-gray-600 active:scale-95 uppercase tracking-wide"
              >
                <span className="w-2 h-2 rounded-full bg-primary/60"></span>
                Today
              </button>

              <div className="flex bg-gray-200/50 rounded-full p-1 border border-white/50 shadow-inner w-auto">
                {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setView(m)}
                    className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden ${
                      view === m 
                        ? 'bg-white text-primary shadow-md scale-100 ring-1 ring-black/5' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
                    }`}
                  >
                    {m}
                    {view === m && (
                      <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Admin Filters Row - Collapsible Glass Bar */}
          {(role === 'admin' || role === 'super_admin' || role === 'owner') && (
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/40 p-3 rounded-[24px] border border-white/40 backdrop-blur-xl shadow-sm transition-all hover:shadow-md hover:bg-white/50">
               <div className="px-4 py-1.5 text-xs font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-2 border-b md:border-b-0 md:border-r border-gray-400/20 w-full md:w-auto mb-2 md:mb-0">
                 <Filter className="w-3.5 h-3.5" /> Filters
               </div>
               
               <div className="flex flex-wrap gap-3 flex-1 w-full md:w-auto">
                 {/* User Select */}
                 <div className="relative flex-grow md:flex-grow-0 md:min-w-[200px]">
                   <GlassSelect 
                     value={selectedUserId}
                     onChange={(e: any) => setSelectedUserId(e.target.value)}
                     className="w-full !bg-white/60 !border-white/50 !rounded-xl !py-2 !text-sm pl-3 focus:!border-primary/50 text-[var(--color-text-primary)] shadow-sm hover:bg-white/80 transition-colors"
                   >
                     <option value="" className="text-black">All Users</option>
                     {users.map(u => (
                       <option key={u.id} value={u.id} className="text-black">
                         {u.firstName} {u.lastName}
                       </option>
                     ))}
                   </GlassSelect>
                 </div>

                 {/* Department Select */}
                 <div className="relative min-w-[160px]">
                   <GlassSelect 
                     value={department}
                     onChange={(e: any) => setDepartment(e.target.value)}
                     className="w-full !bg-white/60 !border-white/50 !rounded-xl !py-2 !text-sm pl-3 focus:!border-primary/50 text-[var(--color-text-primary)] shadow-sm hover:bg-white/80 transition-colors"
                   >
                     <option value="" className="text-black">Department</option>
                     <option value="tech" className="text-black">Technology</option>
                     <option value="hr" className="text-black">HR</option>
                   </GlassSelect>
                 </div>

                 {/* Project Select */}
                 <div className="relative min-w-[160px]">
                   <GlassSelect 
                     value={project}
                     onChange={(e: any) => setProject(e.target.value)}
                     className="w-full !bg-white/60 !border-white/50 !rounded-xl !py-2 !text-sm pl-3 focus:!border-primary/50 text-[var(--color-text-primary)] shadow-sm hover:bg-white/80 transition-colors"
                   >
                     <option value="" className="text-black">Project</option>
                     <option value="alpha" className="text-black">Alpha</option>
                     <option value="beta" className="text-black">Beta</option>
                   </GlassSelect>
                 </div>

                 {/* Status Select */}
                 <div className="relative min-w-[160px]">
                   <GlassSelect 
                     value={status}
                     onChange={(e: any) => setStatus(e.target.value)}
                     className="w-full !bg-white/60 !border-white/50 !rounded-xl !py-2 !text-sm pl-3 focus:!border-primary/50 text-[var(--color-text-primary)] shadow-sm hover:bg-white/80 transition-colors"
                   >
                     <option value="" className="text-black">Status</option>
                     <option value="active" className="text-black">Active</option>
                     <option value="inactive" className="text-black">Inactive</option>
                   </GlassSelect>
                 </div>
               </div>
            </div>
          )}
        </div>

        {/* Calendar View */}
        <div className="glass-panel border-0 bg-white/20 backdrop-blur-xl rounded-[28px] overflow-hidden shadow-xl relative flex-1 border-t border-white/40">
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-md transition-all duration-300">
              <div className="flex flex-col items-center gap-4 bg-white/60 p-8 rounded-2xl border border-white/40 shadow-2xl">
                <div className="relative">
                   <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)] tracking-wide">Syncing Calendar...</span>
              </div>
            </div>
          )}
          {!loading && view === 'month' && <MonthView date={date} events={events} onDateClick={(d) => { setSelectedDayModal(d) }} />}
          {!loading && view === 'week' && <WeekView date={date} events={events} />}
          {!loading && view === 'day' && <DayView date={date} events={events} isAdmin={role === 'admin' || role === 'super_admin' || role === 'owner'} />}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDayModal && (
        <DayDetailModal 
          open={!!selectedDayModal} 
          date={selectedDayModal} 
          events={events} 
          onClose={() => setSelectedDayModal(null)} 
        />
      )}
    </AppShell>
  )
}
