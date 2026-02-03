'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react'
import AppShell from '@components/ui/AppShell'
import { CalendarEvent } from '@lib/calendar-service'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { MonthView } from './_components/MonthView'
import { WeekView } from './_components/WeekView'
import { DayView } from './_components/DayView'
import { ListView } from './_components/ListView'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import styles from './page.module.css'

type ViewMode = 'month' | 'week' | 'day' | 'list'

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  return (
    document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`))
      ?.split('=')[1] || ''
  )
}

function headerTitle(view: ViewMode, date: Date) {
  if (view === 'month') return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  if (view === 'day')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (view === 'list') {
    const end = new Date(date)
    end.setDate(date.getDate() + 9)
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { filters, setFilters, updateFilter, search, setSearch } = useListQuery()
  const [view, setView] = useState<ViewMode>('month')
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = events
      const exportColumns: ExportColumn[] = [
        { header: 'Title', accessor: 'title' },
        { header: 'Date', accessor: 'date' },
        { header: 'Type', accessor: 'type' },
        { header: 'Status', accessor: 'status' },
        { header: 'Start', accessor: (e) => e.startAt ? new Date(e.startAt).toLocaleTimeString() : (e.startTime !== undefined ? `${Math.floor(e.startTime/60)}:${String(e.startTime%60).padStart(2,'0')}` : '-') },
        { header: 'End', accessor: (e) => e.endAt ? new Date(e.endAt).toLocaleTimeString() : (e.endTime !== undefined ? `${Math.floor(e.endTime/60)}:${String(e.endTime%60).padStart(2,'0')}` : '-') },
      ]
      const filename = `marq_calendar_${view}_${date.toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'Calendar Events', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Admin filtering data
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [orgId, setOrgId] = useState('')
  
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'owner'

  // Load initial data
  useEffect(() => {
    const r = getCookie('current_role')
    const oid = getCookie('current_org_id')
    setRole(r)
    setOrgId(oid)

    if (r === 'admin' || r === 'super_admin' || r === 'owner') {
      loadAdminData(oid)
    }
  }, [])

  const loadAdminData = async (oid: string) => {
    if (!oid) return
    try {
      const [uRes, dRes, pRes] = await Promise.all([
        fetch(`/api/user/list?orgId=${oid}`),
        fetch(`/api/department/list?orgId=${oid}`),
        fetch(`/api/projects/list?org_id=${oid}`)
      ])
      const [u, d, p] = await Promise.all([uRes.json(), dRes.json(), pRes.json()])
      if (u.items) setUsers(u.items)
      if (d.items) setDepartments(d.items)
      if (p.items) setProjects(p.items)
    } catch (e) {
      console.error(e)
    }
  }

  // Fetch events when date/view/filters change
  useEffect(() => {
    if (role) fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, view, searchParams.toString(), role])

  const fetchEvents = async () => {
    setLoading(true)

    let from = new Date(date)
    let to = new Date(date)

    if (view === 'month') {
      from = new Date(date.getFullYear(), date.getMonth(), 1)
      to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    } else if (view === 'week') {
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1)
      const start = new Date(date)
      start.setDate(diff)
      from = new Date(start)
      to = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
    } else if (view === 'list') {
      from = new Date(date)
      to = new Date(date)
      to.setDate(to.getDate() + 9)
    } else {
      from = date
      to = date
    }

    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)

    try {
      let endpoint = ''
      const params = new URLSearchParams()
      params.set('from', fromStr)
      params.set('to', toStr)

      if (isAdmin) {
        // Use team endpoint for admins
        endpoint = `/api/calendar/team`
        if (filters.userIds) params.set('users', filters.userIds)
        if (filters.departmentId) params.set('department', filters.departmentId)
        if (filters.projectId) params.set('project_id', filters.projectId) // Note: team endpoint might need update to support project_id
      } else {
        // Use my endpoint for regular users
        endpoint = `/api/calendar/my`
      }

      const res = await fetch(`${endpoint}?${params.toString()}`)
      const data = await res.json()
      setEvents(data?.events || [])
    } catch (err) {
      console.error(err)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const navigate = (dir: 'prev' | 'next') => {
    const newDate = new Date(date)
    if (view === 'month') newDate.setMonth(newDate.getMonth() + (dir === 'next' ? 1 : -1))
    else if (view === 'week') newDate.setDate(newDate.getDate() + (dir === 'next' ? 7 : -7))
    else if (view === 'list') newDate.setDate(newDate.getDate() + (dir === 'next' ? 10 : -10))
    else newDate.setDate(newDate.getDate() + (dir === 'next' ? 1 : -1))
    setDate(newDate)
  }

  const filterConfig = useMemo(() => [
    { 
      key: 'userIds', 
      label: 'Members', 
      type: 'multi-select' as const, 
      options: users.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u.id })) 
    },
    {
      key: 'departmentId',
      label: 'Department',
      type: 'select' as const,
      options: departments.map(d => ({ label: d.name, value: d.id }))
    },
    {
      key: 'projectId',
      label: 'Project',
      type: 'select' as const,
      options: projects.map(p => ({ label: p.name, value: p.id }))
    }
  ], [users, departments, projects])

  return (
    <AppShell title="Calendar">
      <div className={styles.page}>
        {/* Header Card */}
        <div className={styles.card}>
          <div className={`${styles.cardPad} ${styles.headerRow}`}>
            <div className={styles.leftBlock}>
              <button className={styles.iconBtn} onClick={() => navigate('prev')} aria-label="Previous">
                <ChevronLeft size={20} />
              </button>

              <div className={styles.titleWrap}>
                <div className={styles.title}>{headerTitle(view, date)}</div>
                <div className={styles.subtitle}>View and manage schedule</div>
              </div>

              <button className={styles.iconBtn} onClick={() => navigate('next')} aria-label="Next">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className={styles.rightBlock}>
              <div className={styles.segment}>
                {(['month', 'week', 'day', 'list'] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setView(m)}
                    className={`${styles.segmentBtn} ${view === m ? styles.segmentBtnActive : ''}`}
                  >
                    {m === 'month' ? 'Month' : m === 'week' ? 'Week' : m === 'list' ? 'List' : 'Day'}
                  </button>
                ))}
              </div>

              <ExportMenu isExporting={isExporting} onExport={handleExport} />

              <button className={styles.ghostBtn} onClick={() => setDate(new Date())}>
                Today
              </button>

              <button className={styles.primaryBtn} onClick={() => {}}>
                <Plus size={16} />
                New Event
              </button>
            </div>
          </div>
        </div>

        {/* Filters Card (Admin) */}
        {isAdmin && (
          <div className="mb-6">
            <FilterBar 
              pageKey="calendar" 
              orgId={orgId} 
              config={filterConfig} 
              showSavedViews
            />
          </div>
        )}

        {/* Calendar Card */}
        <div className={`${styles.card} ${styles.calendarCard}`}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingBox}>
                <div className={styles.spinner} />
                <div className={styles.loadingText}>Syncing Calendar...</div>
              </div>
            </div>
          )}

          <div className={styles.calendarInner}>
            {!loading && view === 'month' && (
              <MonthView 
                date={date} 
                events={events} 
                onDateClick={(d) => {
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  router.push(`/calendar/${dateStr}`)
                }} 
              />
            )}
            {!loading && view === 'week' && <WeekView date={date} events={events} />}
            {!loading && view === 'day' && <DayView date={date} events={events} isAdmin={isAdmin} />}
            {!loading && view === 'list' && (
              <ListView 
                startDate={date} 
                events={events} 
                onDateClick={(d) => {
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  router.push(`/calendar/${dateStr}`)
                }} 
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
