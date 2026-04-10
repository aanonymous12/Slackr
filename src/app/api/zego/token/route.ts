import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id, channel_name } = await req.json()
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const appId = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || '2094790355')
  const serverSecret = process.env.ZEGO_SERVER_SECRET || ''

  // ZegoCloud room IDs and user IDs must be alphanumeric, max 128 chars
  const roomId = `slackr${channel_id.replace(/-/g, '').slice(0, 24)}`
  // User ID: alphanumeric only, max 64 chars
  const userId = `u${user.id.replace(/-/g, '').slice(0, 30)}`
  const userName = String(
    (user.user_metadata?.full_name as string) ||
    user.email?.split('@')[0] ||
    'User'
  ).slice(0, 64)

  return NextResponse.json({
    app_id: appId,
    // Pass server_secret to client for generateKitTokenForTest
    // NOTE: In production with custom token server, don't expose this
    server_secret: serverSecret,
    room_id: roomId,
    user_id: userId,
    user_name: userName,
    channel_name,
  })
}
