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

  const { workspace_id, name, description, is_private } = await req.json()
  if (!workspace_id || !name?.trim()) return NextResponse.json({ error: 'workspace_id and name required' }, { status: 400 })

  const admin = adminClient()

  // Verify user is actually a member of this workspace
  const { data: membership } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 })

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data: ch, error } = await admin
    .from('channels')
    .insert({ workspace_id, name: slug, description: description || null, is_private: is_private ?? false, created_by: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-join creator
  await admin.from('channel_members').insert({ channel_id: ch.id, user_id: user.id })

  return NextResponse.json({ channel: ch })
}
