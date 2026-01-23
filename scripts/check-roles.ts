
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const sb = createClient(supabaseUrl, supabaseServiceKey)

async function checkRoles() {
  const { data: roles, error } = await sb.from('roles').select('*')
  console.log('All Roles:', JSON.stringify(roles, null, 2))
}

checkRoles()
