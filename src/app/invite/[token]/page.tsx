export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AcceptInviteClient from './AcceptInviteClient'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from('invites')
    .select('*, workspaces(id, name, slug, icon_color, icon_letter)')
    .eq('token', token)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (!invite) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f2f3f5' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2>Invalid or expired invite link</h2>
          <p style={{ color: '#72767d' }}>This invite link is no longer valid.</p>
          <a href="/auth/login" style={{ color: '#4a90d9' }}>Go to login →</a>
        </div>
      </div>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Already logged in - auto accept
    const workspace = invite.workspaces as Record<string, unknown>
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id').eq('workspace_id', workspace.id).eq('user_id', user.id).single()

    if (!existing) {
      await supabase.from('workspace_members').insert({
        workspace_id: workspace.id, user_id: user.id, role: invite.role
      })
    }
    await supabase.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id)

    // Auto-join general channel
    const { data: general } = await supabase
      .from('channels').select('id').eq('workspace_id', workspace.id).eq('name', 'general').single()
    if (general) {
      await supabase.from('channel_members').upsert({ channel_id: general.id, user_id: user.id })
    }
    redirect(`/workspace/${workspace.slug}`)
  }

  return <AcceptInviteClient invite={invite} token={token} />
}
