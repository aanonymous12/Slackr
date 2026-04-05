'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Search, UserPlus, Shield, User } from 'lucide-react'

interface Props {
  members: Record<string, unknown>[]
  currentUserId: string
  membership: Record<string, unknown>
  workspaceId: string
  workspaceSlug: string
  onClose: () => void
  onInvite: () => void
}

export default function MembersModal({ members, currentUserId, membership, onClose, onInvite }: Props) {
  const [query, setQuery] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const supabase = createClient()
  const myRole = String(membership.role || 'member')
  const isAdmin = ['owner', 'admin'].includes(myRole)

  const filtered = members.filter(m => {
    const p = (m as Record<string, unknown>).profiles as Record<string, unknown>
    const name = String(p?.full_name || p?.username || '').toLowerCase()
    return !query || name.includes(query.toLowerCase())
  })

  async function updateRole(userId: string, role: string) {
    setUpdating(userId)
    await supabase.from('workspace_members').update({ role }).eq('user_id', userId).eq('workspace_id', String(membership.workspace_id))
    setUpdating(null)
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }
  function getInitials(n: string) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  function getStatusColor(s: string) { return s==='active'?'#2eb67d':s==='away'?'#faa61a':s==='dnd'?'#ed4245':'#72767d' }

  const roleColors: Record<string, string> = { owner: '#faa61a', admin: '#4a90d9', member: '#72767d', guest: '#3f4348' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Members ({members.length})</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onInvite} style={{ background: '#4a90d9', border: 'none', borderRadius: 6, padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserPlus size={14} /> Invite
            </button>
            <button onClick={onClose} style={closeBtn}><X size={18} /></button>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#72767d' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members…" style={{ ...inp, paddingLeft: 34 }} />
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filtered.map((m) => {
            const mm = m as Record<string, unknown>
            const p = mm.profiles as Record<string, unknown>
            const uid = String(p?.id || mm.user_id)
            const role = String(mm.role || 'member')
            const isMe = uid === currentUserId

            return (
              <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderRadius: 8, marginBottom: 2 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2c2f33')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: getAvatarColor(uid), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                    {getInitials(String(p?.full_name || ''))}
                  </div>
                  <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: getStatusColor(String(p?.status||'offline')), border: '2px solid #222529' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {String(p?.full_name || p?.username || 'Unknown')}
                    {isMe && <span style={{ fontSize: 11, color: '#72767d' }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#72767d' }}>{String(p?.email || '')}</div>
                </div>
                {isAdmin && !isMe ? (
                  <select
                    value={role}
                    disabled={updating === uid}
                    onChange={e => updateRole(uid, e.target.value)}
                    style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '4px 8px', color: roleColors[role] || '#b9bbbe', fontSize: 12, cursor: 'pointer', outline: 'none' }}>
                    {['owner','admin','member','guest'].map(r => (
                      <option key={r} value={r} style={{ background: '#222529', color: '#f2f3f5' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 12, color: roleColors[role] || '#72767d', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 20, padding: '3px 10px', textTransform: 'capitalize' }}>{role}</span>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button onClick={onClose} style={{ ...cancelBtn }}>Close</button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, animation: 'fade-in .15s ease' }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtn: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
