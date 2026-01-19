import GlassModal from '@components/ui/GlassModal'
import { CalendarEvent } from '@lib/calendar-service'
import { CheckCircle, Clock, Coffee, AlertCircle, Calendar as CalendarIcon, ArrowRight } from 'lucide-react'

interface DayDetailModalProps {
  open: boolean
  onClose: () => void
  date: Date
  events: CalendarEvent[]
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
  if (attendance && attendance.startTime && attendance.endTime) {
    totalMinutes = attendance.endTime - attendance.startTime
    // Subtract breaks? Usually breaks are inside. Let's assume breaks reduce time.
    breaks.forEach(b => {
      if (b.startTime && b.endTime) {
        totalMinutes -= (b.endTime - b.startTime)
      }
    })
  }
  
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

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
             <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
               {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
             </h2>
             <p className="text-[var(--color-text-secondary)] text-sm mt-1">Daily Activity Overview</p>
           </div>
           <div>
              {leaves.length > 0 ? (
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold border border-blue-200 shadow-sm">
                  On Leave
                </span>
              ) : attendance ? (
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold border border-green-200 shadow-sm">
                  Present
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-sm font-semibold border border-gray-200 shadow-sm">
                  Absent
                </span>
              )}
           </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/60 rounded-[20px] p-4 border border-white/50 shadow-sm backdrop-blur-md">
            <div className="text-[var(--color-text-secondary)] text-[10px] uppercase tracking-wider font-bold mb-1">Total Hours</div>
            <div className="text-xl font-bold text-[var(--color-text-primary)]">
              {hours}h {mins}m
            </div>
          </div>
          <div className="bg-white/60 rounded-[20px] p-4 border border-white/50 shadow-sm backdrop-blur-md">
            <div className="text-[var(--color-text-secondary)] text-[10px] uppercase tracking-wider font-bold mb-1">Extra Time</div>
            <div className="text-xl font-bold text-green-600">
              --
            </div>
          </div>
          <div className="bg-white/60 rounded-[20px] p-4 border border-white/50 shadow-sm backdrop-blur-md">
             <div className="text-[var(--color-text-secondary)] text-[10px] uppercase tracking-wider font-bold mb-1">Short Time</div>
             <div className="text-xl font-bold text-red-500">
               --
             </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider pl-1">Timeline</h3>
          
          {dayEvents.length === 0 ? (
            <div className="text-center py-10 bg-white/40 rounded-2xl border border-white/40 border-dashed">
              <CalendarIcon className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3 opacity-50" />
              <div className="text-[var(--color-text-secondary)] font-medium">No activity recorded</div>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 py-2">
              {/* Check In */}
              {attendance && attendance.startTime !== undefined && (
                <div className="relative pl-8 group">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500 ring-4 ring-white shadow-sm"></div>
                  <div className="flex justify-between items-center bg-white/40 p-3 rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                         <CheckCircle className="w-4 h-4" />
                       </div>
                       <div>
                         <div className="font-bold text-[var(--color-text-primary)]">Check In</div>
                         <div className="text-xs text-[var(--color-text-secondary)]">Shift Started</div>
                       </div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)] bg-white/50 px-2 py-1 rounded-md">
                      {Math.floor(attendance.startTime/60)}:{String(attendance.startTime%60).padStart(2,'0')}
                    </div>
                  </div>
                </div>
              )}

              {/* Breaks */}
              {breaks.map((b, i) => (
                <div key={i} className="relative pl-8">
                  <div className="absolute -left-[7px] top-4 w-3 h-3 rounded-full bg-orange-300 ring-4 ring-white shadow-sm"></div>
                  <div className="bg-white/40 rounded-xl p-3 border border-white/50 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                          <Coffee className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-[var(--color-text-primary)]">{b.title}</div>
                          <div className="text-xs font-mono text-[var(--color-text-secondary)]">
                            {b.startTime !== undefined && `${Math.floor(b.startTime/60)}:${String(b.startTime%60).padStart(2,'0')}`} - 
                            {b.endTime !== undefined && `${Math.floor(b.endTime/60)}:${String(b.endTime%60).padStart(2,'0')}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-[var(--color-text-secondary)] bg-orange-50 px-2 py-1 rounded-full border border-orange-100">
                        {b.endTime && b.startTime ? `${b.endTime - b.startTime}m` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Check Out */}
              {attendance && attendance.endTime !== undefined && (
                <div className="relative pl-8">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-red-400 ring-4 ring-white shadow-sm"></div>
                  <div className="flex justify-between items-center bg-white/40 p-3 rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                         <AlertCircle className="w-4 h-4" />
                       </div>
                       <div>
                         <div className="font-bold text-[var(--color-text-primary)]">Check Out</div>
                         <div className="text-xs text-[var(--color-text-secondary)]">Shift Ended</div>
                       </div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)] bg-white/50 px-2 py-1 rounded-md">
                      {Math.floor(attendance.endTime/60)}:{String(attendance.endTime%60).padStart(2,'0')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-white/20 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-[var(--color-text-secondary)] bg-white/50 hover:bg-white/80 border border-white/60 shadow-sm hover:shadow-md transition-all"
          >
            Close
          </button>
          <button className="px-6 py-2.5 rounded-full text-sm font-bold bg-gradient-to-r from-[#3dd6a3] to-[#22a876] text-white hover:brightness-105 shadow-lg shadow-green-500/20 transition-all flex items-center gap-2 transform hover:-translate-y-0.5">
            <span>View Full Details</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </GlassModal>
  )
}
