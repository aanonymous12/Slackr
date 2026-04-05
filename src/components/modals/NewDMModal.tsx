'use client'

import { useState } from 'react'
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
  const [error, setError] = useState('')
  const router = useRouter()

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
    if (!selected.length) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/dm/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, target_user_ids: selected }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')
      router.push(`/workspace/${workspaceSlug}/dm/${data.conversation_id}`)
      router.refresh()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open DM')
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
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#72767d' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for people…" autoFocus style={{ ...inp, paddingLeft: 34 }} />
        </div>

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

        <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 14 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#72767d', fontSize: 13 }}>
              {members.filter(m => (m as Record<string,unknown>).user_id !== currentUserId).length === 0
                ? 'No other members in this workspace yet. Invite someone first!'
                : 'No members found'}
            </div>
          ) : filtered.map((m) => {
            const mm = m as Record<string, unknown>
            const p = mm.profiles as Record<string, unknown>
            const uid = String(mm.user_id)
            const isSel = selected.includes(uid)
            return (
              <div key={uid} onClick={() => toggleSelect(uid)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: isSel ? 'rgba(74,144,217,.1)' : 'transparent', border: `1px solid ${isSel ? '#4a90d9' : 'transparent'}`, marginBottom: 2 }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#2c2f33' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isSel ? 'rgba(74,144,217,.1)' : 'transparent' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: getAvatarColor(String(p?.id||'')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                    {getInitials(String(p?.full_name||''))}
                  </div>
                  <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: getStatusColor(String(p?.status||'offline')), border: '2px solid #222529' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>{String(p?.full_name||p?.username||'Unknown')}</div>
                  <div style={{ fontSize: 12, color: '#72767d' }}>{String(p?.email||'')}</div>
                </div>
                {isSel && <span style={{ color: '#4a90d9', fontSize: 18 }}>✓</span>}
              </div>
            )
          })}
        </div>

        {error && <div style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.4)', borderRadius: 8, padding: '10px 14px', color: '#fc8181', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, ...cancelBtn }}>Cancel</button>
          <button onClick={handleOpen} disabled={loading || !selected.length}
            style={{ flex: 1, ...primaryBtn, opacity: (loading || !selected.length) ? .6 : 1 }}>
            {loading ? 'Opening…' : selected.length > 1 ? 'Start group DM' : 'Open DM'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460 }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const primaryBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
