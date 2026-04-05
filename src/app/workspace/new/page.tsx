'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createWorkspace } from './actions'

export default function NewWorkspacePage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    try {
      const result = await createWorkspace(name.trim())
      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      if (result?.slug) {
        router.push(`/workspace/${result.slug}`)
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏗️</div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#f2f3f5', margin: '0 0 8px' }}>
            Create your workspace
          </h1>
          <p style={{ color: '#72767d', fontSize: '14px', margin: 0 }}>
            A workspace is where your team communicates.
          </p>
        </div>

        <div style={{ background: '#222529', border: '1px solid #3f4348', borderRadius: '12px', padding: '32px' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#b9bbbe', marginBottom: '6px' }}>
                Workspace name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corp, My Team"
                required
                autoFocus
                style={{
                  width: '100%', background: '#2c2f33', border: '1px solid #3f4348',
                  borderRadius: '6px', padding: '10px 12px', color: '#f2f3f5',
                  fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <p style={{ fontSize: '12px', color: '#72767d', marginTop: '6px', margin: '6px 0 0' }}>
                This will create{' '}
                <strong style={{ color: '#b9bbbe' }}>#general</strong> and{' '}
                <strong style={{ color: '#b9bbbe' }}>#random</strong> automatically.
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(237,66,69,0.15)', border: '1px solid rgba(237,66,69,0.4)',
                borderRadius: '8px', padding: '10px 14px', color: '#fc8181', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                background: '#4a90d9', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '12px', fontSize: '15px', fontWeight: '600',
                cursor: (loading || !name.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !name.trim()) ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Creating workspace…' : 'Create Workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
