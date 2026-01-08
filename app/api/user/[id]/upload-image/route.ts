import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, isSupabaseConfigured } from '@lib/supabase'
import { updateUser } from '@lib/db'
import { checkPermission } from '@lib/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  // Security check: Ensure the requester is the user or an admin
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_users') : false
  const self = actor && actor === params.id

  if (!allowed && !self) {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'You do not have permission to upload this image.' }, { status: 403 })
  }
  
  // Note: We are using the Service Role client, so we have full access.
  const sb = supabaseServer()
  
  // Ensure bucket exists (idempotent-ish check)
  const { data: buckets } = await sb.storage.listBuckets()
  const bucketName = 'profile-images'
  const bucketExists = buckets?.find(b => b.name === bucketName)
  
  if (!bucketExists) {
    await sb.storage.createBucket(bucketName, { public: true })
  } else if (!bucketExists.public) {
    await sb.storage.updateBucket(bucketName, { public: true })
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `${params.id}/${Date.now()}.${fileExt}`

  // Convert file to ArrayBuffer for upload
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await sb.storage
    .from(bucketName)
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true
    })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }

  const { data: { publicUrl } } = sb.storage
    .from(bucketName)
    .getPublicUrl(fileName)

  // Update user profile with new image URL
  // Bypassing updateUser wrapper to ensure direct DB update
  const { data: updatedData, error: dbError } = await sb
    .from('users')
    .update({ 
      profile_image: publicUrl,
      updated_at: new Date()
    })
    .eq('id', params.id)
    .select()
    .single()

  if (dbError) {
    console.error('Failed to update user profile with image URL:', dbError)
    return NextResponse.json({ error: 'Failed to save image URL to profile' }, { status: 500 })
  }
  
  if (!updatedData) {
     console.error('Update operation returned no data. User ID might be incorrect:', params.id)
     return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 })
  }

  // Also call updateUser for in-memory sync if needed (optional, but good for consistency if memory mode is used)
  // await updateUser(params.id, { profileImage: publicUrl })

  return NextResponse.json({ 
    url: publicUrl,
    debug: {
      isSupabaseConfigured: isSupabaseConfigured(),
      updatedId: updatedData.id,
      imageSaved: updatedData.profile_image
    }
  })
}
