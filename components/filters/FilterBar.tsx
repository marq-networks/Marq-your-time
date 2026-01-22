'use client'

import React, { useEffect, useState } from 'react'
import { Filter } from 'lucide-react'
import GlassButton from '@/components/ui/GlassButton'
import SearchInput from '@/components/filters/SearchInput'
import FilterDrawer from '@/components/filters/FilterDrawer'
import MultiSelect from '@/components/filters/MultiSelect'
import StatusPills from '@/components/filters/StatusPills'
import SavedViews from '@/components/filters/SavedViews'
import DateRangePicker from '@/components/filters/DateRangePicker'
import GlassSelect from '@/components/ui/GlassSelect'
import SortSelect from '@/components/filters/SortSelect'
import { useListQuery } from '@/lib/hooks/useListQuery'

interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'multi-select' | 'status' | 'date-range' | 'sort'
  options?: { label: string; value: string }[]
}

interface Props {
  pageKey: string
  orgId: string
  config: FilterConfig[]
  children?: React.ReactNode // Extra filters
  filters?: any
  onFilterChange?: (filters: any) => void
  search?: string
  onSearchChange?: (value: string) => void
  showSavedViews?: boolean
  savedViewsType?: string // Deprecated: use pageKey
}

export default function FilterBar({ pageKey, orgId, config, children, filters: propFilters, onFilterChange, search: propSearch, onSearchChange, showSavedViews = true, savedViewsType }: Props) {
  const { search: hookSearch, setSearch: hookSetSearch, filters: hookFilters, setFilters: hookSetFilters, clearFilters } = useListQuery()
  
  const filters = propFilters || hookFilters
  const setFilters = onFilterChange || hookSetFilters
  const search = propSearch !== undefined ? propSearch : hookSearch
  const setSearch = onSearchChange || hookSetSearch

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Count active filters (excluding page and q)
  const activeCount = Object.keys(filters).filter(k => k !== 'page' && k !== 'q' && k !== 'orgId' && k !== 'date' && k !== 'pageSize').length

  const handleMultiChange = (key: string, values: string[]) => {
    setFilters({ ...filters, [key]: values.length ? values.join(',') : null })
  }

  const handleSingleChange = (key: string, value: string | null) => {
    setFilters({ ...filters, [key]: value })
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 max-w-md gap-2">
          <SearchInput 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        
        <GlassButton 
          onClick={() => setIsDrawerOpen(true)}
          className={`flex items-center gap-2 transition-all duration-200 ${
            activeCount > 0 
              ? 'border-primary/50 text-white bg-primary shadow-[0_0_15px_-3px_rgba(61,214,163,0.3)]' 
              : 'hover:bg-white/40 text-[#1f1f1f]'
          }`}
        >
          <Filter className={`w-4 h-4 ${activeCount > 0 ? 'text-white' : 'text-[#1f1f1f]/70'}`} />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="bg-white text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 shadow-sm">
              {activeCount}
            </span>
          )}
        </GlassButton>
      </div>

      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onClear={clearFilters}
        title="Filter & Search"
      >
        <div className="space-y-6">
          {showSavedViews && (
            <SavedViews 
              pageKey={pageKey} 
              orgId={orgId} 
              currentFilters={filters as Record<string, string>}
              onLoad={setFilters}
            />
          )}

          <hr className="border-black/10" />

          {config.map(field => (
            <div key={field.key}>
              {field.type === 'status' && (
                <StatusPills
                  label={field.label}
                  options={field.options || []}
                  value={filters[field.key] || null}
                  onChange={(val) => handleSingleChange(field.key, val)}
                />
              )}
              
              {field.type === 'multi-select' && (
                <MultiSelect
                  label={field.label}
                  options={field.options || []}
                  value={filters[field.key] ? filters[field.key].split(',') : []}
                  onChange={(vals) => handleMultiChange(field.key, vals)}
                />
              )}

              {field.type === 'select' && (
                <div>
                  <div className="label mb-2 text-[#1f1f1f]/50 font-semibold uppercase tracking-wider text-xs ml-1">{field.label}</div>
                  <GlassSelect
                    value={filters[field.key] || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSingleChange(field.key, e.target.value || null)}
                  >
                    <option value="">All</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </GlassSelect>
                </div>
              )}

              {field.type === 'date-range' && (
                <DateRangePicker
                  label={field.label}
                  from={filters.from ? new Date(filters.from) : undefined}
                  to={filters.to ? new Date(filters.to) : undefined}
                  onSelect={(range) => setFilters({ 
                    ...filters, 
                    from: range.from ? range.from.toISOString().slice(0, 10) : null,
                    to: range.to ? range.to.toISOString().slice(0, 10) : null
                  })}
                />
              )}
              
              {/* Add other types as needed */}
            </div>
          ))}
          
          {children}
        </div>
      </FilterDrawer>
    </>
  )
}
