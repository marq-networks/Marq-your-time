'use client'

import React, { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { DayPicker, DateRange } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

interface Props {
  from?: Date
  to?: Date
  onSelect: (range: { from?: Date; to?: Date }) => void
  label?: string
}

export default function DateRangePicker({ from, to, onSelect, label }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (range: DateRange | undefined) => {
    if (range) {
      onSelect({ from: range.from, to: range.to })
    } else {
      onSelect({})
    }
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect({})
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-[#1f1f1f]/50 ml-1">{label}</label>}
      
      <div className="relative">
        <div 
          className="h-[40px] w-full px-3 bg-white/50 border border-white/40 rounded-lg flex items-center justify-between cursor-pointer hover:bg-white/60 transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
          onClick={() => setIsOpen(!isOpen)}
          tabIndex={0}
        >
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="w-4 h-4 text-black/40" />
            {from ? (
              <span className="text-[#1f1f1f] font-medium">
                {format(from, 'MMM d, yyyy')}
                {to ? ` - ${format(to, 'MMM d, yyyy')}` : ''}
              </span>
            ) : (
              <span className="text-[#1f1f1f]/40">Pick a date range</span>
            )}
          </div>
          {(from || to) && (
            <button
              onClick={clear}
              className="p-1 hover:bg-black/5 rounded-full transition-colors text-black/40 hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 p-3 bg-white/90 border border-white/40 rounded-xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
             <style>{`
              .rdp { --rdp-cell-size: 32px; margin: 0; color: #1f1f1f; }
              .rdp-day_selected:not([disabled]), .rdp-day_selected:focus:not([disabled]), .rdp-day_selected:active:not([disabled]), .rdp-day_selected:hover:not([disabled]) { 
                background-color: var(--color-accent); 
                color: white;
              }
              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: rgba(0,0,0,0.05);
              }
              .rdp-caption_label { color: inherit; }
            `}</style>
            <DayPicker
              mode="range"
              defaultMonth={from}
              selected={{ from, to }}
              onSelect={handleSelect}
              numberOfMonths={1}
            />
          </div>
        )}
      </div>
    </div>
  )
}
