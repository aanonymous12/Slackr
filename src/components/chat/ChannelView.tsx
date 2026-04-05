'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hash, Lock, Users, Pin, Search, Headphones, ChevronDown } from 'lucide-react'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import ThreadPanel from './ThreadPanel'
import HuddleBar from './HuddleBar'

interface Props {
  channel: Record<string, unknown>
  initialMessages: Record<string, unknown>[]
  channelMembers: Record<string, unknown>[]
  currentUserId: string
  workspaceSlug: string
  activeHuddle: Record<string, unknown> | null
}

export default function ChannelView({ channel, initialMessages, channelMembers, currentUserId, workspaceSlug, activeHuddle }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState(initialMessages)
  const [threadMessage, setThreadMessage] = useState<Record<string, unknown> | null>(null)
  const [huddle, setHuddle] = useState(activeHuddle)
  const [showMembers, setShowMembers] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const ch = channel as { id: string; name: string; description: string; is_private: boolean }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time message subscription
  useEffect(() => {
    const sub = supabase
      .channel(`channel-messages-${ch.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `channel_id=eq.${ch.id}`,
      }, async (payload) => {
        const msg = payload.new as Record<string, unknown>
        if (msg.thread_parent_id) return // handled in thread panel

        // Fetch sender info
        const { data: sender } = await supabase
          .from('profiles').select('*').eq('id', msg.sender_id).single()
        setMessages(prev => [...prev, { ...msg, sender, reactions: [] }])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `channel_id=eq.${ch.id}`,
      }, (payload) => {
        setMessages(prev => prev.map(m =>
          (m as Record<string, unknown>).id === payload.new.id ? { ...m, ...payload.new } : m
        ))
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'reactions',
      }, async (payload) => {
        const r = payload.new as Record<string, unknown>
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', r.user_id).single()
        setMessages(prev => prev.map(m => {
          const msg = m as Record<string, unknown>
          if (msg.id !== r.message_id) return m
          const reactions = [...((msg.reactions as Record<string, unknown>[]) || []), { ...r, profiles: profile }]
          return { ...msg, reactions }
        }))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'reactions',
      }, (payload) => {
        setMessages(prev => prev.map(m => {
          const msg = m as Record<string, unknown>
          const reactions = ((msg.reactions as Record<string, unknown>[]) || []).filter(r => r.id !== payload.old.id)
          return { ...msg, reactions }
        }))
      })
      // Typing indicator via broadcast
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === currentUserId) return
        setTypingUsers(prev => {
          if (!prev.includes(payload.name)) return [...prev, payload.name]
          return prev
        })
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(n => n !== payload.name))
        }, 3000)
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [ch.id, currentUserId, supabase])

  // Real-time huddle subscription
  useEffect(() => {
    const sub = supabase
      .channel(`huddle-${ch.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'huddles',
        filter: `channel_id=eq.${ch.id}`,
      }, async (payload) => {
        if (payload.eventType === 'UPDATE' && !payload.new.is_active) {
          setHuddle(null)
        } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const { data } = await supabase
            .from('huddles')
            .select('*, huddle_participants(user_id, profiles(id, full_name, avatar_url))')
            .eq('id', payload.new.id).single()
          setHuddle(data)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [ch.id, supabase])

  const sendTypingSignal = useCallback(async (name: string) => {
    clearTimeout(typingTimeoutRef.current)
    const chan = supabase.channel(`channel-messages-${ch.id}`)
    chan.send({ type: 'broadcast', event: 'typing', payload: { user_id: currentUserId, name } })
    typingTimeoutRef.current = setTimeout(() => {}, 3000)
  }, [ch.id, currentUserId, supabase])

  async function sendMessage(content: string, fileData?: { url: string; name: string; size: number }) {
    const { error } = await supabase.from('messages').insert({
      channel_id: ch.id,
      sender_id: currentUserId,
      content,
      content_type: fileData ? 'file' : 'text',
      file_url: fileData?.url,
      file_name: fileData?.name,
      file_size: fileData?.size,
    })
    if (error) console.error(error)
  }

  async function startHuddle() {
    if (huddle) return
    const { data: h } = await supabase
      .from('huddles').insert({ channel_id: ch.id, started_by: currentUserId }).select().single()
    if (h) {
      await supabase.from('huddle_participants').insert({ huddle_id: h.id, user_id: currentUserId })
      setHuddle(h)
    }
  }

  const members = channelMembers as { profiles: Record<string, unknown> }[]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#222529' }}>

      {/* Channel Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 12, background: '#222529', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
            {ch.is_private ? <Lock size={16} style={{ color: '#72767d' }} /> : <Hash size={18} style={{ color: '#72767d' }} />}
            {ch.name}
          </div>
          {ch.description && <div style={{ fontSize: 13, color: '#72767d', marginTop: 1 }}>{ch.description}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Member avatars */}
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowMembers(!showMembers)}>
            <div style={{ display: 'flex' }}>
              {members.slice(0, 4).map((m, i) => (
                <div key={i} style={{
                  width: 26, height: 26, borderRadius: '50%', border: '2px solid #222529',
                  marginLeft: i > 0 ? -8 : 0, background: getAvatarColor(String(m.profiles?.id || i)),
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, zIndex: 4 - i,
                }}>
                  {getInitials(String(m.profiles?.full_name || ''))}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 13, color: '#b9bbbe', marginLeft: 8, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4a90d9')}
              onMouseLeave={e => (e.currentTarget.style.color = '#b9bbbe')}>
              {members.length} members
            </span>
          </div>

          <button onClick={startHuddle}
            style={{ background: huddle ? 'rgba(46,182,125,.15)' : '#2c2f33', border: `1px solid ${huddle ? '#2eb67d' : '#3f4348'}`, borderRadius: 20, padding: '5px 12px', color: huddle ? '#4ade80' : '#b9bbbe', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: huddle ? '#2eb67d' : '#72767d', display: 'inline-block' }} />
            {huddle ? 'Active Huddle' : 'Start Huddle'}
          </button>
          <button style={hdrBtn}><Search size={16} /></button>
          <button style={hdrBtn}><Pin size={16} /></button>
          <button style={hdrBtn} onClick={() => setShowMembers(!showMembers)}><Users size={16} /></button>
        </div>
      </div>

      {/* Huddle bar if active */}
      {huddle && (
        <HuddleBar
          channelId={ch.id}
          currentUserId={currentUserId}
          huddle={huddle}
          onLeave={async () => {
            await supabase.from('huddle_participants')
              .update({ left_at: new Date().toISOString() })
              .eq('huddle_id', (huddle as Record<string, unknown>).id)
              .eq('user_id', currentUserId)
            // If no participants left, end huddle
            const { data: remaining } = await supabase
              .from('huddle_participants')
              .select('id').eq('huddle_id', (huddle as Record<string, unknown>).id).is('left_at', null)
            if (!remaining || remaining.length === 0) {
              await supabase.from('huddles').update({ is_active: false, ended_at: new Date().toISOString() })
                .eq('id', (huddle as Record<string, unknown>).id)
            }
            setHuddle(null)
          }}
        />
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main message area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            onThreadOpen={setThreadMessage}
            onReact={async (messageId, emoji) => {
              const msg = messages.find(m => (m as Record<string, unknown>).id === messageId) as Record<string, unknown>
              const reactions = (msg?.reactions as Record<string, unknown>[]) || []
              const existing = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji)
              if (existing) {
                await supabase.from('reactions').delete().eq('id', existing.id)
              } else {
                await supabase.from('reactions').insert({ message_id: messageId, user_id: currentUserId, emoji })
              }
            }}
            onDeleteMessage={async (messageId) => {
              await supabase.from('messages').update({ is_deleted: true, content: 'This message was deleted.' }).eq('id', messageId)
            }}
            onEditMessage={async (messageId, content) => {
              await supabase.from('messages').update({ content, is_edited: true }).eq('id', messageId)
            }}
          />
          <div ref={messagesEndRef} />

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div style={{ padding: '4px 20px 8px', display: 'flex', alignItems: 'center', gap: 8, color: '#b9bbbe', fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#72767d', animation: `pulse-dot 1.2s infinite ${i * 0.2}s` }} />
                ))}
              </div>
              <span><strong>{typingUsers.join(', ')}</strong> {typingUsers.length === 1 ? 'is' : 'are'} typing…</span>
            </div>
          )}

          <MessageComposer
            placeholder={`Message #${ch.name}`}
            onSend={sendMessage}
            onTyping={sendTypingSignal}
            currentUserId={currentUserId}
          />
        </div>

        {/* Thread panel */}
        {threadMessage && (
          <ThreadPanel
            parentMessage={threadMessage}
            currentUserId={currentUserId}
            onClose={() => setThreadMessage(null)}
          />
        )}

        {/* Members panel */}
        {showMembers && (
          <div style={{ width: 260, borderLeft: '1px solid #2a2d31', background: '#222529', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Members</span>
              <button onClick={() => setShowMembers(false)} style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {members.map((m, i) => {
                const p = m.profiles as Record<string, unknown>
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 6, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2c2f33')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: getAvatarColor(String(p?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {getInitials(String(p?.full_name || ''))}
                      </div>
                      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: getStatusColor(String(p?.status || 'offline')), border: '2px solid #222529' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>{String(p?.full_name || p?.username || 'Unknown')}</div>
                      <div style={{ fontSize: 12, color: '#72767d' }}>{String(p?.status || 'offline')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getAvatarColor(str: string) {
  const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b','#e91e8c']
  let hash = 0
  for (const c of str) hash = hash * 31 + c.charCodeAt(0)
  return colors[Math.abs(hash) % colors.length]
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}
function getStatusColor(status: string) {
  return status === 'active' ? '#2eb67d' : status === 'away' ? '#faa61a' : status === 'dnd' ? '#ed4245' : '#72767d'
}

const hdrBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent',
  color: '#b9bbbe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
