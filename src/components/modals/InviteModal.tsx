'use client'

import { useState } from 'react'
import { X, Copy, Check, Link } from 'lucide-react'

interface Props {
  workspaceId: string
  workspaceName: string
  currentUserId: string
  onClose: () => void
}

export default function InviteModal({ workspaceId, workspaceName, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [sent, setSent] = useState<string[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteLink, setInviteLink] = useState('')

  async function generateLink() {
    setLinkLoading(true)
    try {
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, role }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setInviteLink(data.url)
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate link')
    } finally { setLinkLoading(false) }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)

      // Copy link to clipboard too
      await navigator.clipboard.writeText(data.url).catch(() => {})
      setSent(prev => [...prev, email.trim()])
      setEmail('')

      // Show the generated link
      setInviteLink(data.url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally { setLoading(false) }
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Invite people to {workspaceName}</h2>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>
        <p style={{ color: '#72767d', fontSize: 14, marginTop: 4, marginBottom: 20 }}>
          Share a link or send an invite. Recipients will be able to sign up or log in and join automatically.
        </p>

        {/* Copy invite link */}
        <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link size={13} /> Invite link
              </div>
              {inviteLink ? (
                <div style={{ fontSize: 11, color: '#72767d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteLink}</div>
              ) : (
                <div style={{ fontSize: 12, color: '#72767d' }}>Generate a link anyone can use to join</div>
              )}
            </div>
            <button onClick={generateLink} disabled={linkLoading}
              style={{ background: copied ? 'rgba(46,182,125,.15)' : '#36393f', border: `1px solid ${copied ? '#2eb67d' : '#3f4348'}`, borderRadius: 6, padding: '7px 14px', color: copied ? '#4ade80' : '#b9bbbe', cursor: linkLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0, opacity: linkLoading ? .7 : 1 }}>
              {copied ? <><Check size={14} /> Copied!</> : linkLoading ? 'Generating…' : <><Copy size={14} /> Copy link</>}
            </button>
          </div>
        </div>

        {/* OR divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
          <span style={{ fontSize: 12, color: '#72767d' }}>OR send link via email invite</span>
          <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
        </div>

        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Email address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="teammate@company.com" style={inp} />
          </div>
          <div>
            <label style={lbl}>Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['member', 'admin', 'guest'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${role === r ? '#4a90d9' : '#3f4348'}`, background: role === r ? 'rgba(74,144,217,.15)' : '#2c2f33', color: role === r ? '#4a90d9' : '#b9bbbe', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.4)', borderRadius: 8, padding: '10px 14px', color: '#fc8181', fontSize: 13 }}>{error}</div>}

          {sent.length > 0 && (
            <div style={{ background: 'rgba(46,182,125,.1)', border: '1px solid rgba(46,182,125,.3)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>✓ Invite link generated for:</div>
              {sent.map(e => <div key={e} style={{ fontSize: 13, color: '#86efac' }}>• {e}</div>)}
              <div style={{ fontSize: 11, color: '#4ade80', marginTop: 6 }}>
                📋 Link copied to clipboard — paste it to send manually
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, ...cancelBtn }}>Close</button>
            <button type="submit" disabled={loading || !email.trim()} style={{ flex: 1, ...primaryBtn, opacity: (loading || !email.trim()) ? .6 : 1 }}>
              {loading ? 'Creating invite…' : 'Generate invite link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480 }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#b9bbbe', marginBottom: 6 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const primaryBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
