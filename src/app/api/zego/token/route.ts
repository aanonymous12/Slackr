import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// ZegoCloud Kit Token generation using ServerSecret
// Docs: https://docs.zegocloud.com/article/15079
function generateKitToken(
  appId: number,
  serverSecret: string,
  roomId: string,
  userId: string,
  userName: string,
  expireSeconds = 7200
): string {
  const now = Math.floor(Date.now() / 1000)
  const expire = now + expireSeconds

  // Build payload
  const payload: Record<string, unknown> = {
    app_id: appId,
    user_id: userId,
    user_name: userName,
    room_id: roomId,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: now,
    expire,
    privilege: { 1: 1, 2: 1 }, // publish + subscribe
  }

  const payloadStr = JSON.stringify(payload)

  // ZegoCloud uses AES-128-CBC for kit token
  const key = Buffer.from(serverSecret.slice(0, 16), 'utf8')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
  cipher.setAutoPadding(true)
  const encrypted = Buffer.concat([cipher.update(payloadStr, 'utf8'), cipher.final()])

  // Format: version(2) + appId(10) + expire(10) + iv(32hex) + encrypted(base64)
  const ivHex = iv.toString('hex')
  const encryptedB64 = encrypted.toString('base64')
  const version = '04'
  const appIdStr = String(appId).padStart(10, '0')
  const expireStr = String(expire).padStart(10, '0')

  return `${version}${appIdStr}${expireStr}${ivHex}${encryptedB64}`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id, channel_name } = await req.json()
  if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const appId = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || '2094790355')
  const serverSecret = process.env.ZEGO_SERVER_SECRET || ''
  const roomId = `slackr-${channel_id.replace(/-/g, '').slice(0, 20)}`
  const userId = user.id.replace(/-/g, '').slice(0, 32) // ZegoCloud user IDs must be alphanumeric
  const userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'User'

  let token: string | null = null

  if (serverSecret && serverSecret.length >= 16) {
    try {
      token = generateKitToken(appId, serverSecret, roomId, userId, userName)
    } catch (err) {
      console.error('Token generation failed:', err)
      // Fall back to client-side test token
    }
  }

  return NextResponse.json({
    app_id: appId,
    server_secret: serverSecret && serverSecret.length >= 16 ? null : serverSecret, // Only send to client if token gen failed
    room_id: roomId,
    user_id: userId,
    user_name: userName,
    channel_name,
    token, // null = client must use generateKitTokenForTest with serverSecret
    use_test_mode: !token, // signal client to generate token itself
  })
}
