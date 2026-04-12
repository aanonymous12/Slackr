'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const VideoHuddle = dynamic(() => import('@/components/huddle/VideoHuddle'), { ssr: false })

function HuddleJoinContent() {
  const params = useSearchParams()
  const router = useRouter()
  const channelId   = params.get('channel_id') || ''
  const channelName = params.get('channel_name') || 'channel'
  const workspaceSlug = params.get('workspace_slug') || ''

  const [status, setStatus] = useState<'checking' | 'joining' | 'in_call' | 'ended' | 'auth_required'>('checking')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    if (!channelId) { router.push('/'); return }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // Store return URL and send to login
        sessionStorage.setItem('post_login_redirect', window.location.href)
        router.push(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }
      setUserId(user.id)
      setStatus('joining')
    })
  }, [channelId, router])

  if (status === 'checking') {
    return (
      <div style={pageStyle}>
        <Spinner />
        <p style={mutedText}>Checking your session…</p>
      </div>
    )
  }

  if (status === 'joining' || status === 'in_call') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f1113' }}>
        <VideoHuddle
          channelId={channelId}
          channelName={channelName}
          workspaceId={undefined}
          currentUserId={userId}
          onClose={() => {
            setStatus('ended')
            if (workspaceSlug) {
              setTimeout(() => router.push(`/workspace/${workspaceSlug}`), 1200)
            }
          }}
        />
      </div>
    )
  }

  if (status === 'ended') {
    return (
      <div style={pageStyle}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>👋</div>
        <h2 style={{ color: '#f2f3f5', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>You left the huddle</h2>
        <p style={{ color: '#72767d', margin: '0 0 20px' }}>Returning to workspace…</p>
        {workspaceSlug && (
          <button onClick={() => router.push(`/workspace/${workspaceSlug}`)}
            style={{ background: '#4a90d9', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Go to workspace
          </button>
        )}
      </div>
    )
  }

  return null
}

export default function HuddleJoinPage() {
  return (
    <Suspense fallback={<div style={pageStyle}><Spinner /><p style={mutedText}>Loading…</p></div>}>
      <HuddleJoinContent />
    </Suspense>
  )
}

function Spinner() {
  return (
    <>
      <div style={{ width: 44, height: 44, border: '3px solid #2eb67d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#0f1113', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 12,
}
const mutedText: React.CSSProperties = { color: '#72767d', fontSize: 14, margin: 0 }
