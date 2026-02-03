import { CalendarEvent } from '@lib/calendar-service'
import { useMemo } from 'react'

interface WeekViewProps {
  date: Date
  events: CalendarEvent[]
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function WeekView({ date, events }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const day = date.getDay()
    // Start Sunday
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay()) // Sunday
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [date])

  const getEventsForDay = (d: Date) => {
    // Use local date string to avoid timezone shifts
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    return events.filter(e => e.date === dateStr)
  }

  // Calculate position and height based on startTime/endTime
  // Assume startTime/endTime are minutes from midnight
  const getEventStyle = (e: CalendarEvent) => {
    let start = e.startTime
    let end = e.endTime

    // Prefer local time from ISO string
    if (e.startAt) {
        const d = new Date(e.startAt)
        if (!isNaN(d.getTime())) {
            start = d.getHours() * 60 + d.getMinutes()
        }
    }
    if (e.endAt) {
        const d = new Date(e.endAt)
        if (!isNaN(d.getTime())) {
            end = d.getHours() * 60 + d.getMinutes()
        }
    }

    if (start === undefined) return {} // All day or unknown time
    const finalEnd = end || (start + 60) // Default 1 hour if no end
    const duration = finalEnd - start
    
    return {
      top: `${(start / 1440) * 100}%`,
      height: `${Math.max((duration / 1440) * 100, 2)}%`, // Min height 2%
    }
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col overflow-auto bg-white/20 rounded-2xl border border-white/30 backdrop-blur-sm">
      <div className="flex border-b border-white/20 sticky top-0 bg-white/80 backdrop-blur-xl z-30 shadow-sm">
        <div className="w-16 flex-shrink-0 border-r border-white/20 bg-white/30"></div>
        {weekDays.map((d, i) => {
           const isToday = d.toDateString() === new Date().toDateString()
           return (
            <div key={i} className={`flex-1 text-center py-4 border-r border-white/20 last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
               <div className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-2 ${isToday ? 'text-primary' : 'text-[var(--color-text-secondary)]'}`}>
                 {d.toLocaleDateString('en-US', { weekday: 'short' })}
               </div>
               <div className={`
                 text-2xl font-bold w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all duration-300
                 ${isToday 
                   ? 'bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/30 scale-110' 
                   : 'text-[var(--color-text-secondary)]'}
               `}>
                 {d.getDate()}
               </div>
            </div>
           )
        })}
      </div>
      
      <div className="flex flex-1 relative">
        {/* Time Labels */}
        <div className="w-16 flex-shrink-0 border-r border-white/20 text-[10px] font-medium text-[var(--color-text-secondary)] bg-white/30 select-none">
          {HOURS.map(h => (
            <div key={h} className="h-24 border-b border-white/10 relative group">
              <span className="absolute -top-2 right-2 group-hover:text-[var(--color-text-primary)] transition-colors">
                {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Days Columns */}
        {weekDays.map((d, i) => {
            const dayEvents = getEventsForDay(d)
            const isToday = d.toDateString() === new Date().toDateString()
            
            return (
              <div key={i} className={`flex-1 border-r border-white/20 last:border-r-0 relative min-w-[140px] ${isToday ? 'bg-white/40' : 'bg-transparent'}`}>
                {/* Grid lines */}
                {HOURS.map(h => (
                   <div key={h} className="h-24 border-b border-white/10 group relative">
                     {/* Quarter-hour markers on hover/always subtle */}
                     <div className="absolute top-1/4 left-0 right-0 h-px bg-gray-500/[0.1] w-full" />
                     <div className="absolute top-2/4 left-0 right-0 h-px bg-gray-500/[0.15] w-full border-t border-dashed border-gray-500/20" />
                     <div className="absolute top-3/4 left-0 right-0 h-px bg-gray-500/[0.1] w-full" />
                   </div>
                ))}
                
                {/* Current Time Indicator (Horizontal Line across the week view for today) */}
                {isToday && (
                  <div 
                    className="absolute w-full border-t-2 border-red-500/70 z-20 pointer-events-none flex items-center shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    style={{ top: `${((new Date().getHours() * 60 + new Date().getMinutes()) / 1440) * 100}%` }}
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1 shadow-sm"></div>
                  </div>
                )}

                {/* Events */}
                {dayEvents.map((e, idx) => {
                   if (e.startTime === undefined) return (
                       <div key={idx} className="bg-white/80 border border-purple-200 text-purple-700 text-[10px] p-1.5 m-1 rounded-md shadow-sm backdrop-blur-sm font-medium truncate">
                         {e.title}
                       </div>
                   )
                   
                   const style = getEventStyle(e)
                   
                   return (
                     <div 
                       key={idx}
                       className="absolute inset-x-1 rounded-lg px-2 py-1.5 text-xs overflow-hidden border backdrop-blur-md shadow-sm hover:shadow-lg hover:z-50 transition-all duration-200 group cursor-pointer"
                       style={{
                         ...style,
                         backgroundColor: e.type === 'attendance' ? 'rgba(34, 197, 94, 0.15)' : e.type === 'break' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.6)',
                         borderColor: e.type === 'attendance' ? 'rgba(34, 197, 94, 0.3)' : e.type === 'break' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(100, 116, 139, 0.2)',
                         borderLeftWidth: '3px',
                         borderLeftColor: (e.type === 'attendance' && e.status === 'late') ? '#eab308' : e.type === 'attendance' ? '#22c55e' : e.type === 'break' ? '#f97316' : '#3b82f6',
                         color: 'var(--color-text-primary)'
                       }}
                     >
                       <div className="font-semibold text-[var(--color-text-primary)] truncate leading-tight">{e.title}</div>
                       <div className="text-[10px] text-[var(--color-text-secondary)] truncate mt-0.5 font-medium">
                         {formatTime(e.startTime)} - {formatTime(e.endTime || e.startTime + 60)}
                       </div>
                     </div>
                   )
                })}
              </div>
            )
        })}
      </div>
    </div>
  )
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const amp = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${amp}`
}
