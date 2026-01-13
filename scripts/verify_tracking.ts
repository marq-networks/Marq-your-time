import { startWorkSession, stopWorkSession, getOpenSession } from '../lib/db'
import { createClient, createProject, createTask } from '../lib/tracking_db'
import { newId } from '../lib/token'

// Mock environment for testing
const orgId = 'org-test-123'
const memberId = 'user-test-456'

async function runTest() {
  console.log('--- Starting Tracking Verification ---')

  // 1. Create Hierarchy
  console.log('\n1. Creating Client...')
  const client = await createClient({
    orgId,
    name: 'Acme Corp',
    currency: 'USD',
    status: 'active'
  })
  console.log('   Client created:', client ? 'OK' : 'FAIL')

  console.log('\n2. Creating Project...')
  const project = await createProject({
    orgId,
    clientId: client?.id,
    name: 'Website Redesign',
    status: 'active',
    budgetType: 'hours',
    budgetValue: 100,
    isBillable: true
  })
  console.log('   Project created:', project ? 'OK' : 'FAIL')

  console.log('\n3. Creating Task...')
  const taskA = await createTask({
    orgId,
    projectId: project?.id || 'mock-proj',
    title: 'Design Homepage',
    status: 'todo',
    priority: 'high'
  })
  const taskB = await createTask({
    orgId,
    projectId: project?.id || 'mock-proj',
    title: 'Implement API',
    status: 'todo',
    priority: 'medium'
  })
  console.log('   Tasks created:', taskA && taskB ? 'OK' : 'FAIL')

  // 2. Start Session on Task A
  console.log('\n4. Starting Session for Task A...')
  const session1 = await startWorkSession({
    memberId,
    orgId,
    source: 'web',
    projectId: project?.id,
    taskId: taskA?.id
  })
  if (typeof session1 === 'string') {
    console.error('   FAIL: Could not start session 1:', session1)
  } else {
    console.log('   Session 1 started:', session1.taskId === taskA?.id ? 'OK' : 'FAIL')
  }

  // 3. Switch to Task B (should auto-close Task A)
  console.log('\n5. Switching to Task B (should auto-close previous)...')
  // Wait a moment to ensure timestamps differ slightly
  await new Promise(r => setTimeout(r, 10))
  
  const session2 = await startWorkSession({
    memberId,
    orgId,
    source: 'web',
    projectId: project?.id,
    taskId: taskB?.id
  })
  
  if (typeof session2 === 'string') {
    console.error('   FAIL: Could not start session 2:', session2)
    return
  }

  // Verify Session 2 is open and on Task B
  console.log('   Session 2 active:', session2.taskId === taskB?.id ? 'OK' : 'FAIL')
  
  // Verify Session 1 is closed (we can't easily fetch closed sessions from here without extra DB calls, 
  // but we can check that getOpenSession returns Session 2)
  const currentOpen = await getOpenSession(memberId, orgId)
  if (typeof currentOpen === 'string' || !currentOpen) {
      console.log('   Current Open Session check failed or empty')
  } else {
      console.log('   Current Open Session ID matches Session 2:', currentOpen.id === session2.id ? 'OK' : 'FAIL')
  }

  // 4. Stop Session
  console.log('\n6. Stopping Work...')
  const stopped = await stopWorkSession({ memberId, orgId })
  if (typeof stopped === 'string') {
      console.error('   FAIL: Could not stop session:', stopped)
  } else {
      console.log('   Session stopped:', stopped.status === 'closed' ? 'OK' : 'FAIL')
  }

  console.log('\n--- Verification Complete ---')
}

// Run if called directly
runTest().catch(console.error)
