import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Find the user's most recently joined workspace
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, joined_at, workspaces(id, slug, name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(1)

  const first = memberships?.[0]
  if (first?.workspaces) {
    const ws = first.workspaces as unknown as { id: string; slug: string; name: string }
    redirect(`/workspace/${ws.slug}`)
  }

  // No workspace at all → create one
  redirect('/workspace/new')
}
