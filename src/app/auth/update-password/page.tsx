'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    const { error } = await createClient().auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔑</div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#f2f3f5', margin: '0 0 6px' }}>Set new password</h1>
          <p style={{ color: '#72767d', fontSize: '14px', margin: 0 }}>Choose a strong password for your account</p>
        </div>
        <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: '12px', padding: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={lbl}>New password</label>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} autoFocus autoComplete="new-password" />
            </div>
            <div>
              <label style={lbl}>Confirm password</label>
              <input style={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required minLength={8} autoComplete="new-password" />
            </div>
            {error && <div style={{ background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.35)', borderRadius: '8px', padding: '10px 14px', color: '#fc8181', fontSize: '13px' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ background: '#4a90d9', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#b9bbbe', marginBottom: '6px' }
const inp: React.CSSProperties = { width: '100%', background: '#2c2f33', border: '1px solid #3f4348', borderRadius: '6px', padding: '10px 12px', color: '#f2f3f5', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }
