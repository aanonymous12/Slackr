import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('slug', slug).single()
  if (!workspace) redirect('/')

  // Find first public channel (general first, then alphabetical)
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name')
    .eq('workspace_id', workspace.id)
    .eq('is_private', false)
    .eq('is_archived', false)
    .order('name')

  if (channels?.length) {
    // Prefer 'general', otherwise first channel
    const general = channels.find(c => c.name === 'general') || channels[0]
    redirect(`/workspace/${slug}/channel/${general.id}`)
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222529', flexDirection: 'column', gap: 12, color: '#72767d' }}>
      <div style={{ fontSize: 48 }}>👋</div>
      <h2 style={{ color: '#f2f3f5', fontWeight: 700, margin: 0 }}>Welcome to {slug}!</h2>
      <p style={{ margin: 0, fontSize: 14 }}>No channels found yet.</p>
    </div>
  )
}
