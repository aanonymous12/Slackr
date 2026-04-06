'use client'

import { useState } from 'react'
import { X, Search, UserPlus, UserMinus, Trash2 } from 'lucide-react'

interface Props {
  members: Record<string, unknown>[]
  currentUserId: string
  membership: Record<string, unknown>
  workspaceId: string
  workspaceSlug: string
  onClose: () => void
  onInvite: () => void
}

export default function MembersModal({ members: initialMembers, currentUserId, membership, workspaceId, workspaceSlug, onClose, onInvite }: Props) {
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState(initialMembers)
  const [removing, setRemoving] = useState<string | null>(null)
  const [deletingWs, setDeletingWs] = useState(false)
  const myRole = String(membership.role || 'member')
  const isAdmin = ['owner', 'admin'].includes(myRole)
  const isOwner = myRole === 'owner'

  const filtered = members.filter(m => {
    const p = (m as Record<string, unknown>).profiles as Record<string, unknown>
    return !query || String(p?.full_name || p?.username || '').toLowerCase().includes(query.toLowerCase())
  })

  async function removeMember(userId: string) {
    if (!confirm('Remove this member from the workspace?')) return
    setRemoving(userId)
    try {
      const res = await fetch('/api/workspace/member/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, target_user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { alert(data.error || 'Failed'); return }
      setMembers(prev => prev.filter(m => (m as Record<string,unknown>).user_id !== userId))
    } finally { setRemoving(null) }
  }

  async function deleteWorkspace() {
    if (!confirm('DELETE this entire workspace? This cannot be undone. All channels, messages and members will be lost.')) return
    setDeletingWs(true)
    try {
      const res = await fetch('/api/workspace/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { alert(data.error || 'Failed'); return }
      window.location.href = '/workspace/new'
    } finally { setDeletingWs(false) }
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }
  function getInitials(n: string) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  function getStatusColor(s: string) { return s==='active'?'#2eb67d':s==='away'?'#faa61a':s==='dnd'?'#ed4245':'#72767d' }
  const roleColors: Record<string, string> = { owner:'#faa61a', admin:'#4a90d9', member:'#72767d', guest:'#3f4348' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Members ({members.length})</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onInvite}
              style={{ background: '#4a90d9', border: 'none', borderRadius: 6, padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserPlus size={14} /> Invite
            </button>
            <button onClick={onClose} style={closeBtn}><X size={18} /></button>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#72767d' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members…" style={{ ...inp, paddingLeft: 34 }} />
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.map((m) => {
            const mm = m as Record<string, unknown>
            const p = mm.profiles as Record<string, unknown>
            const uid = String(p?.id || mm.user_id)
            const role = String(mm.role || 'member')
            const isMe = uid === currentUserId
            const isThisOwner = role === 'owner'

            return (
              <div key={uid}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderRadius: 8, marginBottom: 2 }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: roleColors[role]||'#72767d', background: '#2c2f33', border: `1px solid ${roleColors[role]||'#3f4348'}`, borderRadius: 20, padding: '3px 10px', textTransform: 'capitalize' }}>{role}</span>
                  {(isAdmin && !isMe && !isThisOwner) && (
                    <button onClick={() => removeMember(uid)} disabled={removing === uid} title="Remove member"
                      style={{ background: 'none', border: 'none', color: removing === uid ? '#72767d' : '#ed4245', cursor: removing === uid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4 }}>
                      <UserMinus size={15} />
                    </button>
                  )}
                  {isMe && !isThisOwner && (
                    <button onClick={() => removeMember(uid)} title="Leave workspace"
                      style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4, fontSize: 11 }}>
                      Leave
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #3f4348', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isOwner ? (
            <button onClick={deleteWorkspace} disabled={deletingWs}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 8, padding: '8px 14px', color: '#ed4245', cursor: deletingWs ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: deletingWs ? .7 : 1 }}>
              <Trash2 size={14} /> {deletingWs ? 'Deleting…' : 'Delete workspace'}
            </button>
          ) : <div />}
          <button onClick={onClose} style={{ ...cancelBtn }}>Close</button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500 }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtn: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
