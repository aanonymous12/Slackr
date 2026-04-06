'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, Users, MessageSquare, X, Maximize2 } from 'lucide-react'

interface Props {
  channelId: string
  channelName: string
  currentUserId: string
  onClose: () => void
}

export default function VideoHuddle({ channelId, channelName, currentUserId, onClose }: Props) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [muted, setMuted] = useState(false)
  const [videoOn, setVideoOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const [roomUrl, setRoomUrl] = useState('')
  const [provider, setProvider] = useState<'daily' | 'jitsi'>('jitsi')
  const [huddleId, setHuddleId] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const dailyRef = useRef<unknown>(null)

  useEffect(() => {
    joinHuddle()
    return () => { leaveHuddle() }
  }, [])

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

      if (data.provider === 'daily') {
        // Load Daily.co SDK dynamically
        const { default: DailyIframe } = await import('@daily-co/daily-js')
        const callFrame = DailyIframe.createFrame(iframeRef.current!, {
          showLeaveButton: false,
          showFullscreenButton: true,
          iframeStyle: { width: '100%', height: '100%', border: 'none', borderRadius: '8px' },
        })
        dailyRef.current = callFrame
        await callFrame.join({ url: data.room_url, token: data.token })
        callFrame.on('participant-joined', () => {
          setParticipants(Object.keys(callFrame.participants()))
        })
        callFrame.on('participant-left', () => {
          setParticipants(Object.keys(callFrame.participants()))
        })
        setStatus('connected')
      } else {
        // Jitsi fallback via iframe
        setRoomUrl(`${data.room_url}#userInfo.displayName="${currentUserId}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=${muted}&config.startWithVideoMuted=${!videoOn}`)
        setStatus('connected')
      }
    } catch (err) {
      console.error('Huddle join failed:', err)
      setStatus('error')
    }
  }

  async function leaveHuddle() {
    if (dailyRef.current) {
      try { (dailyRef.current as { destroy: () => void }).destroy() } catch {}
    }
    if (huddleId) {
      await fetch('/api/huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, action: 'leave', huddle_id: huddleId }),
      })
    }
  }

  async function handleLeave() {
    await leaveHuddle()
    onClose()
  }

  function toggleMute() {
    setMuted(m => {
      if (dailyRef.current) (dailyRef.current as { setLocalAudio: (v: boolean) => void }).setLocalAudio(m)
      return !m
    })
  }

  function toggleVideo() {
    setVideoOn(v => {
      if (dailyRef.current) (dailyRef.current as { setLocalVideo: (v: boolean) => void }).setLocalVideo(!v)
      return !v
    })
  }

  if (minimized) {
    return (
      <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#1e3a2e', border: '1px solid #2eb67d', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#2eb67d', opacity: 1 - i*0.25 }} />)}
        </div>
        <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>Huddle · #{channelName}</span>
        <button onClick={() => setMinimized(false)} style={ctrlBtn}><Maximize2 size={14} color="#4ade80" /></button>
        <button onClick={handleLeave} style={{ ...ctrlBtn, background: 'rgba(237,66,69,.2)' }}><PhoneOff size={14} color="#fc8181" /></button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 900, height: '85vh', background: '#1a1d21', borderRadius: 16, border: '1px solid #2eb67d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', background: '#1e3a2e', borderBottom: '1px solid #2eb67d', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#2eb67d', animation: `pulse-dot 1.5s infinite ${i*0.3}s` }} />)}
          </div>
          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>Huddle · #{channelName}</span>
          {participants.length > 0 && (
            <span style={{ color: '#86efac', fontSize: 13 }}>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setMinimized(true)} style={ctrlBtn} title="Minimize"><Maximize2 size={15} color="#86efac" /></button>
            <button onClick={handleLeave} style={{ ...ctrlBtn, background: 'rgba(237,66,69,.15)', border: '1px solid rgba(237,66,69,.3)' }} title="Leave huddle">
              <PhoneOff size={15} color="#fc8181" />
            </button>
          </div>
        </div>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {status === 'connecting' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#72767d', gap: 12 }}>
              <div style={{ width: 48, height: 48, border: '3px solid #2eb67d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 15 }}>Connecting to huddle…</span>
            </div>
          )}
          {status === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fc8181', gap: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Could not connect to huddle</div>
              <div style={{ fontSize: 13, color: '#72767d' }}>Check your DAILY_API_KEY env var or try again.</div>
              <button onClick={joinHuddle} style={{ background: '#4a90d9', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
            </div>
          )}
          {status === 'connected' && provider === 'jitsi' && roomUrl && (
            <iframe
              ref={iframeRef}
              src={roomUrl}
              allow="camera; microphone; display-capture; autoplay; clipboard-write"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
          {status === 'connected' && provider === 'daily' && (
            <div ref={iframeRef as React.RefObject<HTMLDivElement>} style={{ width: '100%', height: '100%' }} />
          )}
        </div>

        {/* Controls (only for Jitsi since Daily has built-in controls) */}
        {provider === 'jitsi' && status === 'connected' && (
          <div style={{ padding: '12px 20px', background: '#0f1113', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button onClick={toggleMute}
              style={{ ...bigCtrlBtn, background: muted ? 'rgba(237,66,69,.2)' : 'rgba(255,255,255,.1)', border: `1px solid ${muted ? '#ed4245' : 'rgba(255,255,255,.15)'}` }}>
              {muted ? <MicOff size={18} color="#fc8181" /> : <Mic size={18} color="#fff" />}
            </button>
            <button onClick={toggleVideo}
              style={{ ...bigCtrlBtn, background: !videoOn ? 'rgba(237,66,69,.2)' : 'rgba(255,255,255,.1)', border: `1px solid ${!videoOn ? '#ed4245' : 'rgba(255,255,255,.15)'}` }}>
              {videoOn ? <Video size={18} color="#fff" /> : <VideoOff size={18} color="#fc8181" />}
            </button>
            <button onClick={handleLeave}
              style={{ ...bigCtrlBtn, background: '#ed4245', border: 'none', padding: '10px 24px', gap: 8 }}>
              <PhoneOff size={18} color="#fff" />
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Leave</span>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  )
}

const ctrlBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const bigCtrlBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
