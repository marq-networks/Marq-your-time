import { CalendarEvent } from '@lib/calendar-service'
import { useMemo } from 'react'
import { Clock, Coffee, Plane, Briefcase, AlertCircle, Sun, Calendar } from 'lucide-react'

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  onDateClick: (date: Date) => void
}

const STATUS_COLORS: Record<string, string> = {
  attendance: 'bg-green-500',
  late: 'bg-yellow-500',
  leave: 'bg-blue-500', // Default leave
  'leave-unpaid': 'bg-orange-500',
  absent: 'bg-red-500',
  holiday: 'bg-purple-500',
  overtime: 'bg-pink-500',
  break: 'bg-gray-400'
}

export function MonthView({ date, events, onDateClick }: MonthViewProps) {
  const days = useMemo(() => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Days from prev month to fill first row
    const startOffset = firstDay.getDay() // 0 = Sunday
    const daysArray = []
    
    // Prev month days
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, 1 - (startOffset - i))
      daysArray.push({ date: d, isCurrentMonth: false })
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i)
      daysArray.push({ date: d, isCurrentMonth: true })
    }
    
    // Next month days to fill grid (up to 42 cells usually)
    const remaining = 42 - daysArray.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      daysArray.push({ date: d, isCurrentMonth: false })
    }
    
    return daysArray
  }, [date])

  const getEventsForDay = (d: Date) => {
    // Use local date string to avoid timezone shifts
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    return events.filter(e => e.date === dateStr)
  }

  const getDayStatusColor = (dayEvents: CalendarEvent[]) => {
    if (dayEvents.some(e => e.type === 'holiday')) return 'bg-purple-50/50 hover:bg-purple-50'
    if (dayEvents.some(e => e.type === 'leave')) return 'bg-blue-50/50 hover:bg-blue-50'
    if (dayEvents.some(e => e.type === 'attendance')) return 'bg-green-50/50 hover:bg-green-50'
    return 'hover:bg-white/60'
  }

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
      default: return 'bg-gray-50 text-gray-600 border-gray-100'
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'attendance': return <Briefcase className="w-3 h-3" />
      case 'late': return <Clock className="w-3 h-3" />
      case 'leave': 
      case 'leave-unpaid': return <Plane className="w-3 h-3" />
      case 'absent': return <AlertCircle className="w-3 h-3" />
      case 'holiday': return <Sun className="w-3 h-3" />
      case 'overtime': return <Clock className="w-3 h-3" />
      case 'break': return <Coffee className="w-3 h-3" />
      default: return <Calendar className="w-3 h-3" />
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-white/30 backdrop-blur-md">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-white/20 bg-white/20">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-4 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 auto-rows-fr flex-1 bg-white/10 gap-px border-l border-white/10 overflow-y-auto custom-scrollbar">
        {days.map(({ date: d, isCurrentMonth }, idx) => {
          const dayEvents = getEventsForDay(d)
          const isToday = new Date().toDateString() === d.toDateString()
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          
          return (
            <div 
              key={idx} 
              onClick={() => onDateClick(d)}
              className={`
                min-h-[100px] p-2 cursor-pointer transition-all duration-300 relative group
                ${!isCurrentMonth ? 'bg-gray-50/50 opacity-60' : 'bg-white/40 hover:bg-white/80'}
                ${isToday ? '!bg-white !opacity-100 ring-inset ring-2 ring-primary/30 z-10 shadow-lg' : ''}
                ${isWeekend && isCurrentMonth && !isToday ? 'bg-gray-50/30' : ''}
                ${getDayStatusColor(dayEvents)}
              `}
            >
              <div className="flex justify-between items-start mb-3">
                <span className={`
                  text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300
                  ${isToday 
                    ? 'bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/30 scale-110' 
                    : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:bg-white/50'}
                `}>
                  {d.getDate()}
                </span>
                
                {dayEvents.length > 0 && (
                   <div className="text-[10px] font-bold text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors opacity-50 group-hover:opacity-100">
                     {dayEvents.length}
                   </div>
                )}
              </div>
              
              <div className="space-y-1.5 relative z-0">
                {dayEvents.slice(0, 4).map((e, i) => (
                  <div 
                    key={i} 
                    className={`
                      text-[11px] px-2 py-1.5 rounded-md truncate backdrop-blur-md border shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:z-10 cursor-pointer flex items-center gap-2 group/event
                      ${getEventColor(e.type)}
                    `}
                    title={`${e.title} (${e.type})`}
                  >
                    <div className="opacity-70 group-hover/event:opacity-100 transition-opacity">
                      {getEventIcon(e.type)}
                    </div>
                    <span className="truncate font-medium tracking-tight opacity-90">{e.title}</span>
                  </div>
                ))}
                {dayEvents.length > 4 && (
                   <div className="text-[10px] text-[var(--color-text-secondary)] font-bold pl-1 mt-1 hover:text-primary transition-colors cursor-pointer uppercase tracking-wider">
                     +{dayEvents.length - 4} more
                   </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
