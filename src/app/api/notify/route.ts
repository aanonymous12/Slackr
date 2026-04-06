import { adminClient } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, workspace_id, channel_id, message, task_title, task_assignee } = await req.json()

  const admin = adminClient()

  // Get workspace + sender info
  const { data: workspace } = await admin.from('workspaces').select('name').eq('id', workspace_id).single() as { data: { name: string } | null }
  const { data: sender } = await admin.from('profiles').select('full_name, email').eq('id', user.id).single() as { data: { full_name: string; email: string } | null }

  // Get all workspace members' emails (admins + all for announcements)
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, role, profiles(email, full_name)')
    .eq('workspace_id', workspace_id)

  if (!members?.length) return NextResponse.json({ error: 'No members found' }, { status: 404 })

  // For announcements: notify ALL members; for tasks: notify admins + assignee
  const targets = (type === 'announcement'
    ? members.filter(m => m.user_id !== user.id)
    : members.filter(m => m.user_id !== user.id && ['owner', 'admin'].includes(m.role)))

  if (!targets.length) return NextResponse.json({ success: true, sent: 0 })

  const senderName = String(sender?.full_name || sender?.email || 'Someone')
  const workspaceName = String(workspace?.name || 'your workspace')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'

  const emails = targets
    .map(m => (m.profiles as unknown as Record<string, unknown>)?.email as string)
    .filter(Boolean)

  if (!emails.length) return NextResponse.json({ success: true, sent: 0 })

  let subject = ''
  let html = ''

  if (type === 'announcement') {
    subject = `📢 New announcement in ${workspaceName}`
    html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <tr><td style="background:#1a1d21;padding:24px 32px">
    <span style="font-size:20px">📢</span>
    <span style="color:#f2f3f5;font-size:18px;font-weight:700;margin-left:10px">${workspaceName}</span>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p style="margin:0 0 6px;color:#718096;font-size:13px">${senderName} posted in #announcements</p>
    <div style="background:#f7fafc;border-left:4px solid #4a90d9;padding:14px 16px;border-radius:0 8px 8px 0;margin:12px 0 20px;color:#2d3748;font-size:15px;line-height:1.6">${message || 'New announcement'}</div>
    <a href="${appUrl}" style="display:inline-block;background:#4a90d9;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px">View Announcement</a>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
    <p style="margin:0;color:#a0aec0;font-size:12px">You received this because you're a member of ${workspaceName}.</p>
  </td></tr>
</table></td></tr></table></body></html>`
  } else if (type === 'task') {
    subject = `✅ New task added in ${workspaceName}`
    html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <tr><td style="background:#1a1d21;padding:24px 32px">
    <span style="font-size:20px">✅</span>
    <span style="color:#f2f3f5;font-size:18px;font-weight:700;margin-left:10px">${workspaceName} Tasks</span>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p style="margin:0 0 12px;color:#2d3748;font-size:15px"><strong>${senderName}</strong> added a new task:</p>
    <div style="background:#f7fafc;border:1px solid #e2e8f0;padding:16px;border-radius:8px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;color:#2d3748;margin-bottom:6px">${task_title}</div>
      ${task_assignee ? `<div style="font-size:13px;color:#718096">Assigned to: ${task_assignee}</div>` : ''}
    </div>
    <a href="${appUrl}" style="display:inline-block;background:#2eb67d;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px">View Task Board</a>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
    <p style="margin:0;color:#a0aec0;font-size:12px">You received this because you're an admin of ${workspaceName}.</p>
  </td></tr>
</table></td></tr></table></body></html>`
  }

  try {
    const transporter = getTransporter()
    await transporter.sendMail({
      from: `"${workspaceName} on Slackr" <${process.env.GMAIL_USER}>`,
      bcc: emails.join(','),
      subject,
      html,
    })
    return NextResponse.json({ success: true, sent: emails.length })
  } catch (err) {
    console.error('Notification email failed:', err)
    return NextResponse.json({ error: 'Email failed', sent: 0 }, { status: 500 })
  }
}
