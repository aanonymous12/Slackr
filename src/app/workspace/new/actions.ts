'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createWorkspace(name: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const uniqueSlug = `${slug}-${Date.now()}`

  // Step 1: Insert workspace (RLS: workspaces_insert allows authenticated users)
  const { data: ws, error: wsErr } = await supabase
    .from('workspaces')
    .insert({
      name,
      slug: uniqueSlug,
      icon_letter: name[0]?.toUpperCase(),
      owner_id: user.id,
    })
    .select('id, slug')
    .single()

  if (wsErr || !ws) {
    return { error: wsErr?.message || 'Failed to create workspace' }
  }

  // Step 2: Add creator as owner FIRST (unlocks all subsequent RLS checks)
  const { error: memberErr } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })

  if (memberErr) {
    return { error: memberErr.message }
  }

  // Step 3: Create default channels (now RLS allows it - user is a member)
  const { data: channels, error: chanErr } = await supabase
    .from('channels')
    .insert([
      { workspace_id: ws.id, name: 'general', description: 'Company-wide announcements', created_by: user.id },
      { workspace_id: ws.id, name: 'random', description: 'Non-work banter and water cooler talk', created_by: user.id },
    ])
    .select('id')

  if (chanErr) {
    return { error: chanErr.message }
  }

  // Step 4: Join creator to default channels
  if (channels && channels.length > 0) {
    await supabase
      .from('channel_members')
      .insert(channels.map(c => ({ channel_id: c.id, user_id: user.id })))
  }

  return { slug: ws.slug }
}
