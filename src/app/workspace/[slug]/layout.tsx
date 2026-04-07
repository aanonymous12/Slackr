export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WorkspaceClient from './WorkspaceClient'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: workspace } = await supabase
    .from('workspaces').select('*').eq('slug', slug).single()
  if (!workspace) redirect('/workspace/new')

  const { data: membership } = await supabase
    .from('workspace_members').select('*')
    .eq('workspace_id', workspace.id).eq('user_id', user.id).single()
  if (!membership) redirect('/workspace/new')

  // All workspaces for switcher
  const { data: allWorkspaces } = await supabase
    .from('workspace_members')
    .select('workspaces(id, name, slug, icon_color, icon_letter)')
    .eq('user_id', user.id)

  // ALL public channels in this workspace (not just ones user joined)
  // User auto-joins public channels when they open them
  const { data: allPublicChannels } = await supabase
    .from('channels')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('is_private', false)
    .eq('is_archived', false)
    .order('name')

  // Private channels the user is a member of
  const { data: privateChannels } = await supabase
    .from('channel_members')
    .select('channels!inner(*)')
    .eq('user_id', user.id)
    .eq('channels.workspace_id', workspace.id)
    .eq('channels.is_private', true)
    .eq('channels.is_archived', false)

  // Merge: all public + user's private channels, deduplicated
  const publicList = allPublicChannels || []
  const privateList = (privateChannels || [])
    .map((m: Record<string, unknown>) => m.channels as Record<string, unknown>)
    .filter(Boolean)
  const channelMap = new Map<string, Record<string, unknown>>()
  ;[...publicList, ...privateList].forEach(c => { if (c?.id) channelMap.set(String(c.id), c) })
  const channels = Array.from(channelMap.values()).sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  )

  // All DM conversations for this user (across workspace)
  const { data: conversations } = await supabase
    .from('conversation_members')
    .select(`
      conversations(
        id, is_group, name, created_at, workspace_id,
        conversation_members(user_id, profiles(id, full_name, username, avatar_url, status))
      )
    `)
    .eq('user_id', user.id)

  // Filter to this workspace only
  const wsConversations = (conversations || []).filter(m => {
    const conv = (m as Record<string, unknown>).conversations as Record<string, unknown>
    return conv?.workspace_id === workspace.id
  })

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: members } = await supabase
    .from('workspace_members')
    .select('*, profiles(id, full_name, username, avatar_url, status, email)')
    .eq('workspace_id', workspace.id)

  const workspaceList = (allWorkspaces || [])
    .map((m: Record<string, unknown>) => m.workspaces as Record<string, unknown>)
    .filter((w): w is Record<string, unknown> => Boolean(w))

  return (
    <WorkspaceClient
      workspace={workspace}
      workspaces={workspaceList}
      channels={channels}
      allChannels={channels}
      conversations={wsConversations}
      profile={profile}
      members={members || []}
      membership={membership}
      currentUserId={user.id}
    >
      {children}
    </WorkspaceClient>
  )
}
