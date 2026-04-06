import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = adminClient()

  // Look up invite (admin bypasses RLS)
  const { data: invite } = await admin
    .from('invites')
    .select('*, workspaces(id, name, slug)')
    .eq('token', token)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (!invite) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })

  // Get authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Must be logged in' }, { status: 401 })

  const workspace = invite.workspaces as Record<string, unknown>

  // Add to workspace (admin bypasses RLS)
  await admin.from('workspace_members').upsert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: invite.role || 'member',
  }, { onConflict: 'workspace_id,user_id' })

  // Join all public channels
  const { data: publicChannels } = await admin
    .from('channels')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('is_private', false)

  if (publicChannels?.length) {
    await admin.from('channel_members').upsert(
      publicChannels.map(c => ({ channel_id: c.id, user_id: user.id })),
      { onConflict: 'channel_id,user_id' }
    )
  }

  // Mark invite accepted
  await admin.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id)

  return NextResponse.json({ slug: workspace.slug })
}
