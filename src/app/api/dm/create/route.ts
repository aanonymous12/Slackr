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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, target_user_ids } = await req.json()
  if (!workspace_id || !target_user_ids?.length) {
    return NextResponse.json({ error: 'workspace_id and target_user_ids required' }, { status: 400 })
  }

  const admin = adminClient()
  const allMembers: string[] = [user.id, ...target_user_ids.filter((id: string) => id !== user.id)]
  const isGroup = allMembers.length > 2

  // For 1:1 DMs, check if conversation already exists
  if (!isGroup) {
    const otherId = target_user_ids[0]
    const { data: existing } = await admin.rpc('find_dm_conversation', {
      user1: user.id,
      user2: otherId,
      workspace: workspace_id,
    })
    if (existing) return NextResponse.json({ conversation_id: existing })
  }

  // Create new conversation
  const { data: conv, error: convErr } = await admin
    .from('conversations')
    .insert({ workspace_id, is_group: isGroup })
    .select('id')
    .single()
  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

  // Add all members
  const { error: memberErr } = await admin
    .from('conversation_members')
    .insert(allMembers.map(uid => ({ conversation_id: conv.id, user_id: uid })))
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  return NextResponse.json({ conversation_id: conv.id })
}
