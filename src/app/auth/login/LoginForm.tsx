'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('reason') === 'session_expired'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await createClient().auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/')
      router.refresh()
    } else {
      const { error } = await createClient().auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      })
      if (error) { setError(error.message); setLoading(false); return }
      setMessage('Check your email for a confirmation link!')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg,#4a154b,#7b2d8b)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '16px' }}>S</div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#f2f3f5', margin: '0 0 6px' }}>Slackr</h1>
          <p style={{ color: '#72767d', fontSize: '14px', margin: 0 }}>
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
          </p>
          {sessionExpired && (
            <div style={{ marginTop: '12px', background: 'rgba(250,166,26,.15)', border: '1px solid rgba(250,166,26,.4)', borderRadius: '8px', padding: '10px 14px', color: '#fbbf24', fontSize: '13px' }}>
              Your session expired (24h limit). Please sign in again.
            </div>
          )}
        </div>

        <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: '12px', padding: '32px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'signup' && (
              <div>
                <label style={labelStyle}>Full name</label>
                <input style={inputStyle} type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" required />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>

            {error && (
              <div style={{ background: 'rgba(237,66,69,0.15)', border: '1px solid rgba(237,66,69,0.4)', borderRadius: '8px', padding: '10px 14px', color: '#fc8181', fontSize: '13px' }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ background: 'rgba(46,182,125,0.15)', border: '1px solid rgba(46,182,125,0.4)', borderRadius: '8px', padding: '10px 14px', color: '#4ade80', fontSize: '13px' }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              background: '#4a90d9', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '12px', fontSize: '15px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              transition: 'background 0.15s',
            }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#72767d' }}>
            {mode === 'login' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => { setMode('signup'); setError('') }} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontWeight: '600' }}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError('') }} style={{ background: 'none', border: 'none', color: '#4a90d9', cursor: 'pointer', fontWeight: '600' }}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: '600', color: '#b9bbbe', marginBottom: '6px'
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: '6px',
  padding: '10px 12px', color: '#f2f3f5', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
}
