import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id, action } = await req.json()
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const admin = adminClient()
  const dailyKey = process.env.DAILY_API_KEY
  const dailyDomain = process.env.DAILY_DOMAIN

  if (!dailyKey || !dailyDomain) {
    // Fallback: use Jitsi (no API key needed)
    return NextResponse.json({
      provider: 'jitsi',
      room_url: `https://meet.jit.si/slackr-${channel_id.slice(0, 8)}`,
      room_name: `slackr-${channel_id.slice(0, 8)}`,
    })
  }

  if (action === 'join') {
    // Create or get existing room
    const roomName = `slackr-${channel_id.slice(0, 12)}`
    
    // Check if room exists
    const checkRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${dailyKey}` },
    })

    let room
    if (checkRes.ok) {
      room = await checkRes.json()
    } else {
      // Create new room
      const createRes = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dailyKey}` },
        body: JSON.stringify({
          name: roomName,
          privacy: 'private',
          properties: {
            enable_chat: true,
            enable_screenshare: true,
            enable_recording: 'cloud',
            exp: Math.floor(Date.now() / 1000) + 86400, // 24h
            max_participants: 50,
          },
        }),
      })
      room = await createRes.json()
    }

    // Create meeting token for this user
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dailyKey}` },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_id: user.id,
          exp: Math.floor(Date.now() / 1000) + 86400,
        },
      }),
    })
    const tokenData = await tokenRes.json()

    // Record in huddles table
    const { data: existingHuddle } = await admin
      .from('huddles')
      .select('id')
      .eq('channel_id', channel_id)
      .eq('is_active', true)
      .single()

    let huddleId = existingHuddle?.id
    if (!huddleId) {
      const { data: newHuddle } = await admin.from('huddles').insert({
        channel_id, started_by: user.id, is_active: true,
        room_url: room.url || `https://${dailyDomain}/${roomName}`,
      }).select('id').single()
      huddleId = newHuddle?.id
    }

    if (huddleId) {
      await admin.from('huddle_participants').upsert({
        huddle_id: huddleId, user_id: user.id,
      }, { onConflict: 'huddle_id,user_id' })
    }

    return NextResponse.json({
      provider: 'daily',
      room_url: `https://${dailyDomain}/${roomName}`,
      token: tokenData.token,
      room_name: roomName,
      huddle_id: huddleId,
    })
  }

  if (action === 'leave') {
    const { huddle_id } = await req.json().catch(() => ({}))
    if (huddle_id) {
      await admin.from('huddle_participants').update({ left_at: new Date().toISOString() })
        .eq('huddle_id', huddle_id).eq('user_id', user.id)
      const { data: remaining } = await admin.from('huddle_participants')
        .select('id').eq('huddle_id', huddle_id).is('left_at', null)
      if (!remaining?.length) {
        await admin.from('huddles').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', huddle_id)
      }
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
