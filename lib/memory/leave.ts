let types: any[] = []
let requests: any[] = []

function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8); return v.toString(16) }) }

export function seedDefaultTypesIfEmpty(org_id: string) {
  const has = types.some(t => t.org_id === org_id)
  if (!has) {
    const now = new Date().toISOString()
    types.push({ id: uuid(), org_id, code: 'annual', name: 'Annual Leave', description: '', paid: true, default_days_per_year: 20, is_active: true, created_at: now })
    types.push({ id: uuid(), org_id, code: 'sick', name: 'Sick Leave', description: '', paid: true, default_days_per_year: 10, is_active: true, created_at: now })
    types.push({ id: uuid(), org_id, code: 'unpaid', name: 'Unpaid Leave', description: '', paid: false, default_days_per_year: 0, is_active: true, created_at: now })
  }
}

export function listTypes(org_id: string) {
  return types.filter(t => t.org_id === org_id && t.is_active)
}

export function upsertType(input: { org_id: string, code: string, name: string, description?: string, paid?: boolean, default_days_per_year?: number }) {
  const idx = types.findIndex(t => t.org_id === input.org_id && t.code === input.code)
  const now = new Date().toISOString()
  const payload = { id: idx>=0 ? types[idx].id : uuid(), org_id: input.org_id, code: input.code, name: input.name, description: input.description || '', paid: !!input.paid, default_days_per_year: Number(input.default_days_per_year||0), is_active: true, created_at: now }
  if (idx >= 0) types[idx] = payload; else types.push(payload)
  return payload
}

export function daysBetween(start: string, end: string) { const s = new Date(start + 'T00:00:00Z'); const e = new Date(end + 'T00:00:00Z'); return Math.max(1, Math.round((e.getTime()-s.getTime())/(24*60*60*1000))+1) }

export function addRequest(input: { org_id: string, member_id: string, leave_type_id: string, start_date: string, end_date: string, reason?: string, created_by?: string }) {
  const now = new Date().toISOString()
  const item = { id: uuid(), org_id: input.org_id, member_id: input.member_id, leave_type_id: input.leave_type_id, start_date: input.start_date, end_date: input.end_date, days_count: daysBetween(input.start_date, input.end_date), status: 'pending', reason: input.reason || '', created_at: now, created_by: input.created_by || null, reviewed_at: null, reviewed_by: null, review_note: null }
  requests.push(item)
  return item
}

export function listMyRequests(member_id: string) {
  return requests.filter(r => r.member_id === member_id)
}

export function listRequests(input: { org_id: string, status?: string, member_id?: string, start_date?: string, end_date?: string }) {
  let arr = requests.filter(r => r.org_id === input.org_id)
  if (input.status) arr = arr.filter(r => r.status === input.status)
  if (input.member_id) arr = arr.filter(r => r.member_id === input.member_id)
  if (input.start_date && input.end_date) arr = arr.filter(r => r.start_date <= input.end_date! && r.end_date >= input.start_date!)
  return arr
}

export function reviewRequest(id: string, status: 'approved'|'rejected', note: string, reviewer?: string) {
  const idx = requests.findIndex(r => r.id === id)
  if (idx < 0) return null
  const now = new Date().toISOString()
  requests[idx] = { ...requests[idx], status, review_note: note, reviewed_by: reviewer || null, reviewed_at: now }
  return requests[idx]
}

