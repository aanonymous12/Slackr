import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = adminClient()

  const { data: invite, error } = await admin
    .from('invites')
    .select('id, email, role, expires_at, accepted_at, workspace_id')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired' }, { status: 410 })
  }

  // Get workspace details separately
  const { data: workspace } = await admin
    .from('workspaces')
    .select('id, name, slug, icon_color, icon_letter')
    .eq('id', invite.workspace_id)
    .single()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  return NextResponse.json({
    workspace_name: workspace.name,
    workspace_slug: workspace.slug,
    icon_color:     workspace.icon_color,
    icon_letter:    workspace.icon_letter,
    email:          invite.email,
    role:           invite.role,
  })
}
