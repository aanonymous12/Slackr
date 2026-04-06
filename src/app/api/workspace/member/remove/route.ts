import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, target_user_id } = await req.json()
  if (!workspace_id || !target_user_id) {
    return NextResponse.json({ error: 'workspace_id and target_user_id required' }, { status: 400 })
  }

  const admin = adminClient()

  // Requester must be admin/owner, OR removing themselves
  const { data: myMembership } = await admin
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', user.id).single()

  const isSelf = target_user_id === user.id
  const isAdmin = ['owner', 'admin'].includes(myMembership?.role || '')

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Cannot remove the owner
  const { data: targetMembership } = await admin
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', target_user_id).single()
  if (targetMembership?.role === 'owner' && !isSelf) {
    return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 400 })
  }

  // Remove from all channels in this workspace
  const { data: channels } = await admin
    .from('channels').select('id').eq('workspace_id', workspace_id)
  if (channels?.length) {
    await admin.from('channel_members').delete()
      .eq('user_id', target_user_id)
      .in('channel_id', channels.map(c => c.id))
  }

  // Remove from workspace
  const { error } = await admin.from('workspace_members').delete()
    .eq('workspace_id', workspace_id).eq('user_id', target_user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
