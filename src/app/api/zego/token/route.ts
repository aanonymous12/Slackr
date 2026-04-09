import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Generate ZegoCloud token server-side (never expose AppSign to client)
function generateZegoToken(appId: number, userId: string, appSign: string, expire = 3600): string {
  const now = Math.floor(Date.now() / 1000)
  const expireTime = now + expire

  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: now,
    expire: expireTime,
    payload: '',
  }

  const tokenInfoStr = JSON.stringify(tokenInfo)
  const iv = crypto.randomBytes(8).toString('hex').slice(0, 16)
  const ivBuffer = Buffer.from(iv)
  const keyBuffer = Buffer.from(appSign.slice(0, 32), 'utf8')

  const cipher = crypto.createCipheriv('aes-256-ecb', keyBuffer, null)
  cipher.setAutoPadding(true)
  const encryptedData = Buffer.concat([
    cipher.update(Buffer.from(tokenInfoStr, 'utf8')),
    cipher.final(),
  ])

  const payload = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x08]), // version
    ivBuffer,
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // padding
    encryptedData,
  ])

  return `04${payload.toString('base64')}`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id, channel_name } = await req.json()

  const appId = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || '2094790355')
  const appSign = process.env.ZEGO_APP_SIGN || ''

  // If no AppSign set, return app ID + user info so client uses Kit Token
  if (!appSign) {
    return NextResponse.json({
      app_id: appId,
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      room_id: `slackr-${channel_id}`,
      channel_name,
      token: null, // client will use ZegoUIKitPrebuilt.generateKitTokenForTest
    })
  }

  const token = generateZegoToken(appId, user.id, appSign)

  return NextResponse.json({
    app_id: appId,
    user_id: user.id,
    user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    room_id: `slackr-${channel_id}`,
    channel_name,
    token,
  })
}
