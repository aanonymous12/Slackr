import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const admin = adminClient()

  // Must be owner
  const { data: ws } = await admin
    .from('workspaces').select('owner_id, name').eq('id', workspace_id).single()
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ws.owner_id !== user.id) return NextResponse.json({ error: 'Only the owner can delete this workspace' }, { status: 403 })

  // Cascade delete everything (FK cascades handle most, but messages need manual cleanup first)
  await admin.from('messages').delete().in(
    'channel_id',
    (await admin.from('channels').select('id').eq('workspace_id', workspace_id)).data?.map(c => c.id) || []
  )
  const { error } = await admin.from('workspaces').delete().eq('id', workspace_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
