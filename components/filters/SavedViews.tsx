'use client'

import React, { useState, useEffect } from 'react'
import { Save, Trash2, ArrowRight } from 'lucide-react'
import GlassButton from '@/components/ui/GlassButton'

interface SavedView {
  id: string
  name: string
  page_key: string
  query_params: Record<string, string>
}

interface Props {
  pageKey: string
  orgId: string
  currentFilters: Record<string, string>
  onLoad: (filters: Record<string, string>) => void
}

export default function SavedViews({ pageKey, orgId, currentFilters, onLoad }: Props) {
  const [views, setViews] = useState<SavedView[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (orgId) loadViews()
  }, [orgId])

  const loadViews = async () => {
    try {
      const res = await fetch(`/api/saved-views?pageKey=${pageKey}`)
      const data = await res.json()
      if (data.items) setViews(data.items)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSave = async () => {
    if (!newName.trim() || !orgId) return
    try {
      const res = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          pageKey,
          orgId,
          queryParams: currentFilters
        })
      })
      if (res.ok) {
        setNewName('')
        setIsCreating(false)
        loadViews()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this view?')) return
    try {
      await fetch(`/api/saved-views?id=${id}`, { method: 'DELETE' })
      setViews(views.filter(v => v.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1f1f1f]/50 ml-1">Saved Views</h3>
      </div>

      <div className="space-y-2">
        {views.map(view => (
          <div 
            key={view.id}
            className="flex items-center justify-between p-3 rounded-lg bg-white/40 hover:bg-white/60 border border-transparent hover:border-white/40 cursor-pointer group transition-all duration-200"
            onClick={() => onLoad(view.query_params)}
          >
            <span className="text-sm font-medium truncate flex-1 text-[#1f1f1f]/80 group-hover:text-[#1f1f1f]">{view.name}</span>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                onClick={(e) => handleDelete(view.id, e)}
                className="p-1.5 hover:bg-red-50 rounded-md hover:text-red-500 transition-colors text-black/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <ArrowRight className="w-3.5 h-3.5 opacity-50 text-primary" />
            </div>
          </div>
        ))}
        
        {views.length === 0 && !isCreating && (
          <div className="text-xs opacity-40 text-center py-4 border border-dashed border-black/10 rounded-lg text-[#1f1f1f]">
            No saved views yet
          </div>
        )}
      </div>

      {isCreating ? (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 bg-white/40 p-2 rounded-lg border border-white/40">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name your view..."
            className="flex-1 bg-transparent border-none text-sm outline-none placeholder:text-black/30 text-[#1f1f1f]"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleSave} className="p-1.5 hover:bg-white/60 rounded-md text-primary transition-colors">
            <Save className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          className="w-full py-2 px-3 text-xs font-medium text-[#1f1f1f]/60 hover:text-[#1f1f1f] bg-white/40 hover:bg-white/60 border border-white/40 hover:border-white/50 rounded-lg transition-all flex items-center justify-center gap-2"
          onClick={() => setIsCreating(true)}
        >
          <Save className="w-3.5 h-3.5" />
          Save Current Filters
        </button>
      )}
    </div>
  )
}
