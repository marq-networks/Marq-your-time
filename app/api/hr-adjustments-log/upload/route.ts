import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const orgId = formData.get('orgId') as string
    
    if (!file || !orgId) {
      return NextResponse.json({ error: 'MISSING_FILE_OR_ORG' }, { status: 400 })
    }

    const sb = supabaseServer()

    // Permission Check
    let actorId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
    const isOrgLogin = req.cookies.get('org_login')?.value === 'true'

    if (!actorId && !isOrgLogin) {
       return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (isOrgLogin) {
      // Org login - allowed as admin for the org
      // We don't need strict user role check here as long as orgId matches context,
      // but here orgId comes from form data.
      // We should ideally verify orgId against cookie, but upload is just saving a file.
      // We'll rely on the client knowing the orgId.
      const cookieOrgId = req.cookies.get('current_org_id')?.value
      if (orgId !== cookieOrgId) {
         return NextResponse.json({ error: 'FORBIDDEN_ORG_MISMATCH' }, { status: 403 })
      }
    } else {
      const { data: userRow } = await sb.from('users').select('*, role:roles(name)').eq('id', actorId).eq('org_id', orgId).maybeSingle()
      const { data: memberRow } = await sb.from('org_memberships').select('role').eq('user_id', actorId).eq('org_id', orgId).maybeSingle()
      const effectiveRole = (userRow?.role?.name || memberRow?.role || '').toLowerCase()

      if (!effectiveRole || !['admin', 'super_admin', 'owner', 'manager'].includes(effectiveRole)) {
        return NextResponse.json({ error: 'FORBIDDEN', details: `Role ${effectiveRole} not allowed` }, { status: 403 })
      }
    }

    const ext = file.name.split('.').pop()
    const fileName = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    
    // Convert File to ArrayBuffer for Supabase upload
    const buffer = await file.arrayBuffer()
    
    // Ensure bucket exists
    const { data: bucket } = await sb.storage.getBucket('hr-adjustments')
    if (!bucket) {
      console.log('Bucket hr-adjustments not found, creating...')
      await sb.storage.createBucket('hr-adjustments', { public: false, fileSizeLimit: 5242880 }) // 5MB
    }

    const { data, error } = await sb.storage
      .from('hr-adjustments')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: 'UPLOAD_FAILED', details: error }, { status: 500 })
    }

    // Get public URL (or just return path)
    const { data: publicUrl } = sb.storage.from('hr-adjustments').getPublicUrl(fileName)
    
    return NextResponse.json({ path: fileName, url: publicUrl.publicUrl })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
