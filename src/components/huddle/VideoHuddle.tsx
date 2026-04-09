'use client'

import { useState, useEffect, useRef } from 'react'
import { PhoneOff, Minimize2, Maximize2, X } from 'lucide-react'

interface Props {
  channelId: string
  channelName: string
  workspaceId?: string
  currentUserId: string
  onClose: () => void
}

type HuddleState = 'loading' | 'ready' | 'error'

export default function VideoHuddle({ channelId, channelName, workspaceId, currentUserId, onClose }: Props) {
  const [state, setState] = useState<HuddleState>('loading')
  const [minimized, setMinimized] = useState(false)
  const [pip, setPip] = useState(false)
  const [error, setError] = useState('')
  const [huddleId, setHuddleId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pipWindowRef = useRef<Window | null>(null)
  const kitRef = useRef<unknown>(null)
  const cleanedUp = useRef(false)

  useEffect(() => {
    initHuddle()
    return () => { cleanup() }
  }, [])

  async function initHuddle() {
    try {
      // 1. Get ZegoCloud token from server
      const tokenRes = await fetch('/api/zego/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, channel_name: channelName }),
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to get token')

      // 2. Record huddle in DB + notify workspace
      const huddleRes = await fetch('/api/huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'join' }),
      })
      const huddleData = await huddleRes.json()
      if (huddleData.huddle_id) setHuddleId(huddleData.huddle_id)

      // Notify workspace members about huddle
      if (workspaceId) {
        fetch('/api/huddle/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, workspace_id: workspaceId, channel_name: channelName }),
        }).catch(() => {})
      }

      // 3. Load ZegoCloud UIKit dynamically
      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')

      const appID = tokenData.app_id
      const roomID = tokenData.room_id
      const userID = tokenData.user_id
      const userName = tokenData.user_name

      // Use test token if AppSign not configured, production token otherwise
      let kitToken: string
      if (!tokenData.token) {
        // Development / test mode
        kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, '', roomID, userID, userName)
      } else {
        kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(appID, tokenData.token, roomID, userID, userName)
      }

      if (!containerRef.current || cleanedUp.current) return

      // 4. Create ZegoCloud room
      const zp = ZegoUIKitPrebuilt.create(kitToken)
      kitRef.current = zp

      await zp.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.VideoConference,
          config: {
            role: ZegoUIKitPrebuilt.Host,
          },
        },
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: true,
        showMyCameraToggleButton: true,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        showScreenSharingButton: true,        // ✅ screen share
        showTextChat: true,                   // ✅ in-call chat
        showUserList: true,                   // ✅ participant list
        maxUsers: 50,
        layout: 'Auto',
        showLayoutButton: true,               // ✅ switch layouts
        showNonVideoUser: true,
        showOnlyAudioUser: true,
        useFrontFacingCamera: true,
        onJoinRoom: () => {
          setState('ready')
        },
        onLeaveRoom: () => {
          handleLeave()
        },
        onUserJoin: () => {},
        onUserLeave: () => {},
      })

      setState('ready')
    } catch (err) {
      console.error('ZegoCloud init failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setState('error')
    }
  }

  async function cleanup() {
    if (cleanedUp.current) return
    cleanedUp.current = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (kitRef.current) (kitRef.current as any).hangUp?.()
    } catch {}
    if (huddleId) {
      fetch('/api/huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'leave', huddle_id: huddleId }),
      }).catch(() => {})
    }
    pipWindowRef.current?.close()
  }

  async function handleLeave() {
    await cleanup()
    onClose()
  }

  function openPiP() {
    if (pip) {
      pipWindowRef.current?.close()
      setPip(false)
      setMinimized(false)
      return
    }
    const w = window.open(
      '',
      'zego-pip',
      'width=360,height=240,top=60,left=60,toolbar=no,menubar=no,scrollbars=no,resizable=yes'
    )
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Huddle · #${channelName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f1113; overflow: hidden; display: flex; flex-direction: column; height: 100vh; font-family: system-ui; }
    .header { background: #1e3a2e; padding: 6px 10px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #2eb67d; flex-shrink: 0; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #2eb67d; animation: pulse 2s infinite; }
    .label { color: #4ade80; font-size: 12px; font-weight: 600; }
    .leave { margin-left: auto; background: rgba(237,66,69,.2); border: 1px solid rgba(237,66,69,.3); border-radius: 5px; padding: 3px 10px; color: #fc8181; cursor: pointer; font-size: 11px; }
    .cam { flex: 1; background: #000; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  </style>
</head>
<body>
  <div class="header">
    <div class="dot"></div>
    <span class="label">Huddle · #${channelName}</span>
    <button class="leave" onclick="window.close()">Leave</button>
  </div>
  <div class="cam" id="cam"></div>
  <script>
    window.onbeforeunload = function() {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage('pip-closed', '*');
      }
    };
  </script>
</body>
</html>`)
    w.document.close()
    w.onbeforeunload = () => {
      setPip(false)
      setMinimized(false)
    }
    pipWindowRef.current = w
    setPip(true)
    setMinimized(true)
  }

  // Listen for PiP window close message
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data === 'pip-closed') { setPip(false); setMinimized(false) }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // ── MINIMIZED FLOATING BAR ──
  if (minimized) {
    return (
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
        background: '#1e3a2e', border: '1px solid #2eb67d',
        borderRadius: 12, padding: '9px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,.6)', minWidth: 200,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2eb67d', animation: 'zego-pulse 2s infinite', flexShrink: 0 }} />
        <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Huddle · #{channelName}
        </span>
        {pip && (
          <span style={{ fontSize: 11, color: '#86efac', background: 'rgba(46,182,125,.15)', padding: '2px 7px', borderRadius: 10 }}>PiP</span>
        )}
        <button onClick={() => { setMinimized(false); setPip(false); pipWindowRef.current?.close() }} style={fBtn} title="Expand">
          <Maximize2 size={13} color="#4ade80" />
        </button>
        <button onClick={handleLeave} style={{ ...fBtn, background: 'rgba(237,66,69,.2)', border: '1px solid rgba(237,66,69,.3)' }} title="Leave">
          <PhoneOff size={13} color="#fc8181" />
        </button>
        <style>{`@keyframes zego-pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    )
  }

  // ── FULL HUDDLE MODAL ──
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
    }}>
      <div style={{
        width: '100%', maxWidth: 1000, height: '92vh', maxHeight: 720,
        background: '#0f1113', borderRadius: 16,
        border: '1px solid #2eb67d',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,.7)',
      }}>

        {/* Header */}
        <div style={{
          height: 44, padding: '0 14px',
          background: '#1e3a2e', borderBottom: '1px solid #2eb67d',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2eb67d', animation: 'zego-pulse 2s infinite' }} />
          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>Huddle · #{channelName}</span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {/* PiP button */}
            <button onClick={openPiP} style={hBtn}
              title={pip ? 'Close picture-in-picture' : 'Open picture-in-picture'}>
              {pip
                ? <><Maximize2 size={13} color="#86efac" /><span style={{ fontSize: 11, color: '#86efac', marginLeft: 4 }}>Exit PiP</span></>
                : <><Minimize2 size={13} color="#86efac" /><span style={{ fontSize: 11, color: '#86efac', marginLeft: 4 }}>PiP</span></>
              }
            </button>
            {/* Minimize */}
            <button onClick={() => setMinimized(true)} style={hBtn} title="Minimize to bar">
              <Minimize2 size={13} color="#86efac" />
              <span style={{ fontSize: 11, color: '#86efac', marginLeft: 4 }}>Minimize</span>
            </button>
            {/* Leave */}
            <button onClick={handleLeave}
              style={{ ...hBtn, background: 'rgba(237,66,69,.18)', border: '1px solid rgba(237,66,69,.35)' }}
              title="Leave huddle">
              <PhoneOff size={13} color="#fc8181" />
              <span style={{ fontSize: 11, color: '#fc8181', marginLeft: 4 }}>Leave</span>
            </button>
          </div>
        </div>

        {/* ZegoCloud container */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>

          {/* Loading spinner */}
          {state === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#0f1113' }}>
              <div style={{ width: 44, height: 44, border: '3px solid #2eb67d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'zego-spin .8s linear infinite' }} />
              <span style={{ color: '#72767d', fontSize: 14 }}>Connecting to huddle…</span>
            </div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: '#0f1113' }}>
              <div style={{ fontSize: 44 }}>⚠️</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#fc8181' }}>Could not connect to huddle</div>
              <div style={{ fontSize: 13, color: '#72767d', maxWidth: 360 }}>
                {error || 'Check that NEXT_PUBLIC_ZEGO_APP_ID and ZEGO_APP_SIGN are set correctly in your Vercel environment variables.'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { cleanedUp.current = false; setState('loading'); initHuddle() }}
                  style={{ background: '#4a90d9', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Retry
                </button>
                <button onClick={handleLeave}
                  style={{ background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 8, padding: '9px 22px', color: '#fc8181', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ZegoCloud renders here */}
          <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', display: state === 'error' ? 'none' : 'block' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes zego-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes zego-spin  { to { transform: rotate(360deg) } }
        /* Override ZegoCloud UIKit theme to match dark app */
        .zego-uikit-prebuilt { background: #0f1113 !important; }
        .zego-uikit-prebuilt .zego-uikit-prebuilt-toolbar { background: #1a1d21 !important; border-top: 1px solid #2a2d31 !important; }
      `}</style>
    </div>
  )
}

const fBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,255,255,.1)',
  background: 'rgba(255,255,255,.06)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const hBtn: React.CSSProperties = {
  height: 28, padding: '0 10px', borderRadius: 7,
  border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.06)',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
}
