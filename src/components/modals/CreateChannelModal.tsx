'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Hash, Lock } from 'lucide-react'

interface Props {
  workspaceId: string
  workspaceSlug: string
  currentUserId: string
  onClose: () => void
  onCreated: (channel: unknown) => void
}

export default function CreateChannelModal({ workspaceId, currentUserId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const slugName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data: ch, error: chErr } = await supabase
        .from('channels')
        .insert({ workspace_id: workspaceId, name: slugName, description: description || null, is_private: isPrivate, created_by: currentUserId })
        .select()
        .single()
      if (chErr) throw chErr
      // Auto-join
      await supabase.from('channel_members').insert({ channel_id: ch.id, user_id: currentUserId })
      onCreated(ch)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channel')
    } finally { setLoading(false) }
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Create a channel</h2>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>
        <p style={{ color: '#72767d', fontSize: 14, marginTop: 4, marginBottom: 20 }}>Channels are where your team communicates. Best when organized around a topic.</p>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Channel name</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#72767d' }}>
                {isPrivate ? <Lock size={14} /> : <Hash size={14} />}
              </span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. marketing, q4-planning"
                required
                maxLength={80}
                style={{ ...inp, paddingLeft: 32 }}
              />
            </div>
            {name && slugName !== name && (
              <p style={{ fontSize: 12, color: '#72767d', marginTop: 5 }}>Will be created as: <strong style={{ color: '#b9bbbe' }}>#{slugName}</strong></p>
            )}
          </div>

          <div>
            <label style={lbl}>Description <span style={{ fontWeight: 400, color: '#72767d' }}>(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel about?" style={inp} />
          </div>

          <div>
            <label style={lbl}>Visibility</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: false, icon: <Hash size={16} />, label: 'Public', desc: 'Anyone in the workspace' },
                { value: true, icon: <Lock size={16} />, label: 'Private', desc: 'Invite-only' },
              ].map(opt => (
                <div key={String(opt.value)}
                  onClick={() => setIsPrivate(opt.value)}
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 8, border: `1px solid ${isPrivate === opt.value ? '#4a90d9' : '#3f4348'}`, background: isPrivate === opt.value ? 'rgba(74,144,217,.1)' : '#2c2f33', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isPrivate === opt.value ? '#4a90d9' : '#b9bbbe', fontWeight: 600, fontSize: 14, marginBottom: 3 }}>
                    {opt.icon} {opt.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#72767d' }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {error && <div style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.4)', borderRadius: 8, padding: '10px 14px', color: '#fc8181', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, ...cancelBtn }}>Cancel</button>
            <button type="submit" disabled={loading || !slugName} style={{ flex: 1, ...primaryBtn, opacity: (loading || !slugName) ? .6 : 1 }}>
              {loading ? 'Creating...' : 'Create channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460, animation: 'fade-in .15s ease' }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#b9bbbe', marginBottom: 6 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const primaryBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
