'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react'
import AppShell from '@components/ui/AppShell'
import { CalendarEvent } from '@lib/calendar-service'
import { MonthView } from './_components/MonthView'
import { WeekView } from './_components/WeekView'
import { DayView } from './_components/DayView'
import { ListView } from './_components/ListView'
import { DayDetailModal } from './_components/DayDetailModal'
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
  const [view, setView] = useState<ViewMode>('month')
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDayModal, setSelectedDayModal] = useState<Date | null>(null)

  // Admin filtering
  const [users, setUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [role, setRole] = useState('')

  // Filters (you can wire these into API later)
  const [department, setDepartment] = useState('')
  const [project, setProject] = useState('')
  const [status, setStatus] = useState('')

  const [filtersOpen, setFiltersOpen] = useState(true)

  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'owner'

  const chips = useMemo(() => {
    const out: { key: string; label: string; onRemove: () => void }[] = []
    if (selectedUserId) out.push({ key: 'user', label: `User: ${selectedUserId}`, onRemove: () => setSelectedUserId('') })
    if (department) out.push({ key: 'dept', label: `Department: ${department}`, onRemove: () => setDepartment('') })
    if (project) out.push({ key: 'proj', label: `Project: ${project}`, onRemove: () => setProject('') })
    if (status) out.push({ key: 'status', label: `Status: ${status}`, onRemove: () => setStatus('') })
    return out
  }, [selectedUserId, department, project, status])

  useEffect(() => {
    const r = getCookie('current_role')
    setRole(r)

    const uid = getCookie('current_user_id')
    if (!selectedUserId) setSelectedUserId(uid)

    if (r === 'admin' || r === 'super_admin' || r === 'owner') loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUsers = async () => {
    const orgId = getCookie('current_org_id')
    if (!orgId) return
    try {
      const res = await fetch(`/api/user/list?orgId=${orgId}`)
      const d = await res.json()
      if (d.items) setUsers(d.items)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (selectedUserId) fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, view, selectedUserId])

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
      const endpoint = isAdmin
        ? `/api/calendar/user/${selectedUserId}?from=${fromStr}&to=${toStr}`
        : `/api/calendar/my?from=${fromStr}&to=${toStr}`

      const res = await fetch(endpoint)
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

  const resetFilters = () => {
    setSelectedUserId('')
    setDepartment('')
    setProject('')
    setStatus('')
  }

  return (

    <div className={styles.pageCanvas}>
  <div className={styles.bg} />
  <div className={styles.glow} />

  <div className={styles.page}>
    <AppShell title="Calendar">
      <div className={styles.bg} />
      <div className={styles.glow} />

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
          <div className={styles.card}>
            <div className={styles.filtersHead}>
              <div className={styles.filtersLeft}>
                <button className={styles.filtersLeft} onClick={() => setFiltersOpen((v) => !v)}>
                  <span className={styles.badgeIcon}>
                    <Filter size={16} />
                  </span>
                  <span className={styles.filtersTitle}>Filters</span>
                  <span className={styles.filtersMeta}>{filtersOpen ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              <button className={styles.resetBtn} onClick={resetFilters}>
                Reset
              </button>
            </div>

            {filtersOpen && (
              <div className={styles.filtersBody}>
                <div className={styles.grid}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Assignee</div>
                    <select className={styles.select} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                      <option value="">All Users</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Department</div>
                    <select className={styles.select} value={department} onChange={(e) => setDepartment(e.target.value)}>
                      <option value="">Any</option>
                      <option value="tech">Technology</option>
                      <option value="hr">HR</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Project</div>
                    <select className={styles.select} value={project} onChange={(e) => setProject(e.target.value)}>
                      <option value="">Any</option>
                      <option value="alpha">Alpha</option>
                      <option value="beta">Beta</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Status</div>
                    <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="">Any</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {chips.length > 0 && (
                  <div className={styles.chips}>
                    {chips.map((c) => (
                      <span key={c.key} className={styles.chip}>
                        {c.label}
                        <button className={styles.chipX} onClick={c.onRemove}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              <MonthView date={date} events={events} onDateClick={(d) => setSelectedDayModal(d)} />
            )}
            {!loading && view === 'week' && <WeekView date={date} events={events} />}
            {!loading && view === 'day' && <DayView date={date} events={events} isAdmin={isAdmin} />}
            {!loading && view === 'list' && (
              <ListView startDate={date} events={events} onDateClick={(d) => setSelectedDayModal(d)} />
            )}
          </div>
        </div>

        {selectedDayModal && (
          <DayDetailModal
            open={!!selectedDayModal}
            date={selectedDayModal}
            events={events}
            onClose={() => setSelectedDayModal(null)}
          />
        )}
      </div>
    </AppShell>
      </div>
</div>
  )
}
