import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { sendInviteEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, email, role } = await req.json()
  if (!workspace_id || !email?.trim()) {
    return NextResponse.json({ error: 'workspace_id and email required' }, { status: 400 })
  }

  const admin = adminClient()

  // Verify sender is a workspace member
  const { data: myMembership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single()
  if (!myMembership) return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 })

  // Get workspace name
  const { data: workspace } = await admin
    .from('workspaces')
    .select('name, slug')
    .eq('id', workspace_id)
    .single()
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // Check if user is already a member by email
  const { data: existingUser } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email.trim())
    .single()

  if (existingUser) {
    const { data: alreadyMember } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', existingUser.id)
      .single()
    if (alreadyMember) {
      return NextResponse.json({ error: 'This person is already a member of this workspace' }, { status: 409 })
    }
  }

  // Delete any existing unused invite for this email+workspace
  await admin.from('invites')
    .delete()
    .eq('workspace_id', workspace_id)
    .eq('email', email.trim())
    .is('accepted_at', null)

  // Create invite record
  const { data: invite, error: inviteErr } = await admin
    .from('invites')
    .insert({
      workspace_id,
      invited_by: user.id,
      email: email.trim(),
      role: role || 'member',
    })
    .select('token')
    .single()

  if (inviteErr || !invite) {
    return NextResponse.json({ error: inviteErr?.message || 'Failed to create invite' }, { status: 500 })
  }

  // Get inviter's name
  const { data: inviterProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Someone'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
  const inviteUrl = `${appUrl}/invite/${invite.token}`

  // Send the actual email
  try {
    await sendInviteEmail({
      to: email.trim(),
      inviterName: String(inviterName),
      workspaceName: workspace.name,
      inviteUrl,
      role: role || 'member',
      appUrl,
    })
  } catch (emailErr) {
    // Delete the invite if email fails so we don't leave orphaned records
    await admin.from('invites').delete().eq('token', invite.token)
    console.error('Email send failed:', emailErr)
    return NextResponse.json({
      error: 'Failed to send email. Check GMAIL_USER and GMAIL_APP_PASSWORD env vars.',
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Invite sent to ${email.trim()}`,
    invite_url: inviteUrl, // also return URL for copying
  })
}
