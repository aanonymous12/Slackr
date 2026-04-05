import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, slug)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (data?.workspaces) {
    const ws = data.workspaces as unknown as { id: string; slug: string }
    redirect(`/workspace/${ws.slug}`)
  }
  redirect('/workspace/new')
}
