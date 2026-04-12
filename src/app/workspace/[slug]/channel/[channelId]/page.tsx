import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChannelView from '@/components/chat/ChannelView'

export default async function ChannelPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string; channelId: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const { slug, channelId } = await params
  const sp = await searchParams
  const autoJoinHuddle = sp.join_huddle === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?next=/workspace/${slug}/channel/${channelId}${autoJoinHuddle ? '?join_huddle=1' : ''}`)

  const { data: channel } = await supabase
    .from('channels').select('*').eq('id', channelId).single()
  if (!channel) redirect(`/workspace/${slug}`)

  // Auto-join public channel
  const { data: membership } = await supabase
    .from('channel_members').select('id')
    .eq('channel_id', channelId).eq('user_id', user.id).single()
  if (!membership && !channel.is_private) {
    await supabase.from('channel_members').insert({ channel_id: channelId, user_id: user.id })
  }

  await supabase.from('channel_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('channel_id', channelId).eq('user_id', user.id)

  const { data: messages } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(id, full_name, username, avatar_url, status), reactions(id, emoji, user_id, profiles(id, full_name))')
    .eq('channel_id', channelId)
    .is('thread_parent_id', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: channelMembers } = await supabase
    .from('channel_members')
    .select('*, profiles(id, full_name, username, avatar_url, status)')
    .eq('channel_id', channelId)

  const { data: huddle } = await supabase
    .from('huddles')
    .select('*, huddle_participants(user_id, profiles(id, full_name, avatar_url))')
    .eq('channel_id', channelId).eq('is_active', true).single()

  return (
    <ChannelView
      channel={channel}
      initialMessages={(messages || []).reverse()}
      channelMembers={channelMembers || []}
      currentUserId={user.id}
      workspaceSlug={slug}
      activeHuddle={huddle}
      autoJoinHuddle={autoJoinHuddle}
    />
  )
}
