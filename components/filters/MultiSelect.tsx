'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

interface Option {
  label: string
  value: string
}

interface Props {
  label?: string
  options: Option[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

export default function MultiSelect({ label, options, value, onChange, placeholder = 'Select...' }: Props) {
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

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const removeValue = (e: React.MouseEvent, v: string) => {
    e.stopPropagation()
    onChange(value.filter(val => val !== v))
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-[#1f1f1f]/50 ml-1">{label}</label>}
      
      <div className="relative">
        <div 
          className="min-h-[40px] w-full px-3 py-1.5 bg-white/50 border border-white/40 rounded-lg flex items-center justify-between cursor-pointer hover:bg-white/60 transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
          onClick={() => setIsOpen(!isOpen)}
          tabIndex={0}
        >
          <div className="flex flex-wrap gap-1.5">
            {value.length === 0 && (
              <span className="text-[#1f1f1f]/40 text-sm">{placeholder}</span>
            )}
            {value.map(v => {
              const option = options.find(o => o.value === v)
              return (
                <span key={v} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-white/60 border border-white/40 rounded-md text-xs font-medium text-[#1f1f1f]">
                  {option?.label || v}
                  <button 
                    className="p-0.5 hover:bg-gray-100 rounded-sm transition-colors text-black/40 hover:text-black"
                    onMouseDown={(e) => removeValue(e, v)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
          <ChevronDown className={`w-4 h-4 text-black/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white/90 border border-white/40 rounded-xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
            {options.length === 0 ? (
              <div className="p-3 text-sm opacity-50 text-center text-[#1f1f1f]">No options</div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {options.map(option => {
                  const isSelected = value.includes(option.value)
                  return (
                    <div 
                      key={option.value}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-primary/10 text-primary font-medium' 
                          : 'text-[#1f1f1f]/80 hover:bg-gray-100 hover:text-[#1f1f1f]'
                      }`}
                      onClick={() => toggleOption(option.value)}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
