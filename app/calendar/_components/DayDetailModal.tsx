import GlassModal from '@components/ui/GlassModal'
import { CalendarEvent } from '@lib/calendar-service'
import { CheckCircle, Clock, Coffee, AlertCircle, Calendar as CalendarIcon, ArrowRight } from 'lucide-react'

interface DayDetailModalProps {
  open: boolean
  onClose: () => void
  date: Date
  events: CalendarEvent[]
}

const formatTime = (minutes: number | undefined) => {
  if (minutes === undefined || minutes === null || isNaN(minutes)) return '--:--'
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

export function DayDetailModal({ open, onClose, date, events }: DayDetailModalProps) {
  const dateStr = date.toISOString().slice(0, 10)
  const dayEvents = events.filter(e => e.date === dateStr)
  
  // Calculations
  const attendance = dayEvents.find(e => e.type === 'attendance')
  const breaks = dayEvents.filter(e => e.type === 'break')
  const leaves = dayEvents.filter(e => e.type.includes('leave'))
  
  // Total hours (mock calculation based on events)
  let totalMinutes = 0
  if (attendance && typeof attendance.startTime === 'number' && typeof attendance.endTime === 'number' && !isNaN(attendance.startTime) && !isNaN(attendance.endTime)) {
    totalMinutes = attendance.endTime - attendance.startTime
    
    // Subtract breaks
    breaks.forEach(b => {
      if (typeof b.startTime === 'number' && typeof b.endTime === 'number' && !isNaN(b.startTime) && !isNaN(b.endTime)) {
        totalMinutes -= (b.endTime - b.startTime)
      }
    })
  }
  
  // Ensure totalMinutes is valid
  if (isNaN(totalMinutes) || totalMinutes < 0) totalMinutes = 0
  
  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.floor(totalMinutes % 60)

  return (
    <GlassModal 
      open={open} 
      title=""
      onClose={onClose}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
           <div>
             <h2 className="text-2xl font-bold text-white">
               {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
             </h2>
             <p className="text-gray-400 text-sm mt-1">Daily Activity Overview</p>
           </div>
           <div>
              {leaves.length > 0 ? (
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-sm font-semibold border border-blue-500/30 shadow-sm">
                  On Leave
                </span>
              ) : attendance ? (
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-200 text-sm font-semibold border border-green-500/30 shadow-sm">
                  Present
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-gray-500/20 text-gray-300 text-sm font-semibold border border-gray-500/30 shadow-sm">
                  Absent
                </span>
              )}
           </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-[20px] p-4 border border-white/10 shadow-sm backdrop-blur-md">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider font-bold mb-1">Total Hours</div>
            <div className="text-xl font-bold text-white">
              {hours}h {mins}m
            </div>
          </div>
          <div className="bg-white/5 rounded-[20px] p-4 border border-white/10 shadow-sm backdrop-blur-md">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider font-bold mb-1">Extra Time</div>
            <div className="text-xl font-bold text-[#39ff14]">
              --
            </div>
          </div>
          <div className="bg-white/5 rounded-[20px] p-4 border border-white/10 shadow-sm backdrop-blur-md">
             <div className="text-gray-400 text-[10px] uppercase tracking-wider font-bold mb-1">Short Time</div>
             <div className="text-xl font-bold text-red-400">
               --
             </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider pl-1">Timeline</h3>
          
          {dayEvents.length === 0 ? (
            <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10 border-dashed">
              <CalendarIcon className="w-10 h-10 text-gray-500 mx-auto mb-3 opacity-50" />
              <div className="text-gray-400 font-medium">No activity recorded</div>
            </div>
          ) : (
            <div className="relative border-l-2 border-white/10 ml-4 space-y-8 py-2">
              {/* Check In */}
              {attendance && (
                <div className="relative pl-8 group">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#39ff14] ring-4 ring-[#1a1a1a] shadow-sm"></div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10 shadow-sm hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-[#39ff14]/20 text-[#39ff14] rounded-lg">
                         <CheckCircle className="w-4 h-4" />
                       </div>
                       <div>
                         <div className="font-bold text-white">Check In</div>
                         <div className="text-xs text-gray-400">Shift Started</div>
                       </div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-white bg-black/20 px-2 py-1 rounded-md border border-white/5">
                      {formatTime(attendance.startTime)}
                    </div>
                  </div>
                </div>
              )}

              {/* Breaks */}
              {breaks.map((b, i) => (
                <div key={i} className="relative pl-8">
                  <div className="absolute -left-[7px] top-4 w-3 h-3 rounded-full bg-orange-400 ring-4 ring-[#1a1a1a] shadow-sm"></div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10 shadow-sm hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg">
                          <Coffee className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{b.title}</div>
                          <div className="text-xs font-mono text-gray-400">
                            {formatTime(b.startTime)} - {formatTime(b.endTime)}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-gray-300 bg-orange-500/10 px-2 py-1 rounded-full border border-orange-500/20">
                        {(b.endTime && b.startTime && !isNaN(b.endTime) && !isNaN(b.startTime)) ? `${b.endTime - b.startTime}m` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Check Out */}
              {attendance && attendance.endTime !== undefined && !isNaN(attendance.endTime) && (
                <div className="relative pl-8">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-red-500 ring-4 ring-[#1a1a1a] shadow-sm"></div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10 shadow-sm hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                         <AlertCircle className="w-4 h-4" />
                       </div>
                       <div>
                         <div className="font-bold text-white">Check Out</div>
                         <div className="text-xs text-gray-400">Shift Ended</div>
                       </div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-white bg-black/20 px-2 py-1 rounded-md border border-white/5">
                      {formatTime(attendance.endTime)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 shadow-sm transition-all"
          >
            Close
          </button>
          <button className="px-6 py-2.5 rounded-full text-sm font-bold bg-[#39ff14] text-black hover:brightness-110 shadow-lg shadow-[#39ff14]/20 transition-all flex items-center gap-2 transform hover:-translate-y-0.5">
            <span>View Full Details</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </GlassModal>
  )
}
