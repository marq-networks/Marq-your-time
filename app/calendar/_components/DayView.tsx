import { CalendarEvent } from '@lib/calendar-service'

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  isAdmin?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function DayView({ date, events, isAdmin = false }: DayViewProps) {
  // Filter for this day
  // Use local date string to avoid timezone shifts
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`

  const dayEvents = events.filter(e => e.date === dateStr)

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

    if (start === undefined) return {} 
    const finalEnd = end || (start + 60)
    const duration = finalEnd - start
    
    return {
      top: `${(start / 1440) * 100}%`,
      height: `${Math.max((duration / 1440) * 100, 2)}%`,
    }
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col overflow-auto bg-white/20 rounded-2xl border border-white/30 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-white/20 text-center sticky top-0 bg-white/80 backdrop-blur-xl z-30 shadow-sm">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      </div>

      <div className="flex flex-1 relative">
        {/* Time Labels */}
        <div className="w-20 flex-shrink-0 border-r border-white/20 text-xs font-medium text-[var(--color-text-secondary)] bg-white/30 select-none">
          {HOURS.map(h => (
            <div key={h} className="h-24 border-b border-white/10 relative group">
              <span className="absolute -top-2.5 right-3 group-hover:text-[var(--color-text-primary)] transition-colors">
                {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 relative bg-white/[0.01]">
           {/* Grid lines */}
           {HOURS.map(h => (
              <div key={h} className="h-24 border-b border-white/10 relative group">
                {/* 15 min markers */}
                <div className="absolute top-1/4 w-full border-t border-black/[0.02]"></div>
                <div className="absolute top-2/4 w-full border-t border-black/[0.04] border-dashed"></div>
                <div className="absolute top-3/4 w-full border-t border-black/[0.02]"></div>
              </div>
           ))}

           {/* Current Time Indicator */}
           {date.toDateString() === new Date().toDateString() && (
             <div 
               className="absolute w-full border-t-2 border-red-500 z-30 pointer-events-none flex items-center shadow-[0_0_10px_rgba(239,68,68,0.5)]"
               style={{ top: `${((new Date().getHours() * 60 + new Date().getMinutes()) / 1440) * 100}%` }}
             >
               <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-sm ring-2 ring-red-500/30"></div>
             </div>
           )}

           {/* Admin Screenshot Markers (Mock) */}
           {isAdmin && [555, 630, 705, 850, 965].map((m, i) => (
             <div 
               key={`screen-${i}`}
               className="absolute left-0 w-2 h-2 rounded-full bg-blue-400/50 z-20 hover:bg-blue-400 hover:scale-150 transition-all cursor-help -ml-1"
               style={{ top: `${(m / 1440) * 100}%` }}
               title="Screenshot captured"
             />
           ))}

           {/* Planned Shift Boundary (Mock) */}
           <div 
             className="absolute left-4 right-4 border-2 border-dashed border-gray-400/30 rounded-xl pointer-events-none z-0"
             style={{ top: `${(540/1440)*100}%`, height: `${((1020-540)/1440)*100}%` }}
           >
             <span className="absolute -top-3 right-2 text-[10px] text-[var(--color-text-secondary)] bg-white/60 px-2 rounded-full uppercase tracking-widest backdrop-blur-md">Scheduled Shift 09:00 - 17:00</span>
           </div>

           {/* Events */}
           {dayEvents.map((e, idx) => {
               if (e.startTime === undefined) return (
                 <div key={idx} className="bg-purple-50 border border-purple-200 text-purple-800 p-3 m-4 rounded-xl shadow-sm backdrop-blur-md">
                   <div className="font-bold text-sm">{e.title}</div>
                   <div className="text-[10px] opacity-70 uppercase tracking-wider mt-1">{e.type}</div>
                 </div>
               )

               const style = getEventStyle(e)
               
               return (
                 <div 
                   key={e.id}
                   className="absolute left-4 right-4 rounded-xl px-5 py-3 text-sm overflow-hidden backdrop-blur-md shadow-sm transition-all duration-300 hover:z-30 hover:scale-[1.01] hover:shadow-lg hover:bg-opacity-20 group border"
                   style={{
                      ...style,
                      backgroundColor: e.type === 'attendance' ? 'rgba(34, 197, 94, 0.1)' : e.type === 'break' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.6)',
                     borderColor: e.type === 'attendance' ? 'rgba(34, 197, 94, 0.2)' : e.type === 'break' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                     borderLeftWidth: '4px',
                     borderLeftColor: (e.type === 'attendance' && e.status === 'late') ? '#eab308' : e.type === 'attendance' ? '#22c55e' : e.type === 'break' ? '#f97316' : '#3b82f6'
                   }}
                 >
                   <div className="flex justify-between items-start h-full relative z-10">
                     <div className="flex flex-col h-full min-w-0 pr-4">
                       <div className="flex items-center gap-2 mb-1">
                         <div className={`w-1.5 h-1.5 rounded-full ${e.type === 'attendance' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                         <div className="font-bold text-base leading-none text-[var(--color-text-primary)] truncate">{e.title}</div>
                       </div>
                       <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-medium group-hover:text-[var(--color-text-primary)] transition-colors">
                         <span>{e.type}</span>
                         {e.status && (
                           <>
                             <span>•</span>
                             <span>{e.status}</span>
                           </>
                         )}
                       </div>
                       
                       {e.metadata && (
                         <div className="mt-auto pt-2 text-xs text-[var(--color-text-secondary)] font-mono hidden sm:block truncate group-hover:text-[var(--color-text-primary)] transition-colors">
                           {Object.entries(e.metadata).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                         </div>
                       )}
                     </div>
                     
                     <div className="text-right flex-shrink-0">
                       <div className="font-mono text-lg font-light text-[var(--color-text-primary)]">
                         {Math.floor(e.startTime/60)}:{String(e.startTime%60).padStart(2,'0')}
                       </div>
                       <div className="font-mono text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                         {e.endTime ? `${Math.floor(e.endTime/60)}:${String(e.endTime%60).padStart(2,'0')}` : '...'}
                       </div>
                     </div>
                   </div>
                   
                   {/* Decorative background gradient */}
                   <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r ${e.type === 'attendance' ? 'from-green-500/5' : 'from-blue-500/5'} to-transparent pointer-events-none`} />
                 </div>
               )
           })}
        </div>
      </div>
    </div>
  )
}
