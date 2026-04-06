'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type InviteInfo = {
  workspace_name: string
  workspace_slug: string
  icon_color: string
  icon_letter: string
  email: string
  role: string
}

type Step =
  | 'loading'       // checking invite validity
  | 'auth'          // show login/signup form
  | 'accepting'     // calling accept API
  | 'done'          // redirecting to workspace
  | 'invalid'       // bad/expired token
  | 'error'         // unexpected error

export default function AcceptInviteClient({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading')
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const acceptCalled = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  // ── Step 1: Validate invite token ──────────────────────────
  useEffect(() => {
    validateToken()
  }, [token])

  async function validateToken() {
    try {
      const res = await fetch(`/api/invite/info?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setStep('invalid')
        return
      }
      setInviteInfo(data)
      // Pre-fill email if the invite was addressed to a specific address
      if (data.email && data.email !== 'open-invite@link') {
        setEmail(data.email)
      }

      // ── Step 2: Check if already logged in ──────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Already authenticated → go straight to accept
        await acceptInvite()
      } else {
        setStep('auth')
      }
    } catch {
      setStep('invalid')
    }
  }

  // ── Accept: add user to workspace via server API ────────────
  async function acceptInvite() {
    if (acceptCalled.current) return
    acceptCalled.current = true
    setStep('accepting')
    setStatusMsg('Joining workspace…')

    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()

      if (res.status === 401 && data.error === 'not_authenticated') {
        // Session cookie not propagated yet — try once more after short delay
        acceptCalled.current = false
        await new Promise(r => setTimeout(r, 800))
        const res2 = await fetch('/api/invite/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data2 = await res2.json()
        if (!res2.ok || data2.error) {
          setError(data2.error || 'Failed to join workspace')
          setStep('auth')
          return
        }
        setStep('done')
        setStatusMsg(`You've joined ${data2.workspace_name}! Taking you there…`)
        setTimeout(() => {
          router.push(`/workspace/${data2.slug}`)
          router.refresh()
        }, 600)
        return
      }

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to join workspace')
        setStep('auth')
        return
      }

      setStep('done')
      setStatusMsg(`You've joined ${data.workspace_name}! Taking you there…`)
      setTimeout(() => {
        router.push(`/workspace/${data.slug}`)
        router.refresh()
      }, 600)
    } catch {
      setError('Network error. Please try again.')
      acceptCalled.current = false
      setStep('auth')
    }
  }

  // ── Handle form submit (signup or login) ────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('accepting')
    setStatusMsg(mode === 'signup' ? 'Creating your account…' : 'Signing you in…')

    try {
      if (mode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || email.split('@')[0] },
            // Don't require email confirmation so they can join immediately
            emailRedirectTo: undefined,
          },
        })
        if (signUpErr) throw signUpErr
        if (!data.user) throw new Error('Signup failed — no user returned')

        // For signup, Supabase may return a session immediately if email
        // confirmation is disabled in your project settings.
        // If confirmation is required, session will be null.
        if (!data.session) {
          // Email confirmation required — tell user
          setStep('auth')
          setError('')
          setStatusMsg('')
          setError(
            'Please check your email and confirm your account, then come back to this link to join the workspace.'
          )
          return
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw signInErr
      }

      // Auth succeeded → now accept invite
      // Small delay to let the session cookie propagate
      setStatusMsg('Joining workspace…')
      await new Promise(r => setTimeout(r, 400))
      await acceptInvite()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setStep('auth')
    }
  }

  // ── RENDER ───────────────────────────────────────────────────

  if (step === 'loading') {
    return <Screen><Spinner /><p style={mutedText}>Checking invite…</p></Screen>
  }

  if (step === 'accepting') {
    return <Screen><Spinner /><p style={mutedText}>{statusMsg || 'Joining workspace…'}</p></Screen>
  }

  if (step === 'done') {
    return (
      <Screen>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
        <p style={{ color: '#4ade80', fontSize: 16, fontWeight: 600 }}>{statusMsg}</p>
      </Screen>
    )
  }

  if (step === 'invalid') {
    return (
      <Screen>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#f2f3f5', margin: '0 0 8px', fontSize: 20 }}>Invalid or expired invite</h2>
        <p style={{ color: '#72767d', marginBottom: 20, textAlign: 'center', maxWidth: 320 }}>
          This invite link is no longer valid or has already been used.
        </p>
        <a href="/auth/login" style={{ color: '#4a90d9', fontWeight: 600, textDecoration: 'none' }}>
          Go to login →
        </a>
      </Screen>
    )
  }

  // step === 'auth' or 'error'
  const info = inviteInfo
  const iconColor = info?.icon_color || '#e8912d'
  const iconLetter = info?.icon_letter || info?.workspace_name?.[0]?.toUpperCase() || 'W'
  const wsName = info?.workspace_name || 'a workspace'

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Workspace badge */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: iconColor, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, marginBottom: 14,
            boxShadow: `0 8px 32px ${iconColor}44`,
          }}>
            {iconLetter}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f2f3f5', margin: '0 0 6px' }}>
            You're invited to{' '}
            <span style={{ color: '#4a90d9' }}>{wsName}</span>
          </h1>
          <p style={{ color: '#72767d', fontSize: 14, margin: 0 }}>
            {mode === 'signup'
              ? 'Create a free account to join instantly'
              : 'Sign in to your existing account to join'}
          </p>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: '#2c2f33', borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 }}>
          <button onClick={() => { setMode('signup'); setError('') }}
            style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: mode === 'signup' ? '#222529' : 'transparent', color: mode === 'signup' ? '#f2f3f5' : '#72767d', cursor: 'pointer', fontSize: 14, fontWeight: mode === 'signup' ? 600 : 400, transition: 'all .15s' }}>
            Create account
          </button>
          <button onClick={() => { setMode('login'); setError('') }}
            style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: mode === 'login' ? '#222529' : 'transparent', color: mode === 'login' ? '#f2f3f5' : '#72767d', cursor: 'pointer', fontSize: 14, fontWeight: mode === 'login' ? 600 : 400, transition: 'all .15s' }}>
            Sign in
          </button>
        </div>

        <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: 12, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={lbl}>Your name</label>
                <input
                  style={inp} type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith" autoFocus autoComplete="name"
                />
              </div>
            )}
            <div>
              <label style={lbl}>Email address</label>
              <input
                style={inp} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
              />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <input
                style={inp} type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <div style={{
                background: error.includes('check your email') ? 'rgba(250,166,26,.12)' : 'rgba(237,66,69,.12)',
                border: `1px solid ${error.includes('check your email') ? 'rgba(250,166,26,.4)' : 'rgba(237,66,69,.4)'}`,
                borderRadius: 8, padding: '10px 14px',
                color: error.includes('check your email') ? '#fbbf24' : '#fc8181',
                fontSize: 13, lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <button type="submit" style={{
              background: '#4a90d9', color: '#fff', border: 'none',
              borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', marginTop: 4,
            }}>
              {mode === 'signup' ? `Create account & join ${wsName}` : `Sign in & join ${wsName}`}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#3f4348' }}>
          By joining you agree to our Terms of Service.
          You'll be added to <strong style={{ color: '#72767d' }}>{wsName}</strong> and its public channels automatically.
        </p>
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 40, height: 40,
      border: '3px solid #2a2d31',
      borderTopColor: '#4a90d9',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#b9bbbe', marginBottom: 5 }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '10px 12px', color: '#f2f3f5', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const mutedText: React.CSSProperties = { color: '#72767d', fontSize: 14, margin: 0 }
