'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, Minimize2, Maximize2, Users } from 'lucide-react'

interface Props {
  channelId: string
  channelName: string
  workspaceId?: string
  currentUserId: string
  onClose: () => void
}

type HuddleStatus = 'connecting' | 'connected' | 'error'

export default function VideoHuddle({ channelId, channelName, workspaceId, currentUserId, onClose }: Props) {
  const [status, setStatus] = useState<HuddleStatus>('connecting')
  const [muted, setMuted] = useState(false)
  const [videoOn, setVideoOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [pip, setPip] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [huddleId, setHuddleId] = useState<string | null>(null)
  const [provider, setProvider] = useState<'daily' | 'jitsi'>('jitsi')
  const [roomUrl, setRoomUrl] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pipWindowRef = useRef<Window | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyRef = useRef<any>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    joinHuddle()
    return () => { cleanup() }
  }, [])

  async function cleanup() {
    if (dailyRef.current) {
      try { await dailyRef.current.leave(); dailyRef.current.destroy() } catch {}
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
    }
    if (huddleId) {
      fetch('/api/huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'leave', huddle_id: huddleId }),
      }).catch(() => {})
    }
  }

  async function joinHuddle() {
    try {
      const res = await fetch('/api/huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'join' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setProvider(data.provider)
      setHuddleId(data.huddle_id)

      // Notify all members that huddle started
      if (workspaceId) {
        fetch('/api/huddle/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, workspace_id: workspaceId, channel_name: channelName }),
        }).catch(() => {})
      }

      if (data.provider === 'daily' && data.token) {
        // Daily.co with built-in controls
        const { default: DailyIframe } = await import('@daily-co/daily-js')
        const container = document.getElementById('daily-container')
        if (!container) throw new Error('No container')
        const callFrame = DailyIframe.createFrame(container, {
          showLeaveButton: false,
          showFullscreenButton: false,
          iframeStyle: { width: '100%', height: '100%', border: 'none', borderRadius: '8px' },
        })
        dailyRef.current = callFrame
        callFrame.on('participant-joined', () => setParticipants(Object.keys(callFrame.participants())))
        callFrame.on('participant-left', () => setParticipants(Object.keys(callFrame.participants())))
        await callFrame.join({ url: data.room_url, token: data.token })
      } else {
        // Jitsi fallback
        const domain = 'meet.jit.si'
        const room = data.room_name || `slackr-${channelId.slice(0, 10)}`
        const url = `https://${domain}/${room}#userInfo.displayName="${encodeURIComponent(currentUserId)}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`
        setRoomUrl(url)
      }
      setStatus('connected')
    } catch (err) {
      console.error('Huddle join failed:', err)
      setStatus('error')
    }
  }

  async function toggleScreenShare() {
    if (provider === 'daily' && dailyRef.current) {
      if (sharing) {
        await dailyRef.current.stopScreenShare()
        setSharing(false)
      } else {
        await dailyRef.current.startScreenShare()
        setSharing(true)
      }
    } else if (provider === 'jitsi' && iframeRef.current?.contentWindow) {
      // Jitsi API for screen share
      iframeRef.current.contentWindow.postMessage({ type: sharing ? 'stop-screenshare' : 'start-screenshare' }, '*')
      setSharing(!sharing)
    }
  }

  function toggleMute() {
    setMuted(m => {
      if (dailyRef.current) dailyRef.current.setLocalAudio(m)
      return !m
    })
  }

  function toggleVideo() {
    setVideoOn(v => {
      if (dailyRef.current) dailyRef.current.setLocalVideo(!v)
      return !v
    })
  }

  async function enterPiP() {
    // Open a small popup window as PiP
    if (pip) {
      pipWindowRef.current?.close()
      setPip(false)
      return
    }
    const w = window.open('', 'huddle-pip', 'width=320,height=240,top=100,left=100,toolbar=no,menubar=no,scrollbars=no')
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><title>Huddle</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;overflow:hidden}iframe{width:100vw;height:100vh;border:none}</style></head><body><iframe src="${roomUrl || `https://meet.jit.si/slackr-${channelId.slice(0,10)}`}" allow="camera;microphone;fullscreen;display-capture" allowfullscreen></iframe></body></html>`)
      w.document.close()
      w.onbeforeunload = () => setPip(false)
      pipWindowRef.current = w
      setPip(true)
      setMinimized(true)
    }
  }

  async function handleLeave() {
    await cleanup()
    onClose()
  }

  // Minimized floating bar
  if (minimized) {
    return (
      <div style={{ position: 'fixed', bottom: 16, right: 16, background: '#1e3a2e', border: '1px solid #2eb67d', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,.6)', minWidth: 220 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2eb67d', animation: 'pulse-dot 2s infinite', flexShrink: 0 }} />
        <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600, flex: 1 }}>Huddle · #{channelName}</span>
        <button onClick={() => setMinimized(false)} style={floatBtn} title="Expand"><Maximize2 size={14} color="#4ade80" /></button>
        <button onClick={handleLeave} style={{ ...floatBtn, background: 'rgba(237,66,69,.2)' }} title="Leave"><PhoneOff size={14} color="#fc8181" /></button>
        <style>{`@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 960, height: '90vh', maxHeight: 680, background: '#0f1113', borderRadius: 16, border: '1px solid #2eb67d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '10px 16px', background: '#1e3a2e', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#2eb67d', animation: `pulse-dot 1.5s ${i*.4}s infinite` }} />)}
          </div>
          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>Huddle · #{channelName}</span>
          {participants.length > 0 && (
            <span style={{ color: '#86efac', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={12} /> {participants.length + 1}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={enterPiP} style={hdrBtn} title={pip ? 'Exit picture-in-picture' : 'Picture in picture (open small window)'}>
              {pip ? <Maximize2 size={14} color="#86efac" /> : <Minimize2 size={14} color="#86efac" />}
            </button>
            <button onClick={() => setMinimized(true)} style={hdrBtn} title="Minimize to bar">
              <Minimize2 size={14} color="#86efac" />
            </button>
          </div>
        </div>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
          {status === 'connecting' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, border: '3px solid #2eb67d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: '#72767d', fontSize: 14 }}>Connecting to huddle…</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {status === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fc8181' }}>Could not connect</div>
              <div style={{ fontSize: 13, color: '#72767d' }}>Check browser permissions for camera/microphone.</div>
              <button onClick={joinHuddle} style={{ background: '#4a90d9', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
            </div>
          )}

          {status === 'connected' && provider === 'jitsi' && roomUrl && (
            <iframe
              ref={iframeRef}
              src={roomUrl}
              allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Video huddle"
            />
          )}

          {status === 'connected' && provider === 'daily' && (
            <div id="daily-container" style={{ width: '100%', height: '100%' }} />
          )}
        </div>

        {/* Controls — shown for Jitsi (Daily has its own) */}
        {provider === 'jitsi' && status === 'connected' && (
          <div style={{ padding: '10px 16px', background: '#0f1113', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}
              style={{ ...ctrlBtn, background: muted ? 'rgba(237,66,69,.2)' : 'rgba(255,255,255,.08)', border: `1px solid ${muted ? '#ed4245' : 'rgba(255,255,255,.12)'}` }}>
              {muted ? <MicOff size={16} color="#fc8181" /> : <Mic size={16} color="#fff" />}
              <span style={{ fontSize: 11, color: muted ? '#fc8181' : '#b9bbbe' }}>{muted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button onClick={toggleVideo} title={videoOn ? 'Turn off camera' : 'Turn on camera'}
              style={{ ...ctrlBtn, background: !videoOn ? 'rgba(237,66,69,.2)' : 'rgba(255,255,255,.08)', border: `1px solid ${!videoOn ? '#ed4245' : 'rgba(255,255,255,.12)'}` }}>
              {videoOn ? <Video size={16} color="#fff" /> : <VideoOff size={16} color="#fc8181" />}
              <span style={{ fontSize: 11, color: !videoOn ? '#fc8181' : '#b9bbbe' }}>{videoOn ? 'Camera' : 'No cam'}</span>
            </button>

            <button onClick={toggleScreenShare} title={sharing ? 'Stop sharing' : 'Share screen'}
              style={{ ...ctrlBtn, background: sharing ? 'rgba(74,144,217,.2)' : 'rgba(255,255,255,.08)', border: `1px solid ${sharing ? '#4a90d9' : 'rgba(255,255,255,.12)'}` }}>
              {sharing ? <MonitorOff size={16} color="#4a90d9" /> : <Monitor size={16} color="#fff" />}
              <span style={{ fontSize: 11, color: sharing ? '#4a90d9' : '#b9bbbe' }}>{sharing ? 'Stop share' : 'Share screen'}</span>
            </button>

            <button onClick={handleLeave}
              style={{ ...ctrlBtn, background: '#ed4245', border: 'none', paddingLeft: 20, paddingRight: 20 }}>
              <PhoneOff size={16} color="#fff" />
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Leave</span>
            </button>
          </div>
        )}

        {/* Leave button for Daily */}
        {provider === 'daily' && status === 'connected' && (
          <div style={{ padding: '8px 16px', background: '#0f1113', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <button onClick={handleLeave} style={{ background: '#ed4245', border: 'none', borderRadius: 8, padding: '8px 32px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PhoneOff size={15} /> Leave Huddle
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const floatBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const hdrBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const ctrlBtn: React.CSSProperties = { borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }
