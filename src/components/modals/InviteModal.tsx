'use client'

import { useState } from 'react'
import { X, Copy, Check, Send, Link } from 'lucide-react'

interface Props {
  workspaceId: string
  workspaceName: string
  currentUserId: string
  onClose: () => void
}

export default function InviteModal({ workspaceId, workspaceName, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin' | 'guest'>('member')
  const [sending, setSending] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [sent, setSent] = useState<string[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  async function generateAndCopyLink() {
    setLinkLoading(true); setError('')
    try {
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, role }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setGeneratedLink(data.url)
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate link')
    } finally { setLinkLoading(false) }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true); setError('')
    try {
      const res = await fetch('/api/invite/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setSent(prev => [...prev, email.trim()])
      setEmail('')
      // Also store the link in case they want to copy it too
      if (data.invite_url) setGeneratedLink(data.invite_url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally { setSending(false) }
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Invite people to {workspaceName}</h2>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>
        <p style={{ color: '#72767d', fontSize: 13, marginTop: 4, marginBottom: 20 }}>
          Only invited people can join. Invite links are unique and expire in 7 days.
        </p>

        {/* Role selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Role for invitee</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['member', 'admin', 'guest'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${role === r ? '#4a90d9' : '#3f4348'}`, background: role === r ? 'rgba(74,144,217,.15)' : '#2c2f33', color: role === r ? '#4a90d9' : '#b9bbbe', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Section 1: Copy shareable link */}
        <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Link size={14} /> Copy invite link
              </div>
              {generatedLink
                ? <div style={{ fontSize: 11, color: '#4a90d9', wordBreak: 'break-all', lineHeight: 1.4 }}>{generatedLink}</div>
                : <div style={{ fontSize: 12, color: '#72767d' }}>Generates a unique one-time link you can share manually</div>
              }
            </div>
            <button onClick={generateAndCopyLink} disabled={linkLoading}
              style={{ flexShrink: 0, background: copied ? 'rgba(46,182,125,.15)' : '#36393f', border: `1px solid ${copied ? '#2eb67d' : '#3f4348'}`, borderRadius: 6, padding: '8px 14px', color: copied ? '#4ade80' : '#b9bbbe', cursor: linkLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, opacity: linkLoading ? .7 : 1 }}>
              {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> {linkLoading ? 'Generating…' : 'Copy link'}</>}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
          <span style={{ fontSize: 12, color: '#72767d' }}>or send by email</span>
          <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
        </div>

        {/* Section 2: Email invite */}
        <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Email address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="colleague@company.com" style={inp} />
            <p style={{ margin: '5px 0 0', fontSize: 11, color: '#72767d' }}>
              They'll receive a real email with an invite link. Requires GMAIL_USER + GMAIL_APP_PASSWORD env vars.
            </p>
          </div>

          {error && (
            <div style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.4)', borderRadius: 8, padding: '10px 14px', color: '#fc8181', fontSize: 13 }}>
              {error}
              {error.includes('GMAIL') && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#fca5a5' }}>
                  Set <code style={{ background: '#3f4348', padding: '1px 4px', borderRadius: 3 }}>GMAIL_USER</code> and <code style={{ background: '#3f4348', padding: '1px 4px', borderRadius: 3 }}>GMAIL_APP_PASSWORD</code> in your Vercel env vars. <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#4a90d9' }}>Generate app password →</a>
                </div>
              )}
            </div>
          )}

          {sent.length > 0 && (
            <div style={{ background: 'rgba(46,182,125,.1)', border: '1px solid rgba(46,182,125,.3)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>✓ Email invites sent to:</div>
              {sent.map(e => <div key={e} style={{ fontSize: 13, color: '#86efac' }}>• {e}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, ...cancelBtn }}>Close</button>
            <button type="submit" disabled={sending || !email.trim()} style={{ flex: 1, ...primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (sending || !email.trim()) ? .6 : 1 }}>
              <Send size={14} /> {sending ? 'Sending…' : 'Send email invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }
const modal: React.CSSProperties = { background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480 }
const closeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 6, padding: 4 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#b9bbbe', marginBottom: 6 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const cancelBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: '1px solid #3f4348', background: '#2c2f33', color: '#b9bbbe', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
const primaryBtn: React.CSSProperties = { padding: '10px', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }
