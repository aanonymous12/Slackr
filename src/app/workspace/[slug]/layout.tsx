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

  // Get workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!workspace) redirect('/workspace/new')

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/workspace/new')

  // Get all workspaces for switcher
  const { data: allWorkspaces } = await supabase
    .from('workspace_members')
    .select('workspaces(id, name, slug, icon_color, icon_letter)')
    .eq('user_id', user.id)

  // Get channels
  const { data: channels } = await supabase
    .from('channels')
    .select('*, channel_members!inner(user_id)')
    .eq('workspace_id', workspace.id)
    .eq('channel_members.user_id', user.id)
    .eq('is_archived', false)
    .order('name')

  // Get all workspace channels (for browsing)
  const { data: allChannels } = await supabase
    .from('channels')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('is_private', false)
    .eq('is_archived', false)
    .order('name')

  // Get DMs (conversations)
  const { data: conversations } = await supabase
    .from('conversation_members')
    .select(`
      conversations(
        id, is_group, name, created_at,
        conversation_members(user_id, profiles(id, full_name, username, avatar_url, status))
      )
    `)
    .eq('user_id', user.id)

  // Get current user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('*, profiles(id, full_name, username, avatar_url, status, email)')
    .eq('workspace_id', workspace.id)

  const workspaceList = (allWorkspaces || [])
    .map((m: Record<string, unknown>) => m.workspaces as Record<string, unknown>)
    .filter((w): w is Record<string, unknown> => w !== null && w !== undefined)

  return (
    <WorkspaceClient
      workspace={workspace}
      workspaces={workspaceList}
      channels={channels || []}
      allChannels={allChannels || []}
      conversations={conversations || []}
      profile={profile}
      members={members || []}
      membership={membership}
      currentUserId={user.id}
    >
      {children}
    </WorkspaceClient>
  )
}
