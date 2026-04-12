import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { channel_id, action, huddle_id: bodyHuddleId } = body
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const admin = adminClient()

  if (action === 'join') {
    // Get or create active huddle for this channel
    let { data: existingHuddle } = await admin
      .from('huddles')
      .select('id, started_by')
      .eq('channel_id', channel_id)
      .eq('is_active', true)
      .single()

    let huddleId: string
    const isNewHuddle = !existingHuddle

    if (!existingHuddle) {
      const { data: newHuddle } = await admin.from('huddles').insert({
        channel_id,
        started_by: user.id,
        is_active: true,
      }).select('id, started_by').single()
      huddleId = newHuddle!.id
    } else {
      huddleId = existingHuddle.id
    }

    // Record participant joining
    await admin.from('huddle_participants').upsert(
      { huddle_id: huddleId, user_id: user.id },
      { onConflict: 'huddle_id,user_id' }
    )

    // Get workspace_id for this channel (needed for notification URL)
    const { data: channelData } = await admin
      .from('channels')
      .select('workspace_id, workspaces(slug)')
      .eq('id', channel_id)
      .single()

    const wsSlug = (channelData?.workspaces as unknown as Record<string,unknown>)?.slug as string
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'
    // Deep link that auto-opens huddle: ?join_huddle=1
    const joinUrl = `${appUrl}/workspace/${wsSlug}/channel/${channel_id}?join_huddle=1`

    // Notify ALL workspace members only when FIRST person joins (huddle is new)
    // NOT on every click of Start Huddle
    if (isNewHuddle && channelData?.workspace_id) {
      // Fire and forget - don't await
      notifyWorkspaceMembers({
        userId: user.id,
        workspaceId: channelData.workspace_id as string,
        channelId: channel_id,
        channelName: body.channel_name || 'a channel',
        joinUrl,
        wsSlug,
        appUrl,
      }).catch(console.error)
    }

    return NextResponse.json({
      huddle_id: huddleId,
      join_url: joinUrl,
    })
  }

  if (action === 'leave') {
    const hid = bodyHuddleId
    if (hid) {
      await admin.from('huddle_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('huddle_id', hid)
        .eq('user_id', user.id)

      const { data: remaining } = await admin.from('huddle_participants')
        .select('id').eq('huddle_id', hid).is('left_at', null)

      if (!remaining?.length) {
        await admin.from('huddles')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('id', hid)
      }
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

async function notifyWorkspaceMembers({
  userId, workspaceId, channelId, channelName, joinUrl, wsSlug, appUrl
}: {
  userId: string; workspaceId: string; channelId: string
  channelName: string; joinUrl: string; wsSlug: string; appUrl: string
}) {
  const admin = adminClient()

  const { data: starter } = await admin
    .from('profiles').select('full_name, email').eq('id', userId).single()
  const { data: workspace } = await admin
    .from('workspaces').select('name').eq('id', workspaceId).single()
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, profiles(email, full_name)')
    .eq('workspace_id', workspaceId)
    .neq('user_id', userId)

  if (!members?.length) return

  const emails = members
    .map(m => (m.profiles as unknown as Record<string,unknown>)?.email as string)
    .filter(Boolean)

  if (!emails.length) return

  const starterName = String((starter as Record<string,unknown>)?.full_name || 'Someone')
  const wsName = String((workspace as Record<string,unknown>)?.name || 'workspace')

  // Import and use the themed email function
  const { sendHuddleEmail } = await import('@/lib/email')
  await sendHuddleEmail({
    to: emails,
    starterName,
    channelName,
    joinUrl,
    workspaceName: wsName,
    appUrl,
  })
}
