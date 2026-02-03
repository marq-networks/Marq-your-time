'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import GlassButton from '@/components/ui/GlassButton'
import GlassCard from '@/components/ui/GlassCard'

interface ExportMenuProps {
  onExportCsv?: () => void
  onExportPdf?: () => void
  onExport?: (type: 'csv' | 'pdf') => void
  isExporting?: boolean
  align?: 'left' | 'right'
}

export default function ExportMenu({ onExportCsv, onExportPdf, onExport, isExporting = false, align = 'right' }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <GlassButton 
        onClick={() => setIsOpen(!isOpen)} 
        disabled={isExporting}
        className="flex items-center gap-2 !px-4 !py-2"
        variant="primary"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </GlassButton>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-48 z-50`}>
          <GlassCard className="!p-1 overflow-hidden shadow-xl border-white/20 bg-gray-900/95 backdrop-blur-xl">
            <button
              onClick={() => {
                if (onExport) onExport('csv')
                else if (onExportCsv) onExportCsv()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-white/10 hover:text-gray-500 flex items-center gap-3 transition-colors rounded-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#39ff14]" />
              Export CSV
            </button>
            <button
              onClick={() => {
                if (onExport) onExport('pdf')
                else if (onExportPdf) onExportPdf()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-white/10 hover:text-gray-500 flex items-center gap-3 transition-colors rounded-md"
            >
              <FileText className="w-4 h-4 text-red-400" />
              Export PDF
            </button>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
