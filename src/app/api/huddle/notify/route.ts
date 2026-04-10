import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id, workspace_id, channel_name } = await req.json()
  if (!workspace_id || !channel_id) {
    return NextResponse.json({ error: 'workspace_id and channel_id required' }, { status: 400 })
  }

  const admin = adminClient()

  // Get starter's name
  const { data: starter } = await admin
    .from('profiles').select('full_name, email').eq('id', user.id).single()
  const starterName = String((starter as Record<string,unknown>)?.full_name || (starter as Record<string,unknown>)?.email || 'Someone')

  // Get workspace info
  const { data: workspace } = await admin
    .from('workspaces').select('name, slug').eq('id', workspace_id).single()
  const wsName = String((workspace as Record<string,unknown>)?.name || 'workspace')
  const wsSlug = String((workspace as Record<string,unknown>)?.slug || '')

  // Get ALL workspace members except the starter
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, profiles(email, full_name)')
    .eq('workspace_id', workspace_id)
    .neq('user_id', user.id)

  if (!members?.length) return NextResponse.json({ success: true, sent: 0 })

  const emails = members
    .map(m => (m.profiles as unknown as Record<string,unknown>)?.email as string)
    .filter(Boolean)

  if (!emails.length) return NextResponse.json({ success: true, sent: 0 })

  // Skip email if Gmail not configured — just return success
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[Huddle notify] Email not configured. Would notify ${emails.length} members.`)
    return NextResponse.json({ success: true, sent: 0, note: 'Email not configured' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
  const channelUrl = `${appUrl}/workspace/${wsSlug}/channel/${channel_id}`

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })

    await transporter.sendMail({
      from: `"${wsName} on Slackr" <${process.env.GMAIL_USER}>`,
      bcc: emails.join(','),
      subject: `🎙️ ${starterName} started a huddle in #${channel_name || 'a channel'}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
        <tr><td style="background:#1e3a2e;padding:20px 24px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:#2eb67d;flex-shrink:0"></div>
            <span style="color:#4ade80;font-size:16px;font-weight:700">${wsName}</span>
          </div>
        </td></tr>
        <tr><td style="padding:24px">
          <div style="font-size:28px;margin-bottom:12px">🎙️</div>
          <h2 style="margin:0 0 8px;font-size:18px;color:#111827">Huddle started in #${channel_name || 'a channel'}</h2>
          <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6">
            <strong>${starterName}</strong> just started a voice huddle in
            <strong>${wsName}</strong>. Join now to participate!
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td>
              <a href="${channelUrl}"
                style="display:inline-block;background:#2eb67d;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px">
                🎙️ Join huddle
              </a>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">
            You received this because you're a member of ${wsName} on Slackr.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })

    return NextResponse.json({ success: true, sent: emails.length })
  } catch (err) {
    console.error('Huddle notify email failed:', err)
    // Don't fail the whole request just because email failed
    return NextResponse.json({ success: true, sent: 0, error: 'Email send failed' })
  }
}
