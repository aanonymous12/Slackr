import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id } = await req.json()
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const admin = adminClient()

  // Get channel info
  const { data: channel } = await admin
    .from('channels')
    .select('id, workspace_id, created_by, name')
    .eq('id', channel_id)
    .single()
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  // Check permission: must be creator OR admin/owner of workspace
  const { data: membership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', channel.workspace_id)
    .eq('user_id', user.id)
    .single()

  const isCreator = channel.created_by === user.id
  const isAdmin = ['owner', 'admin'].includes(membership?.role || '')

  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Prevent deleting general/random
  if (['general', 'random'].includes(channel.name)) {
    return NextResponse.json({ error: 'Cannot delete default channels' }, { status: 400 })
  }

  const { error } = await admin.from('channels').delete().eq('id', channel_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
