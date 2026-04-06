import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = adminClient()
  const { data: invite } = await admin
    .from('invites')
    .select('email, role, expires_at, accepted_at, workspaces(id, name, slug, icon_color, icon_letter)')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Invite already used' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  const workspace = invite.workspaces as unknown as Record<string, unknown>
  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    workspace_name: workspace?.name,
    workspace_slug: workspace?.slug,
    icon_color: workspace?.icon_color,
    icon_letter: workspace?.icon_letter,
  })
}
