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
  const { data: boards } = await admin
    .from('canvas_boards')
    .select('id, name, created_by, updated_by, created_at, updated_at, profiles!created_by(full_name)')
    .eq('workspace_id', workspace_id)
    .order('updated_at', { ascending: false })
  return NextResponse.json({ boards: boards || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspace_id, name, data: boardData } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  const admin = adminClient()
  const { data: board, error } = await admin
    .from('canvas_boards')
    .insert({ workspace_id, name: name || 'Untitled Board', data: boardData || { nodes: [], connections: [] }, created_by: user.id, updated_by: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ board })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { board_id, name, data: boardData } = await req.json()
  if (!board_id) return NextResponse.json({ error: 'board_id required' }, { status: 400 })
  const admin = adminClient()
  const updates: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() }
  if (name !== undefined) updates.name = name
  if (boardData !== undefined) updates.data = boardData
  const { data: board, error } = await admin
    .from('canvas_boards')
    .update(updates)
    .eq('id', board_id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ board })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { board_id } = await req.json()
  if (!board_id) return NextResponse.json({ error: 'board_id required' }, { status: 400 })
  const admin = adminClient()
  const { error } = await admin.from('canvas_boards').delete().eq('id', board_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
