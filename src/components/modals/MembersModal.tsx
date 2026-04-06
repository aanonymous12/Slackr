'use client'

import { useState } from 'react'
import { X, Search, UserPlus, UserMinus, Trash2, AlertTriangle } from 'lucide-react'

interface Props {
  members: Record<string, unknown>[]
  currentUserId: string
  membership: Record<string, unknown>
  workspaceId: string
  workspaceSlug: string
  workspaceName?: string
  onClose: () => void
  onInvite: () => void
}

export default function MembersModal({ members: initialMembers, currentUserId, membership, workspaceId, workspaceName = 'this workspace', onClose, onInvite }: Props) {
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState(initialMembers)
  const [removing, setRemoving] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deletingWs, setDeletingWs] = useState(false)
  const myRole = String(membership.role || 'member')
  const isAdmin = ['owner', 'admin'].includes(myRole)
  const isOwner = myRole === 'owner'

  const filtered = members.filter(m => {
    const p = (m as Record<string, unknown>).profiles as Record<string, unknown>
    return !query || String(p?.full_name || p?.username || '').toLowerCase().includes(query.toLowerCase())
  })

  async function removeMember(userId: string, isSelf: boolean) {
    const msg = isSelf ? 'Leave this workspace? You will lose access to all channels.' : 'Remove this member from the workspace?'
    if (!confirm(msg)) return
    setRemoving(userId)
    try {
      const res = await fetch('/api/workspace/member/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, target_user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { alert(data.error || 'Failed'); return }
      if (isSelf) { window.location.href = '/workspace/new'; return }
      setMembers(prev => prev.filter(m => (m as Record<string,unknown>).user_id !== userId))
    } finally { setRemoving(null) }
  }

  async function deleteWorkspace() {
    if (deleteInput !== workspaceName) return
    setDeletingWs(true)
    try {
      const res = await fetch('/api/workspace/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { alert(data.error || 'Failed to delete workspace'); return }
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

  // Delete workspace confirmation modal
  if (showDeleteConfirm) {
    return (
      <div style={overlay} onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
        <div style={{ ...modal, maxWidth: 440, border: '1px solid rgba(237,66,69,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(237,66,69,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} color="#ed4245" />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#f2f3f5' }}>Delete workspace</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#72767d', lineHeight: 1.5 }}>
                This will permanently delete <strong style={{ color: '#f2f3f5' }}>{workspaceName}</strong> including all channels, messages, tasks and members. <strong style={{ color: '#ed4245' }}>This cannot be recovered.</strong>
              </p>
            </div>
          </div>
          <div style={{ background: 'rgba(237,66,69,.08)', border: '1px solid rgba(237,66,69,.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#fc8181' }}>
              To confirm, type the workspace name: <strong>{workspaceName}</strong>
            </p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={workspaceName}
              autoFocus
              style={{ width: '100%', background: '#1a1d21', border: `1px solid ${deleteInput === workspaceName ? '#ed4245' : '#3f4348'}`, borderRadius: 6, padding: '9px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Cancel
            </button>
            <button onClick={deleteWorkspace} disabled={deleteInput !== workspaceName || deletingWs}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: deleteInput === workspaceName ? '#ed4245' : '#3f4348', color: '#fff', cursor: deleteInput === workspaceName ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, opacity: deletingWs ? .7 : 1 }}>
              {deletingWs ? 'Deleting…' : 'Delete workspace'}
            </button>
          </div>
        </div>
      </div>
    )
  }

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

        <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 14 }}>
          {filtered.map((m) => {
            const mm = m as Record<string, unknown>
            const p = mm.profiles as Record<string, unknown>
            const uid = String(p?.id || mm.user_id)
            const role = String(mm.role || 'member')
            const isMe = uid === currentUserId
            const isThisOwner = role === 'owner'

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
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(p?.full_name || p?.username || 'Unknown')}
                    {isMe && <span style={{ fontSize: 11, color: '#72767d', marginLeft: 4 }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#72767d' }}>{String(p?.email || '')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: roleColors[role]||'#72767d', background: '#2c2f33', border: `1px solid ${roleColors[role]||'#3f4348'}`, borderRadius: 20, padding: '2px 8px', textTransform: 'capitalize' }}>{role}</span>
                  {isAdmin && !isMe && !isThisOwner && (
                    <button onClick={() => removeMember(uid, false)} disabled={removing === uid} title="Remove member"
                      style={{ background: 'none', border: 'none', color: removing === uid ? '#72767d' : '#ed4245', cursor: removing === uid ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4 }}>
                      <UserMinus size={15} />
                    </button>
                  )}
                  {isMe && !isThisOwner && (
                    <button onClick={() => removeMember(uid, true)} title="Leave workspace"
                      style={{ background: 'none', border: '1px solid #3f4348', borderRadius: 5, padding: '3px 8px', color: '#72767d', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                      Leave
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ paddingTop: 12, borderTop: '1px solid #3f4348', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isOwner ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(237,66,69,.08)', border: '1px solid rgba(237,66,69,.25)', borderRadius: 8, padding: '8px 14px', color: '#ed4245', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Trash2 size={14} /> Delete workspace
            </button>
          ) : <div />}
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Close</button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500 }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
