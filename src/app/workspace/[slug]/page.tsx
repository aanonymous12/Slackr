import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('slug', slug).single()
  if (!workspace) redirect('/workspace/new')

  const { data: memberships } = await supabase
    .from('channel_members')
    .select('channel_id, channels(id, name, workspace_id)')
    .eq('user_id', user.id)

  const firstChannel = (memberships || [])
    .map(m => m.channels as unknown as { id: string; name: string; workspace_id: string } | null)
    .find(c => c && c.workspace_id === workspace.id)

  if (firstChannel) redirect(`/workspace/${slug}/channel/${firstChannel.id}`)

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222529', color: '#72767d', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>👋</div>
      <h2 style={{ color: '#f2f3f5', fontWeight: 700, margin: 0 }}>Welcome to your workspace!</h2>
      <p style={{ margin: 0 }}>You haven&apos;t joined any channels yet.</p>
    </div>
  )
}
