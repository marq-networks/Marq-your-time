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
    const ext = file.name.split('.').pop()
    const fileName = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    
    // Convert File to ArrayBuffer for Supabase upload
    const buffer = await file.arrayBuffer()
    
    const { data, error } = await sb.storage
      .from('hr-adjustments')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
    }

    // Get public URL (or just return path)
    const { data: publicUrl } = sb.storage.from('hr-adjustments').getPublicUrl(fileName)
    
    return NextResponse.json({ path: fileName, url: publicUrl.publicUrl })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
