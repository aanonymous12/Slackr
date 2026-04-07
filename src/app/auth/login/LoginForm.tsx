'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('reason') === 'session_expired'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')

    const supabase = createClient()

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      })
      if (error) { setError(error.message); setLoading(false); return }
      setMessage('Password reset email sent! Check your inbox.')
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/'); router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      })
      if (error) { setError(error.message); setLoading(false); return }
      setMessage('Check your email to confirm your account.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg,#4a154b,#7b2d8b)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', color: '#fff', marginBottom: '14px' }}>S</div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#f2f3f5', margin: '0 0 4px' }}>Slackr</h1>
          <p style={{ color: '#72767d', fontSize: '14px', margin: 0 }}>
            {mode === 'login' ? 'Sign in to your workspace' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
          </p>
          {sessionExpired && (
            <div style={{ marginTop: '12px', background: 'rgba(250,166,26,.12)', border: '1px solid rgba(250,166,26,.4)', borderRadius: '8px', padding: '10px 14px', color: '#fbbf24', fontSize: '13px' }}>
              Your session expired. Please sign in again.
            </div>
          )}
        </div>

        {/* Tab switcher */}
        {mode !== 'reset' && (
          <div style={{ display: 'flex', background: '#2c2f33', borderRadius: '10px', padding: '3px', marginBottom: '18px', gap: '3px' }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setMessage('') }}
                style={{ flex: 1, padding: '9px', borderRadius: '7px', border: 'none', background: mode === m ? '#222529' : 'transparent', color: mode === m ? '#f2f3f5' : '#72767d', cursor: 'pointer', fontSize: '14px', fontWeight: mode === m ? 600 : 400, transition: 'all .15s' }}>
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>
        )}

        <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: '12px', padding: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {mode === 'signup' && (
              <div>
                <label style={lbl}>Full name</label>
                <input style={inp} type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" required autoComplete="name" />
              </div>
            )}
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
            </div>
            {mode !== 'reset' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage('') }}
                      style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontSize: '12px' }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>
            )}

            {error && <div style={{ background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.35)', borderRadius: '8px', padding: '10px 14px', color: '#fc8181', fontSize: '13px' }}>{error}</div>}
            {message && <div style={{ background: 'rgba(46,182,125,.1)', border: '1px solid rgba(46,182,125,.35)', borderRadius: '8px', padding: '10px 14px', color: '#4ade80', fontSize: '13px' }}>{message}</div>}

            <button type="submit" disabled={loading}
              style={{ background: '#4a90d9', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '2px' }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset email'}
            </button>
          </form>

          {mode === 'reset' && (
            <button onClick={() => { setMode('login'); setError(''); setMessage('') }}
              style={{ display: 'block', width: '100%', marginTop: '14px', background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', fontSize: '13px', textAlign: 'center' }}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#b9bbbe', marginBottom: '6px' }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: '6px', padding: '10px 12px', color: '#f2f3f5', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }
