'use client'

import { useState } from 'react'
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff } from 'lucide-react'

interface Props {
  channelId: string
  currentUserId: string
  huddle?: Record<string, unknown>
  onLeave: () => void
}

export default function HuddleBar({ huddle, onLeave }: Props) {
  const [muted, setMuted] = useState(false)
  const [videoOn, setVideoOn] = useState(false)
  const [sharing, setSharing] = useState(false)

  const participants = ((huddle?.huddle_participants as Record<string, unknown>[]) || [])
    .filter(p => !(p as Record<string, unknown>).left_at)

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }
  function getInitials(n: string) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }

  return (
    <div style={{ background: '#1e3a2e', borderBottom: '1px solid #2eb67d', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
      {/* Animated indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2eb67d', animation: 'pulse-dot 2s infinite' }} />
        <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>Huddle Active</span>
      </div>

      {/* Participant avatars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {participants.slice(0, 6).map((p, i) => {
          const prof = (p as Record<string, unknown>).profiles as Record<string, unknown>
          return (
            <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(String(prof?.id||i)), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '2px solid #1e3a2e', marginLeft: i > 0 ? -6 : 0 }}>
              {getInitials(String(prof?.full_name||''))}
            </div>
          )
        })}
      </div>
      <span style={{ fontSize: 12, color: '#86efac' }}>{participants.length} {participants.length === 1 ? 'person' : 'people'}</span>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
        <button onClick={() => setMuted(!muted)} style={{ ...huddleBtn, background: muted ? 'rgba(237,66,69,.2)' : 'rgba(255,255,255,.1)', color: muted ? '#fc8181' : '#4ade80' }}>
          {muted ? <MicOff size={14} /> : <Mic size={14} />}
          <span style={{ fontSize: 12 }}>{muted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button onClick={() => setVideoOn(!videoOn)} style={{ ...huddleBtn, background: videoOn ? 'rgba(74,144,217,.2)' : 'rgba(255,255,255,.1)', color: videoOn ? '#4a90d9' : '#4ade80' }}>
          {videoOn ? <Video size={14} /> : <VideoOff size={14} />}
          <span style={{ fontSize: 12 }}>Video</span>
        </button>
        <button onClick={() => setSharing(!sharing)} style={{ ...huddleBtn, background: sharing ? 'rgba(74,144,217,.2)' : 'rgba(255,255,255,.1)', color: sharing ? '#4a90d9' : '#4ade80' }}>
          <Monitor size={14} />
          <span style={{ fontSize: 12 }}>Share</span>
        </button>
        <button onClick={onLeave} style={{ ...huddleBtn, background: 'rgba(237,66,69,.2)', color: '#fc8181', borderColor: 'rgba(237,66,69,.3)' }}>
          <PhoneOff size={14} />
          <span style={{ fontSize: 12 }}>Leave</span>
        </button>
      </div>
    </div>
  )
}

const huddleBtn: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '5px 10px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
  transition: 'all .15s',
}
