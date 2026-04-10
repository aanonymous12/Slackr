'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { PhoneOff, Minimize2, Maximize2 } from 'lucide-react'

interface Props {
  channelId: string
  channelName: string
  workspaceId?: string
  currentUserId: string
  onClose: () => void
}

type UIState = 'loading' | 'ready' | 'error'

export default function VideoHuddle({ channelId, channelName, workspaceId, currentUserId, onClose }: Props) {
  const [uiState, setUiState] = useState<UIState>('loading')
  const [minimized, setMinimized] = useState(false)
  const [pipMode, setPipMode] = useState(false)
  const [error, setError] = useState('')
  const [huddleId, setHuddleId] = useState<string | null>(null)

  // These refs hold the DOM nodes for Zego to render into
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const pipContainerRef  = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zpRef     = useRef<any>(null)
  const didInit   = useRef(false)
  const didClean  = useRef(false)

  // ── Init once after DOM is mounted ──────────────────────────
  useEffect(() => {
    // Tiny delay so React has committed the refs to the DOM
    const timer = setTimeout(() => { initHuddle() }, 100)
    return () => {
      clearTimeout(timer)
      doCleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initHuddle = useCallback(async () => {
    if (didInit.current) return
    didInit.current = true
    didClean.current = false
    setUiState('loading')
    setError('')

    try {
      // 1. Get credentials from server
      const tokenRes = await fetch('/api/zego/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, channel_name: channelName }),
      })
      const td = await tokenRes.json()
      if (!tokenRes.ok || td.error) throw new Error(td.error || 'Failed to get Zego token')

      if (didClean.current) return

      // 2. Record huddle in DB
      const hr = await fetch('/api/huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'join' }),
      })
      const hd = await hr.json()
      if (hd.huddle_id) setHuddleId(hd.huddle_id)

      // 3. Notify workspace members (fire and forget)
      if (workspaceId) {
        fetch('/api/huddle/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_id: channelId,
            workspace_id: workspaceId,
            channel_name: channelName,
          }),
        }).catch(() => {})
      }

      // 4. Load ZegoCloud UIKit (client-only)
      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')

      if (didClean.current) return

      const { app_id, server_secret, room_id, user_id, user_name } = td

      if (!server_secret) {
        throw new Error(
          'ZEGO_SERVER_SECRET is not set. Add it to your Vercel environment variables.\n' +
          'Find it at console.zegocloud.com → Your Project → Basic Info → ServerSecret.'
        )
      }

      // 5. Generate token client-side using ServerSecret
      // (For production with server-generated token, td.token would be used instead)
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        app_id,
        server_secret,
        room_id,
        user_id,
        user_name,
        7200
      )

      if (didClean.current) return

      // 6. Verify container is available
      const container = mainContainerRef.current
      if (!container) throw new Error('Video container not ready. Please try again.')

      // 7. Create ZegoCloud instance (NO cloudProxyConfig — token handles routing)
      const zp = ZegoUIKitPrebuilt.create(kitToken)
      zpRef.current = zp

      // 8. Join room — this renders the full UI into the container
      zp.joinRoom({
        container,
        scenario: { mode: ZegoUIKitPrebuilt.VideoConference },
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: true,
        showMyCameraToggleButton: true,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        showScreenSharingButton: true,
        showUserList: true,
        showTextChat: true,
        showLayoutButton: true,
        showLeaveRoomConfirmDialog: false,
        maxUsers: 50,
        layout: 'Auto',
        onJoinRoom: () => {
          setUiState('ready')
        },
        onLeaveRoom: () => {
          handleLeave()
        },
      })

      // Show ready after a short delay even if onJoinRoom doesn't fire
      // (it sometimes fires for other participants, not self)
      setTimeout(() => {
        setUiState(s => s === 'loading' ? 'ready' : s)
      }, 3000)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('ZegoCloud error:', msg)
      setError(msg)
      setUiState('error')
    }
  }, [channelId, channelName, workspaceId])

  function doCleanup() {
    if (didClean.current) return
    didClean.current = true
    try { zpRef.current?.destroy?.() } catch {}
    if (huddleId) {
      fetch('/api/huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'leave', huddle_id: huddleId }),
      }).catch(() => {})
    }
  }

  function handleLeave() {
    doCleanup()
    onClose()
  }

  // ── PiP: move DOM nodes between containers ───────────────────
  function togglePiP() {
    const main = mainContainerRef.current
    const pip  = pipContainerRef.current
    if (!main || !pip) return

    if (!pipMode) {
      // Move video into PiP
      while (main.firstChild) pip.appendChild(main.firstChild)
      setPipMode(true)
      setMinimized(true)
    } else {
      // Move back to main
      while (pip.firstChild) main.appendChild(pip.firstChild)
      setPipMode(false)
      setMinimized(false)
    }
  }

  // ── Minimized bar ────────────────────────────────────────────
  if (minimized && !pipMode) {
    return (
      <div style={floatingBar}>
        <span style={greenDot} />
        <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Huddle · #{channelName}
        </span>
        <button onClick={() => setMinimized(false)} style={fBtn} title="Expand"><Maximize2 size={13} color="#4ade80" /></button>
        <button onClick={handleLeave} style={{ ...fBtn, background: 'rgba(237,66,69,.22)', border: '1px solid rgba(237,66,69,.35)' }} title="Leave"><PhoneOff size={13} color="#fc8181" /></button>
        <style>{ANIM_CSS}</style>
      </div>
    )
  }

  // ── PiP floating window ──────────────────────────────────────
  if (pipMode) {
    return (
      <>
        <DraggablePiP channelName={channelName} onExpand={togglePiP} onLeave={handleLeave}>
          <div ref={pipContainerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
        </DraggablePiP>
        {/* Keep main container alive (hidden) so Zego instance persists */}
        <div style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: -9999 }}>
          <div ref={mainContainerRef} style={{ width: 320, height: 240 }} />
        </div>
        <style>{ANIM_CSS}</style>
      </>
    )
  }

  // ── Full modal ───────────────────────────────────────────────
  return (
    <>
    <div style={modalOverlay}>
      <div style={modalBox}>

        {/* Header */}
        <div style={modalHeader}>
          <span style={greenDot} />
          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Huddle · #{channelName}
          </span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <HdrBtn onClick={togglePiP} title="Picture-in-picture">
              <Minimize2 size={13} color="#86efac" /><span style={{ fontSize: 11, color: '#86efac' }}>PiP</span>
            </HdrBtn>
            <HdrBtn onClick={() => setMinimized(true)} title="Minimize">
              <span style={{ fontSize: 16, color: '#86efac', lineHeight: 1 }}>—</span>
              <span style={{ fontSize: 11, color: '#86efac' }}>Hide</span>
            </HdrBtn>
            <HdrBtn onClick={handleLeave} danger title="Leave huddle">
              <PhoneOff size={13} color="#fc8181" /><span style={{ fontSize: 11, color: '#fc8181' }}>Leave</span>
            </HdrBtn>
          </div>
        </div>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>

          {/* Loading overlay */}
          {uiState === 'loading' && (
            <div style={overlay}>
              <div style={spinner} />
              <span style={{ color: '#b9bbbe', fontSize: 14 }}>Joining huddle…</span>
              <span style={{ color: '#3f4348', fontSize: 11 }}>AppID: {process.env.NEXT_PUBLIC_ZEGO_APP_ID}</span>
            </div>
          )}

          {/* Error overlay */}
          {uiState === 'error' && (
            <div style={{ ...overlay, padding: '0 28px' }}>
              <div style={{ fontSize: 36 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fc8181', textAlign: 'center' }}>
                Could not join huddle
              </div>
              <div style={{ fontSize: 13, color: '#72767d', textAlign: 'center', lineHeight: 1.6, maxWidth: 380 }}>
                {error}
              </div>
              {/* Quick setup reminder */}
              <div style={{ background: '#1e2124', border: '1px solid #3f4348', borderRadius: 8, padding: '12px 16px', maxWidth: 400, width: '100%' }}>
                <p style={{ fontSize: 12, color: '#b9bbbe', margin: '0 0 6px', fontWeight: 700 }}>Required Vercel env vars:</p>
                <code style={{ fontSize: 11, color: '#4a90d9', lineHeight: 1.9, display: 'block' }}>
                  NEXT_PUBLIC_ZEGO_APP_ID = 2094790355<br />
                  ZEGO_SERVER_SECRET = your‑ServerSecret
                </code>
                <p style={{ fontSize: 11, color: '#72767d', margin: '6px 0 0' }}>
                  Get ServerSecret at console.zegocloud.com → Project → Basic Info
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { didInit.current = false; initHuddle() }}
                  style={{ background: '#4a90d9', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Retry
                </button>
                <button onClick={handleLeave}
                  style={{ background: 'transparent', border: '1px solid #3f4348', borderRadius: 8, padding: '9px 22px', color: '#b9bbbe', cursor: 'pointer', fontSize: 14 }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* ZegoCloud renders here */}
          <div ref={mainContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
    <style>{ANIM_CSS}</style>
    </>
  )
}

// ── Draggable PiP (like Zoom) ─────────────────────────────────
function DraggablePiP({ children, channelName, onExpand, onLeave }: {
  children: React.ReactNode; channelName: string
  onExpand: () => void; onLeave: () => void
}) {
  const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth - 340), y: Math.max(0, window.innerHeight - 260) })
  const dragging = useRef(false)
  const offset   = useRef({ x: 0, y: 0 })
  const W = 320, H = 220

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - W, e.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - H, e.clientY - offset.current.y)),
      })
    }
    const up = () => { dragging.current = false }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup',   up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [])

  return (
    <div onMouseDown={onMouseDown}
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: W, height: H, zIndex: 1001,
        background: '#0f1113', border: '2px solid #2eb67d', borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,.75)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', cursor: 'grab', userSelect: 'none' }}>
      {/* Title bar */}
      <div style={{ height: 30, padding: '0 8px', background: '#1e3a2e', borderBottom: '1px solid #2eb67d',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ ...greenDot, width: 6, height: 6 }} />
        <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Huddle · #{channelName}
        </span>
        <button onClick={onExpand}
          style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Expand to full size">
          <Maximize2 size={11} color="#86efac" />
        </button>
        <button onClick={onLeave}
          style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'rgba(237,66,69,.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Leave huddle">
          <PhoneOff size={11} color="#fc8181" />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', cursor: 'default' }}>{children}</div>
    </div>
  )
}

// ── Small sub-components ──────────────────────────────────────
function HdrBtn({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean
}) {
  return (
    <button onClick={onClick} title={title}
      style={{ height: 28, padding: '0 9px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        background: danger ? 'rgba(237,66,69,.18)' : 'rgba(255,255,255,.07)',
        border: `1px solid ${danger ? 'rgba(237,66,69,.35)' : 'rgba(255,255,255,.12)'}` }}>
      {children}
    </button>
  )
}

// ── Styles ────────────────────────────────────────────────────
const ANIM_CSS = `
  @keyframes zpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes zspin  { to{transform:rotate(360deg)} }
`

const greenDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: '50%', background: '#2eb67d',
  animation: 'zpulse 2s infinite', flexShrink: 0, display: 'inline-block',
}
const floatingBar: React.CSSProperties = {
  position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
  background: '#1e3a2e', border: '1px solid #2eb67d', borderRadius: 12,
  padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,.65)', minWidth: 200,
}
const fBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.07)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 999,
  background: 'rgba(0,0,0,.88)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 12,
}
const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 1040, height: '92vh', maxHeight: 740,
  background: '#0f1113', borderRadius: 16,
  border: '1px solid #2eb67d',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 24px 64px rgba(0,0,0,.75)',
}
const modalHeader: React.CSSProperties = {
  height: 44, padding: '0 14px',
  background: '#1e3a2e', borderBottom: '1px solid #2eb67d',
  display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
}
const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 2,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
  background: '#0f1113',
}
const spinner: React.CSSProperties = {
  width: 44, height: 44,
  border: '3px solid #2eb67d', borderTopColor: 'transparent',
  borderRadius: '50%', animation: 'zspin .8s linear infinite',
}
