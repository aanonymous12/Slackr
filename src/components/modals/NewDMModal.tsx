'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { X, Search } from 'lucide-react'

interface Props {
  workspaceId: string
  workspaceSlug: string
  currentUserId: string
  members: Record<string, unknown>[]
  onClose: () => void
}

export default function NewDMModal({ workspaceId, workspaceSlug, currentUserId, members, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filtered = members.filter(m => {
    const p = (m as Record<string, unknown>).profiles as Record<string, unknown>
    if (!p || p.id === currentUserId) return false
    const name = String(p.full_name || p.username || '').toLowerCase()
    const email = String(p.email || '').toLowerCase()
    return !query || name.includes(query.toLowerCase()) || email.includes(query.toLowerCase())
  })

  function toggleSelect(userId: string) {
    setSelected(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  async function handleOpen() {
    if (selected.length === 0) return
    setLoading(true)
    try {
      const allMembers = [currentUserId, ...selected]
      const isGroup = selected.length > 1

      // Check if 1:1 DM already exists
      if (!isGroup) {
        const otherId = selected[0]
        const { data: existing } = await supabase.rpc('find_dm_conversation', {
          user1: currentUserId, user2: otherId, workspace: workspaceId
        })
        if (existing) {
          router.push(`/workspace/${workspaceSlug}/dm/${existing}`)
          onClose()
          return
        }
      }

      // Create new conversation
      const { data: conv } = await supabase
        .from('conversations')
        .insert({ workspace_id: workspaceId, is_group: isGroup })
        .select()
        .single()

      if (!conv) throw new Error('Failed to create conversation')

      // Add all members
      await supabase.from('conversation_members').insert(
        allMembers.map(uid => ({ conversation_id: conv.id, user_id: uid }))
      )

      router.push(`/workspace/${workspaceSlug}/dm/${conv.id}`)
      router.refresh()
      onClose()
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }
  function getInitials(n: string) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  function getStatusColor(s: string) { return s==='active'?'#2eb67d':s==='away'?'#faa61a':s==='dnd'?'#ed4245':'#72767d' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>New direct message</h2>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#72767d' }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search for people…"
            autoFocus
            style={{ ...inp, paddingLeft: 34 }}
          />
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {selected.map(id => {
              const m = members.find(m => (m as Record<string, unknown>).user_id === id) as Record<string, unknown>
              const p = m?.profiles as Record<string, unknown>
              return (
                <div key={id} style={{ background: 'rgba(74,144,217,.2)', border: '1px solid #4a90d9', borderRadius: 20, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4a90d9' }}>
                  {String(p?.full_name || p?.username || id)}
                  <button onClick={() => toggleSelect(id)} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>✕</button>
                </div>
              )
            })}
          </div>
        )}

        {/* Member list */}
        <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#72767d', fontSize: 13 }}>No members found</div>
          ) : filtered.map((m) => {
            const mm = m as Record<string, unknown>
            const p = mm.profiles as Record<string, unknown>
            const uid = String(mm.user_id)
            const isSelected = selected.includes(uid)
            return (
              <div key={uid} onClick={() => toggleSelect(uid)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: isSelected ? 'rgba(74,144,217,.1)' : 'transparent', border: `1px solid ${isSelected ? '#4a90d9' : 'transparent'}`, marginBottom: 2 }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#2c2f33' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: getAvatarColor(String(p?.id||'')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                    {getInitials(String(p?.full_name || ''))}
                  </div>
                  <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: getStatusColor(String(p?.status||'offline')), border: '2px solid #222529' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>{String(p?.full_name || p?.username || 'Unknown')}</div>
                  <div style={{ fontSize: 12, color: '#72767d' }}>{String(p?.email || '')}</div>
                </div>
                {isSelected && <span style={{ color: '#4a90d9', fontSize: 16 }}>✓</span>}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, ...cancelBtn }}>Cancel</button>
          <button onClick={handleOpen} disabled={loading || selected.length === 0}
            style={{ flex: 1, ...primaryBtn, opacity: (loading || selected.length === 0) ? .6 : 1 }}>
            {loading ? 'Opening...' : selected.length > 1 ? 'Start group DM' : 'Open DM'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460, animation: 'fade-in .15s ease' }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const primaryBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
