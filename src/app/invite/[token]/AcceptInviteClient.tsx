'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInviteClient({ token }: { token: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [inviteValid, setInviteValid] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Check if invite is valid and get workspace name
  useEffect(() => {
    async function checkInvite() {
      try {
        const res = await fetch(`/api/invite/info?token=${token}`)
        const data = await res.json()
        if (!res.ok || data.error) { setInviteValid(false); return }
        setInviteValid(true)
        setWorkspaceName(data.workspace_name || '')
        if (data.email && data.email !== 'open-invite@link') setEmail(data.email)
      } catch { setInviteValid(false) }
    }
    checkInvite()
  }, [token])

  async function acceptInvite() {
    setAccepting(true)
    const res = await fetch('/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      setError(data.error || 'Failed to accept invite')
      setAccepting(false)
      return
    }
    router.push(`/workspace/${data.slug}`)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      // Now accept the invite
      await acceptInvite()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  // Already logged in — check and accept immediately
  useEffect(() => {
    if (inviteValid !== true) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) acceptInvite()
    })
  }, [inviteValid])

  if (inviteValid === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#72767d', fontSize: 16 }}>Checking invite…</div>
      </div>
    )
  }

  if (inviteValid === false) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#f2f3f5' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Invalid or expired invite</h2>
          <p style={{ color: '#72767d', marginBottom: 20 }}>This invite link is no longer valid or has already been used.</p>
          <a href="/auth/login" style={{ color: '#4a90d9', textDecoration: 'none', fontWeight: 600 }}>Go to login →</a>
        </div>
      </div>
    )
  }

  if (accepting) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#72767d', fontSize: 16 }}>Joining workspace…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#e8912d', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
            {workspaceName?.[0]?.toUpperCase() || 'W'}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f2f3f5', margin: '0 0 6px' }}>
            {workspaceName ? <>You're invited to <span style={{ color: '#4a90d9' }}>{workspaceName}</span></> : "You're invited!"}
          </h1>
          <p style={{ color: '#72767d', fontSize: 14, margin: 0 }}>
            {mode === 'signup' ? 'Create an account to join' : 'Sign in to join'}
          </p>
        </div>

        <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={lbl}>Full name</label>
                <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" required />
              </div>
            )}
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            {error && <div style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.4)', borderRadius: 8, padding: '10px 14px', color: '#fc8181', fontSize: 13 }}>{error}</div>}
            <button disabled={loading} type="submit"
              style={{ background: '#4a90d9', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1 }}>
              {loading ? 'Please wait…' : mode === 'signup' ? 'Create account & join' : 'Sign in & join'}
            </button>
          </form>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#72767d' }}>
            {mode === 'signup'
              ? <>Already have an account?{' '}<button onClick={() => { setMode('login'); setError('') }} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontWeight: 600 }}>Sign in</button></>
              : <>No account?{' '}<button onClick={() => { setMode('signup'); setError('') }} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontWeight: 600 }}>Sign up</button></>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#b9bbbe', marginBottom: 5 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
