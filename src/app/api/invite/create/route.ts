import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, email, role } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const admin = adminClient()

  // Verify sender is a member
  const { data: membership } = await admin
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 })

  // Create invite record
  const { data: invite, error } = await admin
    .from('invites')
    .insert({
      workspace_id,
      invited_by: user.id,
      email: email || 'open-invite@link',
      role: role || 'member',
    })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/invite/${invite.token}`
  return NextResponse.json({ token: invite.token, url: inviteUrl })
}
