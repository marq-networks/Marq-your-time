'use client'

import React, { useEffect } from 'react'
import { X, Filter } from 'lucide-react'
import GlassButton from '@/components/ui/GlassButton'

interface Props {
  isOpen: boolean
  onClose: () => void
  onClear?: () => void
  children: React.ReactNode
  title?: string
}

export default function FilterDrawer({ isOpen, onClose, onClear, children, title = 'Filters' }: Props) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div className="relative w-full max-w-md h-full bg-[rgba(255,255,255,0.85)] backdrop-blur-xl border-l border-white/40 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white/10">
          <div className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide text-[#1f1f1f] opacity-90">
            <Filter className="w-4 h-4 text-primary" />
            {title}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-black/40 hover:text-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {children}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-white/10">
          {onClear && (
            <button 
              onClick={onClear}
              className="text-xs text-black/60 hover:text-black transition-colors"
            >
              Clear all filters
            </button>
          )}
          <GlassButton onClick={onClose} variant="primary">
            Show Results
          </GlassButton>
        </div>
      </div>
    </div>
  )
}
