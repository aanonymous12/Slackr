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

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const admin = adminClient()
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const uniqueSlug = `${slug}-${Date.now()}`

  const { data: ws, error: wsErr } = await admin
    .from('workspaces')
    .insert({ name: name.trim(), slug: uniqueSlug, icon_letter: name[0]?.toUpperCase(), owner_id: user.id })
    .select('id, slug')
    .single()
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })

  await admin.from('workspace_members').insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })

  const { data: channels } = await admin.from('channels').insert([
    { workspace_id: ws.id, name: 'general', description: 'Company-wide announcements', created_by: user.id },
    { workspace_id: ws.id, name: 'random', description: 'Non-work banter', created_by: user.id },
  ]).select('id')

  if (channels?.length) {
    await admin.from('channel_members').insert(channels.map(c => ({ channel_id: c.id, user_id: user.id })))
  }

  return NextResponse.json({ slug: ws.slug })
}
