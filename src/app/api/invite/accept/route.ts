import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = adminClient()

  // 1. Look up invite — admin client bypasses all RLS
  const { data: invite, error: inviteErr } = await admin
    .from('invites')
    .select('id, workspace_id, email, role, accepted_at, expires_at')
    .eq('token', token)
    .single()

  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (invite.accepted_at) {
    // Already accepted — still let them in if they are the right person
    // (handles double-click / retry gracefully)
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 })
  }

  // 2. Get workspace
  const { data: workspace } = await admin
    .from('workspaces')
    .select('id, name, slug, icon_color, icon_letter')
    .eq('id', invite.workspace_id)
    .single()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  // 3. Verify the calling user is authenticated (session cookie on request)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated', workspace_name: workspace.name }, { status: 401 })
  }

  // 4. Ensure profile exists for this user (admin bypasses RLS)
  await admin.from('profiles').upsert({
    id: user.id,
    email: user.email!,
    full_name: user.user_metadata?.full_name || user.email!.split('@')[0],
    username: user.email!.split('@')[0] + '_' + Math.floor(Math.random() * 9000 + 1000),
    status: 'active',
  }, { onConflict: 'id', ignoreDuplicates: true })

  // 5. Add user to workspace
  await admin.from('workspace_members').upsert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: invite.role || 'member',
  }, { onConflict: 'workspace_id,user_id', ignoreDuplicates: true })

  // 6. Join all public channels (general, random, announcements, etc.)
  const { data: publicChannels } = await admin
    .from('channels')
    .select('id, name')
    .eq('workspace_id', workspace.id)
    .eq('is_private', false)
    .eq('is_archived', false)

  if (publicChannels?.length) {
    await admin.from('channel_members').upsert(
      publicChannels.map(c => ({ channel_id: c.id, user_id: user.id })),
      { onConflict: 'channel_id,user_id', ignoreDuplicates: true }
    )
  }

  // 7. Mark invite accepted (only if not already)
  if (!invite.accepted_at) {
    await admin
      .from('invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)
  }

  return NextResponse.json({
    success: true,
    slug: workspace.slug,
    workspace_name: workspace.name,
    channels_joined: publicChannels?.map(c => c.name) || [],
  })
}
