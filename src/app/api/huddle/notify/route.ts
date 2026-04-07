import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel_id, workspace_id, channel_name } = await req.json()
  const admin = adminClient()

  const { data: starter } = await admin.from('profiles').select('full_name').eq('id', user.id).single()
  const { data: workspace } = await admin.from('workspaces').select('name, slug').eq('id', workspace_id).single()
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, profiles(email)')
    .eq('workspace_id', workspace_id)

  const emails = (members || [])
    .map(m => (m.profiles as unknown as Record<string,unknown>)?.email as string)
    .filter(e => e && e !== user.email)

  if (!emails.length || !process.env.GMAIL_USER) return NextResponse.json({ success: true })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'
  const channelUrl = `${appUrl}/workspace/${(workspace as Record<string,unknown>)?.slug}/channel/${channel_id}`
  const starterName = (starter as Record<string,unknown>)?.full_name || 'Someone'
  const wsName = (workspace as Record<string,unknown>)?.name || 'workspace'

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
    await transporter.sendMail({
      from: `"${wsName} on Slackr" <${process.env.GMAIL_USER}>`,
      bcc: emails.join(','),
      subject: `🎙️ ${starterName} started a huddle in #${channel_name}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#1e3a2e;border:1px solid #2eb67d;border-radius:12px;padding:24px">
            <div style="font-size:32px;margin-bottom:12px">🎙️</div>
            <h2 style="color:#4ade80;margin:0 0 8px;font-size:18px">Huddle started in #${channel_name}</h2>
            <p style="color:#86efac;margin:0 0 16px"><strong>${starterName}</strong> just started a voice huddle in ${wsName}.</p>
            <a href="${channelUrl}" style="background:#2eb67d;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">
              Join huddle →
            </a>
          </div>
        </div>`,
    })
  } catch (err) { console.error('Huddle notify failed:', err) }

  return NextResponse.json({ success: true })
}
