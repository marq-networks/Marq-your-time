import { Client, Project, Task, ProjectMember } from './types'
import { isSupabaseConfigured, supabaseServer } from './supabase'
import { newId } from './token'

// In-memory stores for testing without DB
const clients: Client[] = []
const projects: Project[] = []
const tasks: Task[] = []

// Clients
export async function listClients(orgId: string): Promise<Client[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('clients').select('*').eq('org_id', orgId).order('name')
    return (data || []).map(mapClientFromRow)
  }
  return clients.filter(c => c.orgId === orgId)
}

export async function createClient(input: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = Date.now()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = {
      org_id: input.orgId,
      name: input.name,
      email: input.email,
      address: input.address,
      currency: input.currency,
      status: input.status,
      created_at: new Date(now),
      updated_at: new Date(now)
    }
    const { data, error } = await sb.from('clients').insert(payload).select('*').single()
    if (error) {
      console.error('createClient error:', error)
      return null
    }
    return mapClientFromRow(data)
  }
  const client: Client = {
    id: newId(),
    orgId: input.orgId,
    name: input.name,
    email: input.email,
    address: input.address,
    currency: input.currency,
    status: input.status,
    createdAt: now,
    updatedAt: now
  }
  clients.push(client)
  return client
}

export async function updateClient(id: string, patch: Partial<Client>) {
    const now = Date.now()
    if (isSupabaseConfigured()) {
        const sb = supabaseServer()
        const payload: any = { updated_at: new Date(now) }
        if (patch.name) payload.name = patch.name
        if (patch.email !== undefined) payload.email = patch.email
        if (patch.address !== undefined) payload.address = patch.address
        if (patch.currency) payload.currency = patch.currency
        if (patch.status) payload.status = patch.status
        const { data, error } = await sb.from('clients').update(payload).eq('id', id).select('*').single()
        if (error) return null
        return mapClientFromRow(data)
    }
    const client = clients.find(c => c.id === id)
    if (!client) return null
    if (patch.name) client.name = patch.name
    if (patch.email !== undefined) client.email = patch.email
    if (patch.address !== undefined) client.address = patch.address
    if (patch.currency) client.currency = patch.currency
    if (patch.status) client.status = patch.status
    client.updatedAt = now
    return client
}

// Projects
export async function listProjects(orgId: string, clientId?: string): Promise<Project[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('projects').select('*').eq('org_id', orgId).order('name')
    if (clientId) q = q.eq('client_id', clientId)
    const { data } = await q
    return (data || []).map(mapProjectFromRow)
  }
  return projects.filter(p => p.orgId === orgId && (!clientId || p.clientId === clientId))
}

export async function createProject(input: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    if (isSupabaseConfigured()) {
        const sb = supabaseServer()
        const payload = {
            org_id: input.orgId,
            client_id: input.clientId,
            name: input.name,
            code: input.code,
            description: input.description,
            status: input.status,
            budget_type: input.budgetType,
            budget_value: input.budgetValue,
            start_date: input.startDate,
            end_date: input.endDate,
            manager_id: input.managerId,
            is_billable: input.isBillable,
            created_at: new Date(now),
            updated_at: new Date(now)
        }
        const { data, error } = await sb.from('projects').insert(payload).select('*').single()
        if (error) {
            console.error('createProject error:', error)
            return null
        }
        return mapProjectFromRow(data)
    }
    const project: Project = {
        id: newId(),
        orgId: input.orgId,
        clientId: input.clientId,
        name: input.name,
        code: input.code,
        description: input.description,
        status: input.status,
        budgetType: input.budgetType,
        budgetValue: input.budgetValue,
        startDate: input.startDate,
        endDate: input.endDate,
        managerId: input.managerId,
        isBillable: input.isBillable,
        createdAt: now,
        updatedAt: now
    }
    projects.push(project)
    return project
}

export async function updateProject(id: string, patch: Partial<Project>) {
    const now = Date.now()
    if (isSupabaseConfigured()) {
        const sb = supabaseServer()
        const payload: any = { updated_at: new Date(now) }
        if (patch.name) payload.name = patch.name
        if (patch.clientId !== undefined) payload.client_id = patch.clientId
        if (patch.code !== undefined) payload.code = patch.code
        if (patch.description !== undefined) payload.description = patch.description
        if (patch.status) payload.status = patch.status
        if (patch.budgetType) payload.budget_type = patch.budgetType
        if (patch.budgetValue !== undefined) payload.budget_value = patch.budgetValue
        if (patch.startDate !== undefined) payload.start_date = patch.startDate
        if (patch.endDate !== undefined) payload.end_date = patch.endDate
        if (patch.managerId !== undefined) payload.manager_id = patch.managerId
        if (patch.isBillable !== undefined) payload.is_billable = patch.isBillable
        
        const { data, error } = await sb.from('projects').update(payload).eq('id', id).select('*').single()
        if (error) return null
        return mapProjectFromRow(data)
    }
    const project = projects.find(p => p.id === id)
    if (!project) return null
    if (patch.name) project.name = patch.name
    if (patch.clientId !== undefined) project.clientId = patch.clientId
    if (patch.code !== undefined) project.code = patch.code
    if (patch.description !== undefined) project.description = patch.description
    if (patch.status) project.status = patch.status
    if (patch.budgetType) project.budgetType = patch.budgetType
    if (patch.budgetValue !== undefined) project.budgetValue = patch.budgetValue
    if (patch.startDate !== undefined) project.startDate = patch.startDate
    if (patch.endDate !== undefined) project.endDate = patch.endDate
    if (patch.managerId !== undefined) project.managerId = patch.managerId
    if (patch.isBillable !== undefined) project.isBillable = patch.isBillable
    project.updatedAt = now
    return project
}

// Tasks
export async function listTasks(projectId: string): Promise<Task[]> {
    if (isSupabaseConfigured()) {
        const sb = supabaseServer()
        const { data } = await sb.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
        return (data || []).map(mapTaskFromRow)
    }
    return tasks.filter(t => t.projectId === projectId)
}

export async function listMyTasks(memberId: string, orgId: string): Promise<Task[]> {
    if (isSupabaseConfigured()) {
        const sb = supabaseServer()
        const { data } = await sb.from('tasks').select('*').eq('org_id', orgId).eq('assignee_id', memberId).neq('status', 'done').order('priority')
        return (data || []).map(mapTaskFromRow)
    }
    return tasks.filter(t => t.orgId === orgId && t.assigneeId === memberId && t.status !== 'done')
}

export async function createTask(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    if (isSupabaseConfigured()) {
        const sb = supabaseServer()
        const payload = {
            org_id: input.orgId,
            project_id: input.projectId,
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            assignee_id: input.assigneeId,
            reporter_id: input.reporterId,
            due_date: input.dueDate,
            estimated_hours: input.estimatedHours,
            created_at: new Date(now),
            updated_at: new Date(now)
        }
        const { data, error } = await sb.from('tasks').insert(payload).select('*').single()
        if (error) {
            console.error('createTask error:', error)
            return null
        }
        return mapTaskFromRow(data)
    }
    const task: Task = {
        id: newId(),
        orgId: input.orgId,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        reporterId: input.reporterId,
        dueDate: input.dueDate,
        estimatedHours: input.estimatedHours,
        createdAt: now,
        updatedAt: now
    }
    tasks.push(task)
    return task
}

export async function updateTask(id: string, patch: Partial<Task>) {
    const now = Date.now()
    if (isSupabaseConfigured()) {
        const sb = supabaseServer()
        const payload: any = { updated_at: new Date(now) }
        if (patch.title) payload.title = patch.title
        if (patch.description !== undefined) payload.description = patch.description
        if (patch.status) payload.status = patch.status
        if (patch.priority) payload.priority = patch.priority
        if (patch.assigneeId !== undefined) payload.assignee_id = patch.assigneeId
        if (patch.projectId) payload.project_id = patch.projectId
        if (patch.dueDate !== undefined) payload.due_date = patch.dueDate
        if (patch.estimatedHours !== undefined) payload.estimated_hours = patch.estimatedHours

        const { data, error } = await sb.from('tasks').update(payload).eq('id', id).select('*').single()
        if (error) return null
        return mapTaskFromRow(data)
    }
    const task = tasks.find(t => t.id === id)
    if (!task) return null
    if (patch.title) task.title = patch.title
    if (patch.description !== undefined) task.description = patch.description
    if (patch.status) task.status = patch.status
    if (patch.priority) task.priority = patch.priority
    if (patch.assigneeId !== undefined) task.assigneeId = patch.assigneeId
    if (patch.projectId) task.projectId = patch.projectId
    if (patch.dueDate !== undefined) task.dueDate = patch.dueDate
    if (patch.estimatedHours !== undefined) task.estimatedHours = patch.estimatedHours
    task.updatedAt = now
    return task
}

// Mappers
function mapClientFromRow(row: any): Client {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email,
    address: row.address,
    currency: row.currency,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapProjectFromRow(row: any): Project {
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    budgetType: row.budget_type,
    budgetValue: Number(row.budget_value || 0),
    startDate: row.start_date,
    endDate: row.end_date,
    managerId: row.manager_id,
    isBillable: row.is_billable,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapTaskFromRow(row: any): Task {
  return {
    id: row.id,
    orgId: row.org_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    reporterId: row.reporter_id,
    dueDate: row.due_date,
    estimatedHours: Number(row.estimated_hours || 0),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}
