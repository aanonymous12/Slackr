'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInviteClient({ invite, token }: { invite: Record<string, unknown>; token: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState(String(invite.email || ''))
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const workspace = invite.workspaces as Record<string, unknown>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      // Re-navigate so server picks up session and processes invite
      router.push(`/invite/${token}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: String(workspace.icon_color || '#4a154b'), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, marginBottom: 14 }}>
            {String(workspace.icon_letter || workspace.name?.toString()[0] || 'W')}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f2f3f5', margin: '0 0 6px' }}>
            You&apos;re invited to <span style={{ color: '#4a90d9' }}>{String(workspace.name)}</span>
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
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>
            {error && <div style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.4)', borderRadius: 8, padding: '10px 14px', color: '#fc8181', fontSize: 13 }}>{error}</div>}
            <button disabled={loading} type="submit" style={{ background: '#4a90d9', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1 }}>
              {loading ? 'Please wait...' : mode === 'signup' ? 'Join workspace' : 'Sign in & join'}
            </button>
          </form>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#72767d' }}>
            {mode === 'signup'
              ? <>Already have an account? <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontWeight: 600 }}>Sign in</button></>
              : <>No account? <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontWeight: 600 }}>Sign up</button></>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#b9bbbe', marginBottom: 5 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
