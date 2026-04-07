import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mentioned_user_ids, workspace_id, channel_name, message_preview, channel_id, conversation_id } = await req.json()
  if (!mentioned_user_ids?.length) return NextResponse.json({ success: true })

  const admin = adminClient()
  const { data: sender } = await admin.from('profiles').select('full_name, email').eq('id', user.id).single()
  const { data: workspace } = await admin.from('workspaces').select('name, slug').eq('id', workspace_id).single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'
  const targetUrl = channel_id
    ? `${appUrl}/workspace/${workspace?.slug}/channel/${channel_id}`
    : `${appUrl}/workspace/${workspace?.slug}/dm/${conversation_id}`

  const mentionedProfiles = await Promise.all(
    mentioned_user_ids.map((id: string) =>
      admin.from('profiles').select('email, full_name').eq('id', id).single()
        .then(r => r.data)
    )
  )

  const emails = mentionedProfiles
    .filter(Boolean)
    .map(p => p!.email)
    .filter(e => e && e !== user.email)

  if (!emails.length || !process.env.GMAIL_USER) return NextResponse.json({ success: true, sent: 0 })

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
    const senderName = (sender as Record<string,unknown>)?.full_name || user.email
    const wsName = (workspace as Record<string,unknown>)?.name || 'workspace'
    await transporter.sendMail({
      from: `"${wsName} on Slackr" <${process.env.GMAIL_USER}>`,
      bcc: emails.join(','),
      subject: `${senderName} mentioned you in ${channel_name ? '#' + channel_name : 'a message'}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f4f4f5;border-radius:12px">
          <div style="background:#222529;border-radius:12px;overflow:hidden">
            <div style="padding:20px 24px;background:#1a1d21">
              <span style="color:#ffd900;font-size:18px">@</span>
              <span style="color:#f2f3f5;font-weight:700;font-size:16px;margin-left:6px">You were mentioned</span>
            </div>
            <div style="padding:20px 24px">
              <p style="color:#b9bbbe;margin:0 0 8px;font-size:13px">
                <strong style="color:#f2f3f5">${senderName}</strong> mentioned you${channel_name ? ` in <strong style="color:#4a90d9">#${channel_name}</strong>` : ''}
              </p>
              <div style="background:#2c2f33;border-left:4px solid #ffd900;padding:12px 16px;border-radius:0 8px 8px 0;color:#d1d2d3;font-size:14px;margin:12px 0">
                ${(message_preview || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
              </div>
              <a href="${targetUrl}" style="display:inline-block;background:#4a90d9;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:12px">
                View message →
              </a>
            </div>
          </div>
        </div>`,
    })
    return NextResponse.json({ success: true, sent: emails.length })
  } catch (err) {
    console.error('Mention email failed:', err)
    return NextResponse.json({ success: true, sent: 0 })
  }
}
