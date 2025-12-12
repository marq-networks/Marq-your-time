"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type Calendar = { id: string, orgId: string, name: string, countryCode?: string }
type Holiday = { id: string, calendarId: string, date: string, name: string, isFullDay: boolean }

export default function HolidaysSettingsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [activeCalId, setActiveCalId] = useState<string>('')
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [newHoliday, setNewHoliday] = useState<{ date: string, name: string, isFullDay: boolean }>({ date: '', name: '', isFullDay: true })
  const [newCalendar, setNewCalendar] = useState<{ name: string, countryCode?: string }>({ name: '', countryCode: '' })
  const [createCalOpen, setCreateCalOpen] = useState(false)
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache: 'no-store', headers: { 'x-user-id': 'demo-user' } })
    const data = await res.json()
    setOrgs(data.items || [])
    if (!orgId && data.items?.length) setOrgId(data.items[0].id)
  }
  const loadCalendars = async (oid: string) => {
    if (!oid) return
    const res = await fetch(`/api/holidays/calendar/list?org_id=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setCalendars(data.items || [])
    setActiveCalId(data.active_calendar_id || '')
  }
  const setActive = async (oid: string, cid: string) => {
    if (!oid || !cid) return
    await fetch(`/api/holidays/calendar/list`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ org_id: oid, calendar_id: cid }) })
    loadCalendars(oid)
    loadHolidays(cid, year)
  }
  const loadHolidays = async (cid: string, yr: number) => {
    if (!cid) { setHolidays([]); return }
    const res = await fetch(`/api/holidays/holiday/list?calendar_id=${cid}&year=${yr}`, { cache: 'no-store' })
    const data = await res.json()
    setHolidays(data.items || [])
  }
  const createCalendar = async () => {
    if (!orgId || !newCalendar.name.trim()) return
    await fetch(`/api/holidays/calendar/create`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ org_id: orgId, name: newCalendar.name, country_code: newCalendar.countryCode }) })
    setCreateCalOpen(false)
    setNewCalendar({ name:'', countryCode:'' })
    loadCalendars(orgId)
  }
  const addHolidayRow = async () => {
    if (!activeCalId || !newHoliday.date || !newHoliday.name.trim()) return
    await fetch(`/api/holidays/holiday/add`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ calendar_id: activeCalId, date: newHoliday.date, name: newHoliday.name, is_full_day: newHoliday.isFullDay }) })
    setAddOpen(false)
    setNewHoliday({ date:'', name:'', isFullDay:true })
    loadHolidays(activeCalId, year)
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadCalendars(orgId) }, [orgId])
  useEffect(()=>{ if (activeCalId) loadHolidays(activeCalId, year) }, [activeCalId, year])

  const holidayColumns = ['Date','Name','Type']
  const holidayRows = holidays.map(h => [ h.date, h.name, h.isFullDay ? 'Full-day' : 'Partial' ])

  return (
    <AppShell title="Holiday Calendars">
      <GlassCard title="Organization & Active Calendar">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Active calendar</div>
            <GlassSelect value={activeCalId} onChange={(e:any)=> setActive(orgId, e.target.value)}>
              <option value="">Select calendar</option>
              {calendars.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </GlassSelect>
          </div>
          <div className="row" style={{ alignItems:'end', gap:8 }}>
            <GlassButton variant="primary" onClick={()=>setCreateCalOpen(true)} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Create Calendar</GlassButton>
            {activeCalId && <GlassButton variant="secondary" onClick={()=>setAddOpen(true)} style={{ background:'rgba(255,255,255,0.6)' }}>Add Holiday</GlassButton>}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Holidays">
        <div className="row" style={{ gap:12, alignItems:'center' }}>
          <div className="label">Year</div>
          <input className="input" type="number" value={year} onChange={e=>setYear(Number(e.target.value))} />
        </div>
        <GlassTable columns={holidayColumns} rows={holidayRows} />
      </GlassCard>

      <GlassModal open={createCalOpen} title="Create Calendar" onClose={()=>setCreateCalOpen(false)}>
        <div className="label">Name</div>
        <input className="input" value={newCalendar.name} onChange={e=>setNewCalendar({ ...newCalendar, name: e.target.value })} />
        <div className="label" style={{ marginTop:12 }}>Country Code</div>
        <input className="input" value={newCalendar.countryCode} onChange={e=>setNewCalendar({ ...newCalendar, countryCode: e.target.value })} />
        <div className="row" style={{ gap:8, marginTop:12 }}>
          <GlassButton variant="primary" onClick={createCalendar} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Create</GlassButton>
          <GlassButton variant="secondary" onClick={()=>setCreateCalOpen(false)}>Cancel</GlassButton>
        </div>
      </GlassModal>

      <GlassModal open={addOpen} title="Add Holiday" onClose={()=>setAddOpen(false)}>
        <div className="label">Date</div>
        <input className="input" type="date" value={newHoliday.date} onChange={e=>setNewHoliday({ ...newHoliday, date: e.target.value })} />
        <div className="label" style={{ marginTop:12 }}>Name</div>
        <input className="input" value={newHoliday.name} onChange={e=>setNewHoliday({ ...newHoliday, name: e.target.value })} />
        <div className="row" style={{ gap:12, marginTop:12 }}>
          <label className="row" style={{ gap:8 }}>
            <input type="checkbox" checked={newHoliday.isFullDay} onChange={e=>setNewHoliday({ ...newHoliday, isFullDay: e.target.checked })} />
            <span>Full-day</span>
          </label>
        </div>
        <div className="row" style={{ gap:8, marginTop:12 }}>
          <GlassButton variant="primary" onClick={addHolidayRow} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Add</GlassButton>
          <GlassButton variant="secondary" onClick={()=>setAddOpen(false)}>Cancel</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
