'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition, useMemo } from 'react'

export function useListQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Local state for search to allow debouncing
  const [search, setSearch] = useState(searchParams.get('q') || '')

  const filters = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams.toString()])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get('q') || '')) {
        updateFilter('q', search)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  const createQueryString = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === null || value === '') {
        params.delete(name)
      } else {
        params.set(name, value)
      }
      
      // Reset page when filtering changes (except when changing page itself)
      if (name !== 'page') {
        params.set('page', '1')
      }
      
      return params.toString()
    },
    [searchParams]
  )

  const updateFilter = useCallback(
    (name: string, value: string | null) => {
      startTransition(() => {
        router.push(`${pathname}?${createQueryString(name, value)}`)
      })
    },
    [pathname, router, createQueryString]
  )

  const setFilters = useCallback(
    (filters: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(filters).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })
      // Reset page
      params.set('page', '1')
      
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [pathname, router, searchParams]
  )

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push(`${pathname}`)
    })
    setSearch('')
  }, [pathname, router])

  return {
    search,
    setSearch,
    filters,
    updateFilter,
    setFilters,
    clearFilters,
    isPending,
  }
}
