import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const admin = adminClient()
  const { data: tasks, error } = await admin
    .from('tasks')
    .select('*, created_by_profile:profiles!created_by(id, full_name, username), assigned_to_profile:profiles!assigned_to(id, full_name, username)')
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { workspace_id, title, description, priority, due_date, assigned_to, channel_id } = body
  if (!workspace_id || !title?.trim()) {
    return NextResponse.json({ error: 'workspace_id and title required' }, { status: 400 })
  }

  const admin = adminClient()
  const { data: task, error } = await admin
    .from('tasks')
    .insert({
      workspace_id,
      channel_id: channel_id || null,
      created_by: user.id,
      assigned_to: assigned_to || null,
      title: title.trim(),
      description: description || null,
      priority: priority || 'medium',
      due_date: due_date || null,
      status: 'not_started',
    })
    .select('*, created_by_profile:profiles!created_by(id, full_name, username), assigned_to_profile:profiles!assigned_to(id, full_name, username)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_id, ...updates } = await req.json()
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const admin = adminClient()
  const { data: task, error } = await admin
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', task_id)
    .select('*, created_by_profile:profiles!created_by(id, full_name, username), assigned_to_profile:profiles!assigned_to(id, full_name, username)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_id } = await req.json()
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const admin = adminClient()
  const { error } = await admin.from('tasks').delete().eq('id', task_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
