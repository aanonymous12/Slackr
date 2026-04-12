import { adminClient } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { sendAnnouncementEmail, sendTaskEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, workspace_id, channel_id, message, task_title, task_assignee } = await req.json()
  const admin = adminClient()

  const { data: workspace } = await admin.from('workspaces').select('name, slug').eq('id', workspace_id).single()
  const { data: sender } = await admin.from('profiles').select('full_name, email').eq('id', user.id).single()
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, role, profiles(email, full_name)')
    .eq('workspace_id', workspace_id)

  const wsName = (workspace as Record<string,unknown>)?.name as string || 'workspace'
  const wsSlug = (workspace as Record<string,unknown>)?.slug as string || ''
  const senderName = (sender as Record<string,unknown>)?.full_name as string || 'Someone'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ success: true, note: 'Email not configured' })
  }

  try {
    if (type === 'announcement') {
      const emails = (members || [])
        .map(m => (m.profiles as unknown as Record<string,unknown>)?.email as string)
        .filter(e => e && e !== (sender as Record<string,unknown>)?.email)

      const channelUrl = `${appUrl}/workspace/${wsSlug}/channel/${channel_id}`
      await sendAnnouncementEmail({
        to: emails, senderName, message: message || '',
        channelUrl, workspaceName: wsName, appUrl,
      })
      return NextResponse.json({ success: true, sent: emails.length })
    }

    if (type === 'task') {
      const adminEmails = (members || [])
        .filter(m => ['owner','admin'].includes(String(m.role)))
        .map(m => (m.profiles as unknown as Record<string,unknown>)?.email as string)
        .filter(e => e && e !== (sender as Record<string,unknown>)?.email)

      const boardUrl = `${appUrl}/workspace/${wsSlug}/channel/${channel_id}`
      await sendTaskEmail({
        to: adminEmails, creatorName: senderName,
        taskTitle: task_title || 'New task',
        taskAssignee: task_assignee,
        workspaceName: wsName, boardUrl, appUrl,
      })
      return NextResponse.json({ success: true, sent: adminEmails.length })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) {
    console.error('Notify email error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
