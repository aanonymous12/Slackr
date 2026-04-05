'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewWorkspacePage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data: { user } } = await createClient().auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Create workspace
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({ name, slug: `${slug}-${Date.now()}`, icon_letter: name[0]?.toUpperCase(), owner_id: user.id })
      .select()
      .single()

    if (wsErr || !ws) { setError(wsErr?.message || 'Failed to create workspace'); setLoading(false); return }

    // Add creator as owner
    await createClient().from('workspace_members').insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })

    // Create default channels
    const defaultChannels = [
      { name: 'general', description: 'Company-wide announcements and work-based matters' },
      { name: 'random', description: 'Non-work banter and water cooler talk' },
    ]
    const { data: channels } = await supabase
      .from('channels')
      .insert(defaultChannels.map(c => ({ ...c, workspace_id: ws.id, created_by: user.id })))
      .select()

    // Add creator to default channels
    if (channels) {
      await createClient().from('channel_members').insert(
        channels.map(c => ({ channel_id: c.id, user_id: user.id }))
      )
    }

    router.push(`/workspace/${ws.slug}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏗️</div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#f2f3f5', margin: '0 0 8px' }}>Create your workspace</h1>
          <p style={{ color: '#72767d', fontSize: '14px', margin: 0 }}>A workspace is where your team communicates.</p>
        </div>
        <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: '12px', padding: '32px' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#b9bbbe', marginBottom: '6px' }}>Workspace name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Acme Corp" required
                style={{ width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: '6px', padding: '10px 12px', color: '#f2f3f5', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
              />
              <p style={{ fontSize: '12px', color: '#72767d', marginTop: '6px' }}>
                This will create <strong style={{ color: '#b9bbbe' }}>#general</strong> and <strong style={{ color: '#b9bbbe' }}>#random</strong> channels automatically.
              </p>
            </div>
            {error && <div style={{ background: 'rgba(237,66,69,0.15)', border: '1px solid rgba(237,66,69,0.4)', borderRadius: '8px', padding: '10px 14px', color: '#fc8181', fontSize: '13px' }}>{error}</div>}
            <button type="submit" disabled={loading || !name.trim()} style={{
              background: '#4a90d9', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px',
              fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
