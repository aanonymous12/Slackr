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

type State = 'loading' | 'ready' | 'error'

// Custom WSS servers from ZegoCloud dashboard
const ZEGO_WSS_PRIMARY   = 'wss://webliveroom2094790355-api.coolzcloud.com/ws'
const ZEGO_WSS_SECONDARY = 'wss://webliveroom2094790355-api-bak.coolzcloud.com/ws'

export default function VideoHuddle({ channelId, channelName, workspaceId, currentUserId, onClose }: Props) {
  const [uiState, setUiState] = useState<State>('loading')
  const [minimized, setMinimized] = useState(false)
  const [error, setError] = useState('')
  const [huddleId, setHuddleId] = useState<string | null>(null)
  // PiP: we move the video iframe into a small floating div
  const [pipMode, setPipMode] = useState(false)

  const mainContainerRef = useRef<HTMLDivElement>(null)
  const pipContainerRef  = useRef<HTMLDivElement>(null)
  const zpRef    = useRef<unknown>(null)
  const cleaned  = useRef(false)

  const initHuddle = useCallback(async () => {
    cleaned.current = false
    setUiState('loading')
    setError('')

    try {
      // 1. Get token data from server
      const tokenRes = await fetch('/api/zego/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, channel_name: channelName }),
      })
      const td = await tokenRes.json()
      if (!tokenRes.ok || td.error) throw new Error(td.error || 'Token fetch failed')

      // 2. Record huddle + notify
      const hr = await fetch('/api/huddle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'join' }),
      })
      const hd = await hr.json()
      if (hd.huddle_id) setHuddleId(hd.huddle_id)

      if (workspaceId) {
        fetch('/api/huddle/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, workspace_id: workspaceId, channel_name: channelName }),
        }).catch(() => {})
      }

      // 3. Load ZegoCloud UIKit (dynamic import — no SSR)
      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')

      if (cleaned.current) return

      // 4. Generate kit token
      // For production: server already generated token using ServerSecret
      // For test/fallback: generate client-side using ServerSecret passed from server
      let kitToken: string
      if (td.token) {
        // Server-generated production token
        kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          td.app_id, td.token, td.room_id, td.user_id, td.user_name
        )
      } else {
        // Test mode — ServerSecret available, generate locally
        // NOTE: In production, move ServerSecret to server-only env var
        const secret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET_TEST ||
          td.server_secret || ''
        if (!secret) throw new Error(
          'No ZEGO_SERVER_SECRET set in Vercel env vars. Add it at console.zegocloud.com → Project → AppSign & Secret.'
        )
        kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          td.app_id, secret, td.room_id, td.user_id, td.user_name, 7200
        )
      }

      const container = mainContainerRef.current
      if (!container || cleaned.current) return

      // 5. Create ZegoCloud instance with custom WSS server
      const zp = ZegoUIKitPrebuilt.create(kitToken, {
        // Custom WebSocket server addresses from your ZegoCloud dashboard
        cloudProxyConfig: {
          proxyList: [
            { hostName: new URL(ZEGO_WSS_PRIMARY).hostname,   port: 443 },
            { hostName: new URL(ZEGO_WSS_SECONDARY).hostname, port: 443 },
          ],
        },
      })
      zpRef.current = zp

      // 6. Join room with full feature config
      zp.joinRoom({
        container,
        scenario: {
          mode: ZegoUIKitPrebuilt.VideoConference,
        },
        // Camera & mic
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: true,
        showMyCameraToggleButton: true,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        // Screen sharing
        showScreenSharingButton: true,
        // Participants
        showUserList: true,
        maxUsers: 50,
        showNonVideoUser: true,
        showOnlyAudioUser: true,
        // In-call text chat
        showTextChat: true,
        // Layout controls
        layout: 'Auto',
        showLayoutButton: true,
        // Leave button
        showLeaveRoomConfirmDialog: false,
        // Callbacks
        onJoinRoom: () => setUiState('ready'),
        onLeaveRoom: () => handleLeave(),
        onUserJoin: () => {},
        onUserLeave: () => {},
      })

      setUiState('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('ZegoCloud huddle error:', msg)
      setError(msg)
      setUiState('error')
    }
  }, [channelId, channelName, workspaceId])

  useEffect(() => {
    initHuddle()
    return () => { doCleanup() }
  }, [initHuddle])

  function doCleanup() {
    if (cleaned.current) return
    cleaned.current = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (zpRef.current) (zpRef.current as any).destroy?.()
    } catch {}
    if (huddleId) {
      fetch('/api/huddle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'leave', huddle_id: huddleId }),
      }).catch(() => {})
    }
  }

  async function handleLeave() {
    doCleanup()
    onClose()
  }

  // ── PiP: move container DOM node between main and pip divs ──
  function togglePiP() {
    const mainEl = mainContainerRef.current
    const pipEl  = pipContainerRef.current
    if (!mainEl || !pipEl) return

    if (!pipMode) {
      // Move video content into PiP container
      while (mainEl.firstChild) pipEl.appendChild(mainEl.firstChild)
      setPipMode(true)
      setMinimized(true)
    } else {
      // Move back to main container
      while (pipEl.firstChild) mainEl.appendChild(pipEl.firstChild)
      setPipMode(false)
      setMinimized(false)
    }
  }

  // ── MINIMIZED FLOATING BAR ──────────────────────────────────
  if (minimized && !pipMode) {
    return (
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
        background: '#1e3a2e', border: '1px solid #2eb67d', borderRadius: 12,
        padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,.65)', minWidth: 200,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2eb67d', animation: 'zpulse 2s infinite', flexShrink: 0 }} />
        <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Huddle · #{channelName}
        </span>
        <button onClick={() => setMinimized(false)} style={fBtn} title="Expand">
          <Maximize2 size={13} color="#4ade80" />
        </button>
        <button onClick={handleLeave} style={{ ...fBtn, background: 'rgba(237,66,69,.2)', border: '1px solid rgba(237,66,69,.3)' }} title="Leave">
          <PhoneOff size={13} color="#fc8181" />
        </button>
        <style>{`@keyframes zpulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    )
  }

  // ── PiP FLOATING VIDEO ──────────────────────────────────────
  // Small draggable video window (like Zoom PiP)
  if (pipMode) {
    return (
      <>
        {/* Floating PiP video box */}
        <DraggablePiP onExpand={() => { togglePiP() }} onLeave={handleLeave} channelName={channelName}>
          <div ref={pipContainerRef} style={{ width: '100%', height: '100%', background: '#000', overflow: 'hidden' }} />
        </DraggablePiP>
        {/* Hidden main container to keep ZegoCloud instance alive */}
        <div style={{ display: 'none' }}>
          <div ref={mainContainerRef} />
        </div>
      </>
    )
  }

  // ── FULL MODAL ──────────────────────────────────────────────
  return (
    <>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
    }}>
      <div style={{
        width: '100%', maxWidth: 1040, height: '92vh', maxHeight: 740,
        background: '#0f1113', borderRadius: 16,
        border: '1px solid #2eb67d',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,.75)',
      }}>

        {/* Header */}
        <div style={{
          height: 44, padding: '0 14px',
          background: '#1e3a2e', borderBottom: '1px solid #2eb67d',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2eb67d', animation: 'zpulse 2s infinite' }} />
          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Huddle · #{channelName}
          </span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            {/* PiP button */}
            <button onClick={togglePiP} style={hBtn} title="Picture-in-picture — watch call while chatting">
              <Minimize2 size={13} color="#86efac" />
              <span style={{ fontSize: 11, color: '#86efac' }}>PiP</span>
            </button>
            {/* Minimize to bar */}
            <button onClick={() => setMinimized(true)} style={hBtn} title="Minimize to floating bar">
              <span style={{ fontSize: 14, lineHeight: 1 }}>—</span>
              <span style={{ fontSize: 11, color: '#86efac' }}>Hide</span>
            </button>
            {/* Leave */}
            <button onClick={handleLeave} style={{ ...hBtn, background: 'rgba(237,66,69,.18)', border: '1px solid rgba(237,66,69,.35)' }} title="Leave huddle">
              <PhoneOff size={13} color="#fc8181" />
              <span style={{ fontSize: 11, color: '#fc8181' }}>Leave</span>
            </button>
          </div>
        </div>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>

          {/* Spinner */}
          {uiState === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#0f1113', zIndex: 2 }}>
              <div style={{ width: 44, height: 44, border: '3px solid #2eb67d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'zspin .8s linear infinite' }} />
              <span style={{ color: '#72767d', fontSize: 14 }}>Connecting to huddle…</span>
              <span style={{ color: '#3f4348', fontSize: 11 }}>Using server: webliveroom2094790355-api.coolzcloud.com</span>
            </div>
          )}

          {/* Error */}
          {uiState === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: '#0f1113', zIndex: 2 }}>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fc8181' }}>Huddle connection failed</div>
              <div style={{ fontSize: 13, color: '#72767d', maxWidth: 400, lineHeight: 1.6 }}>
                {error}
              </div>
              <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '12px 16px', maxWidth: 420, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b9bbbe', marginBottom: 6 }}>Fix: Add this to Vercel env vars:</div>
                <code style={{ fontSize: 11, color: '#4a90d9', lineHeight: 1.8 }}>
                  NEXT_PUBLIC_ZEGO_APP_ID = 2094790355<br/>
                  ZEGO_SERVER_SECRET = your-server-secret
                </code>
                <div style={{ fontSize: 11, color: '#72767d', marginTop: 6 }}>Find ServerSecret at console.zegocloud.com → Project → Basic Info</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => initHuddle()}
                  style={{ background: '#4a90d9', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Retry
                </button>
                <button onClick={handleLeave}
                  style={{ background: 'rgba(237,66,69,.12)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 8, padding: '9px 22px', color: '#fc8181', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* ZegoCloud renders inside this div */}
          <div ref={mainContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>

    <style>{`
      @keyframes zpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      @keyframes zspin  { to { transform: rotate(360deg) } }
      /* ZegoCloud UIKit dark theme overrides */
      .zego-uikit-prebuilt {
        background: #0f1113 !important;
        font-family: -apple-system, system-ui, sans-serif !important;
      }
    `}</style>
    </>
  )
}

// ── Draggable PiP container — like Zoom's floating video ──────────
interface PiPProps {
  children: React.ReactNode
  channelName: string
  onExpand: () => void
  onLeave: () => void
}

function DraggablePiP({ children, channelName, onExpand, onLeave }: PiPProps) {
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 260 })
  const [size] = useState({ w: 320, h: 220 })
  const draggingRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    draggingRef.current = true
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - size.w, e.clientX - offsetRef.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - size.h, e.clientY - offsetRef.current.y)),
      })
    }
    function onUp() { draggingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [size.w, size.h])

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y,
        width: size.w, height: size.h,
        zIndex: 1001,
        background: '#0f1113',
        borderRadius: 12,
        border: '2px solid #2eb67d',
        boxShadow: '0 8px 40px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
      }}>

      {/* PiP title bar */}
      <div style={{
        height: 32, padding: '0 8px',
        background: '#1e3a2e', borderBottom: '1px solid #2eb67d',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2eb67d', animation: 'zpulse 2s infinite' }} />
        <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          #{channelName}
        </span>
        <button onClick={onExpand}
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Expand">
          <Maximize2 size={11} color="#86efac" />
        </button>
        <button onClick={onLeave}
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(237,66,69,.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Leave">
          <PhoneOff size={11} color="#fc8181" />
        </button>
      </div>

      {/* Video content */}
      <div style={{ flex: 1, overflow: 'hidden', cursor: 'default' }}>
        {children}
      </div>
    </div>
  )
}

const fBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(255,255,255,.07)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const hBtn: React.CSSProperties = {
  height: 28, padding: '0 9px', borderRadius: 7,
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(255,255,255,.07)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
}
