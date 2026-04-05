import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DMView from '@/components/chat/DMView'

export default async function DMPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>
}) {
  const { slug, conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Verify membership
  const { data: membership } = await supabase
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect(`/workspace/${slug}`)

  // Update last_read
  await supabase.from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  // Load conversation + members
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, conversation_members(user_id, profiles(id, full_name, username, avatar_url, status))')
    .eq('id', conversationId)
    .single()

  // Load messages
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, username, avatar_url, status),
      reactions(id, emoji, user_id, profiles(id, full_name))
    `)
    .eq('conversation_id', conversationId)
    .is('thread_parent_id', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <DMView
      conversation={conversation}
      initialMessages={(messages || []).reverse()}
      currentUserId={user.id}
      workspaceSlug={slug}
    />
  )
}
