import { CalendarEvent } from '@lib/calendar-service'
import { useMemo } from 'react'
import { Briefcase, Clock, Plane, AlertCircle, Sun, Coffee, Calendar, ArrowRight } from 'lucide-react'

interface ListViewProps {
  startDate: Date
  events: CalendarEvent[]
  onDateClick: (date: Date) => void
}

export function ListView({ startDate, events, onDateClick }: ListViewProps) {
  // Generate 10 days starting from startDate
  const days = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      return d
    })
  }, [startDate])

  const getEventsForDay = (d: Date) => {
    const dateStr = d.toISOString().slice(0, 10)
    return events.filter(e => e.date === dateStr)
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'attendance': return <Briefcase className="w-4 h-4" />
      case 'late': return <Clock className="w-4 h-4" />
      case 'leave': 
      case 'leave-unpaid': return <Plane className="w-4 h-4" />
      case 'absent': return <AlertCircle className="w-4 h-4" />
      case 'holiday': return <Sun className="w-4 h-4" />
      case 'overtime': return <Clock className="w-4 h-4" />
      case 'break': return <Coffee className="w-4 h-4" />
      default: return <Calendar className="w-4 h-4" />
    }
  }

  // Adjusted for Light/Glass Theme
  const getEventColor = (type: string) => {
    switch (type) {
      case 'attendance': return 'bg-green-100 text-green-700 border-green-200'
      case 'late': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'leave': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'leave-unpaid': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'absent': return 'bg-red-100 text-red-700 border-red-200'
      case 'holiday': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'overtime': return 'bg-pink-100 text-pink-700 border-pink-200'
      case 'break': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-white/50 text-gray-600 border-gray-200'
    }
  }

  const formatTime = (minutes?: number) => {
    if (minutes === undefined) return ''
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full custom-scrollbar bg-white/30 backdrop-blur-md rounded-2xl">
      {days.map((d, i) => {
        const dayEvents = getEventsForDay(d)
        const isToday = d.toDateString() === new Date().toDateString()
        const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        
        return (
          <div 
            key={i} 
            className={`
              flex flex-col md:flex-row gap-4 p-4 rounded-2xl border transition-all duration-200
              ${isToday ? 'bg-white/80 border-green-300 shadow-md' : 'bg-white/40 border-white/40 hover:bg-white/60'}
            `}
          >
            {/* Date Column */}
            <div className="md:w-32 flex-shrink-0 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-center gap-2">
              <div className="flex items-center gap-3 md:gap-2">
                <span className={`
                  text-lg font-bold w-10 h-10 flex items-center justify-center rounded-xl shadow-sm
                  ${isToday ? 'bg-green-500 text-white' : 'bg-white text-gray-700'}
                `}>
                  {d.getDate()}
                </span>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold uppercase tracking-wider ${isToday ? 'text-green-600' : 'text-gray-500'}`}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-xs text-gray-400 hidden md:block">
                    {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => onDateClick(d)}
                className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1 md:mt-2 bg-white/50 px-2 py-1 rounded-full hover:bg-white"
              >
                Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Events Column */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              {dayEvents.length === 0 ? (
                <div className="h-full flex items-center text-gray-400 text-sm font-medium italic pl-2 border-l-2 border-gray-200/50">
                  No events scheduled
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {dayEvents.map((e, idx) => {
                     return (
                      <div 
                        key={idx}
                        className={`
                          flex items-center gap-3 p-2.5 rounded-xl border backdrop-blur-sm transition-all hover:scale-[1.02] shadow-sm
                          ${getEventColor(e.type)}
                        `}
                      >
                        <div className="p-1.5 rounded-lg bg-white/50 shrink-0">
                          {getEventIcon(e.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate leading-tight">{e.title}</p>
                          <div className="flex items-center justify-between mt-0.5">
                             <p className="text-[10px] opacity-70 uppercase tracking-wider font-medium">
                               {e.type}
                             </p>
                             {e.startTime !== undefined && (
                               <p className="text-[10px] opacity-80 font-mono">
                                 {formatTime(e.startTime)}
                               </p>
                             )}
                          </div>
                        </div>
                      </div>
                     )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
