'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import AppShell from '@/components/ui/AppShell'
import { CalendarEvent } from '@/lib/calendar-service'
import { DayView } from '../_components/DayView'
import styles from '../page.module.css'

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

export default function CalendarDayPage({ params }: { params: { date: string } }) {
  const router = useRouter()
  const { date: dateStr } = params
  
  // Initialize with the date from params
  const [date, setDate] = useState<Date>(() => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d)
  })
  
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('')
  
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'owner'

  useEffect(() => {
    setRole(getCookie('current_role'))
  }, [])

  useEffect(() => {
    if (role) fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, role])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      // Use the date from state (which is derived from params)
      // Format as YYYY-MM-DD for API
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const apiDateStr = `${y}-${m}-${d}`

      let endpoint = ''
      const params = new URLSearchParams()
      params.set('from', apiDateStr)
      params.set('to', apiDateStr)

      if (isAdmin) {
        endpoint = `/api/calendar/team`
      } else {
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

  return (
    <AppShell title={`Calendar - ${date.toLocaleDateString()}`}>
      <div className={styles.page}>
        <div className={styles.card}>
            <div className={`${styles.cardPad} ${styles.headerRow}`}>
                <div className={styles.leftBlock}>
                    <button className={styles.iconBtn} onClick={() => router.push('/calendar')} aria-label="Back">
                        <ChevronLeft size={20} />
                    </button>
                    <div className={styles.titleWrap}>
                        <div className={styles.title}>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        <div className={styles.subtitle}>Daily View</div>
                    </div>
                </div>
            </div>
        </div>

        <div className={`${styles.card} ${styles.calendarCard}`}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingBox}>
                <div className={styles.spinner} />
                <div className={styles.loadingText}>Loading Day...</div>
              </div>
            </div>
          )}
          <div className={styles.calendarInner}>
             <DayView date={date} events={events} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
