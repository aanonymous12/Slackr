'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hash, Lock, Trash2, Search, X, ClipboardList, MessageSquare } from 'lucide-react'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import ThreadPanel from './ThreadPanel'
import HuddleBar from './HuddleBar'
import VideoHuddle from '@/components/huddle/VideoHuddle'
import TaskBoard from '@/components/tasks/TaskBoard'

interface Props {
  channel: Record<string, unknown>
  initialMessages: Record<string, unknown>[]
  channelMembers: Record<string, unknown>[]
  currentUserId: string
  workspaceSlug: string
  activeHuddle: Record<string, unknown> | null
}

export default function ChannelView({
  channel, initialMessages, channelMembers, currentUserId, workspaceSlug, activeHuddle
}: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState(initialMessages)
  const [threadMessage, setThreadMessage] = useState<Record<string, unknown> | null>(null)
  const [huddle, setHuddle] = useState(activeHuddle)
  const [showMembers, setShowMembers] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [searchMsg, setSearchMsg] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const ch = channel as {
    id: string; name: string; description: string
    is_private: boolean; workspace_id: string
  }
  const isAnnouncements = ch.name === 'announcements'
  // Only custom channels (not default ones) can be deleted
  const canDelete = !['general', 'random', 'announcements'].includes(ch.name)
  // Only announcements + custom non-protected get the Tasks tab
  const hasTasks = isAnnouncements

  useEffect(() => {
    if (activeTab === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  // Realtime messages
  useEffect(() => {
    const sub = supabase.channel(`ch-msg-${ch.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${ch.id}` },
        async payload => {
          const msg = payload.new as Record<string, unknown>
          if (msg.thread_parent_id) return
          const { data: sender } = await supabase.from('profiles').select('*').eq('id', msg.sender_id).single()
          setMessages(prev => [...prev, { ...msg, sender, reactions: [] }])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${ch.id}` },
        payload => setMessages(prev => prev.map(m =>
          (m as Record<string,unknown>).id === payload.new.id ? { ...m, ...payload.new } : m
        )))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' },
        async payload => {
          const r = payload.new as Record<string, unknown>
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', r.user_id).single()
          setMessages(prev => prev.map(m => {
            const msg = m as Record<string, unknown>
            if (msg.id !== r.message_id) return m
            return { ...msg, reactions: [...((msg.reactions as Record<string,unknown>[]) || []), { ...r, profiles: profile }] }
          }))
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' },
        payload => setMessages(prev => prev.map(m => {
          const msg = m as Record<string, unknown>
          return { ...msg, reactions: ((msg.reactions as Record<string,unknown>[]) || []).filter(r => r.id !== payload.old.id) }
        })))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === currentUserId) return
        setTypingUsers(prev => prev.includes(payload.name) ? prev : [...prev, payload.name])
        setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== payload.name)), 3000)
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [ch.id, currentUserId, supabase])

  // Realtime huddle
  useEffect(() => {
    const sub = supabase.channel(`huddle-${ch.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'huddles', filter: `channel_id=eq.${ch.id}` },
        async payload => {
          if (payload.eventType === 'UPDATE' && !payload.new.is_active) { setHuddle(null); return }
          const id = (payload.new as Record<string,unknown>).id as string
          const { data } = await supabase.from('huddles')
            .select('*, huddle_participants(user_id, profiles(id, full_name, avatar_url))')
            .eq('id', id).single()
          setHuddle(data)
        })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [ch.id, supabase])

  const sendTypingSignal = useCallback((name: string) => {
    clearTimeout(typingTimeoutRef.current)
    supabase.channel(`ch-msg-${ch.id}`)
      .send({ type: 'broadcast', event: 'typing', payload: { user_id: currentUserId, name } })
  }, [ch.id, currentUserId, supabase])

  async function sendMessage(content: string, fileData?: { url: string; name: string; size: number; type: string }) {
    await supabase.from('messages').insert({
      channel_id: ch.id, sender_id: currentUserId, content,
      content_type: fileData ? 'file' : 'text',
      file_url: fileData?.url, file_name: fileData?.name, file_size: fileData?.size,
    })
    // Notify everyone on announcements
    if (ch.name === 'announcements') {
      fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'announcement', workspace_id: ch.workspace_id, channel_id: ch.id, message: content }),
      }).catch(console.error)
    }
  }

  async function handleDeleteChannel() {
    if (!confirm(`Delete #${ch.name}? All messages will be permanently lost.`)) return
    setDeleting(true)
    const res = await fetch('/api/channel/delete', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: ch.id }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { alert(data.error || 'Failed'); setDeleting(false); return }
    window.location.href = `/workspace/${workspaceSlug}`
  }

  const displayedMessages = searchMsg
    ? messages.filter(m => String((m as Record<string,unknown>).content || '').toLowerCase().includes(searchMsg.toLowerCase()))
    : messages

  const members = channelMembers as { profiles: Record<string, unknown> }[]

  return (
    <>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#222529', minWidth: 0 }}>

      {/* ── PRIMARY HEADER ── */}
      <div style={{
        height: 48, padding: '0 12px',
        borderBottom: '1px solid #2a2d31',
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#222529', flexShrink: 0,
      }}>
        {/* Channel icon + name — truncated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
          {ch.is_private
            ? <Lock size={14} style={{ color: '#72767d', flexShrink: 0 }} />
            : <Hash size={16} style={{ color: '#72767d', flexShrink: 0 }} />
          }
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ch.name}
          </span>
          {ch.description && (
            <span style={{ fontSize: 12, color: '#72767d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1, display: 'none' }} className="ch-desc">
              {' · '}{ch.description}
            </span>
          )}
        </div>

        {/* Right side actions — minimal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

          {/* Search toggle */}
          <button
            onClick={() => { setShowSearch(s => !s); setSearchMsg('') }}
            title="Search messages"
            style={{ ...hdrBtn, background: showSearch ? 'rgba(74,144,217,.12)' : 'transparent', color: showSearch ? '#4a90d9' : '#72767d' }}>
            <Search size={15} />
          </button>

          {/* Start Huddle */}
          <button
            onClick={() => setShowVideo(true)}
            title="Start huddle"
            style={{
              height: 30, padding: '0 10px',
              background: showVideo ? 'rgba(46,182,125,.15)' : '#2c2f33',
              border: `1px solid ${showVideo ? '#2eb67d' : '#3f4348'}`,
              borderRadius: 20, color: showVideo ? '#4ade80' : '#b9bbbe',
              fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: showVideo ? '#2eb67d' : '#72767d', flexShrink: 0 }} />
            <span className="huddle-label">Huddle</span>
          </button>

          {/* Delete — custom channels only */}
          {canDelete && (
            <button
              onClick={handleDeleteChannel}
              disabled={deleting}
              title={`Delete #${ch.name}`}
              style={{ ...hdrBtn, color: '#ed4245', background: 'rgba(237,66,69,.08)', border: '1px solid rgba(237,66,69,.2)' }}>
              {deleting ? <span style={{ fontSize: 10 }}>…</span> : <Trash2 size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* ── SECONDARY NAV — tabs for announcements channel (Slack-style) ── */}
      {hasTasks && (
        <div style={{
          height: 38, display: 'flex', alignItems: 'stretch',
          borderBottom: '1px solid #2a2d31', background: '#1e2124',
          flexShrink: 0, paddingLeft: 12,
        }}>
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 14px', border: 'none', background: 'transparent',
              color: activeTab === 'chat' ? '#f2f3f5' : '#72767d',
              fontSize: 13, fontWeight: activeTab === 'chat' ? 600 : 400,
              cursor: 'pointer', borderBottom: activeTab === 'chat' ? '2px solid #4a90d9' : '2px solid transparent',
              transition: 'color .15s',
            }}>
            <MessageSquare size={14} /> Messages
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 14px', border: 'none', background: 'transparent',
              color: activeTab === 'tasks' ? '#f2f3f5' : '#72767d',
              fontSize: 13, fontWeight: activeTab === 'tasks' ? 600 : 400,
              cursor: 'pointer', borderBottom: activeTab === 'tasks' ? '2px solid #4a90d9' : '2px solid transparent',
              transition: 'color .15s',
            }}>
            <ClipboardList size={14} /> Tasks
          </button>
        </div>
      )}

      {/* ── SEARCH BAR ── */}
      {showSearch && (
        <div style={{ padding: '6px 12px', background: '#1a1d21', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Search size={13} style={{ color: '#72767d', flexShrink: 0 }} />
          <input autoFocus value={searchMsg} onChange={e => setSearchMsg(e.target.value)}
            placeholder={`Search in #${ch.name}…`}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f2f3f5', fontSize: 14, fontFamily: 'inherit' }} />
          {searchMsg && (
            <span style={{ fontSize: 11, color: '#72767d', flexShrink: 0 }}>
              {displayedMessages.length} result{displayedMessages.length !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchMsg('') }}
            style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── HUDDLE BAR ── */}
      {huddle && (
        <HuddleBar channelId={ch.id} currentUserId={currentUserId} huddle={huddle}
          onLeave={async () => {
            await supabase.from('huddle_participants')
              .update({ left_at: new Date().toISOString() })
              .eq('huddle_id', (huddle as Record<string,unknown>).id)
              .eq('user_id', currentUserId)
            const { data: rem } = await supabase.from('huddle_participants')
              .select('id').eq('huddle_id', (huddle as Record<string,unknown>).id).is('left_at', null)
            if (!rem?.length) await supabase.from('huddles')
              .update({ is_active: false, ended_at: new Date().toISOString() })
              .eq('id', (huddle as Record<string,unknown>).id)
            setHuddle(null)
          }} />
      )}

      {/* ── CONTENT AREA ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Tasks tab */}
        {hasTasks && activeTab === 'tasks' ? (
          <TaskBoard workspaceId={ch.workspace_id} currentUserId={currentUserId} members={channelMembers} />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <MessageList
              messages={displayedMessages}
              currentUserId={currentUserId}
              onThreadOpen={setThreadMessage}
              onReact={async (messageId, emoji) => {
                const msg = messages.find(m => (m as Record<string,unknown>).id === messageId) as Record<string,unknown>
                const reactions = (msg?.reactions as Record<string,unknown>[]) || []
                const existing = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji)
                if (existing) await supabase.from('reactions').delete().eq('id', existing.id)
                else await supabase.from('reactions').insert({ message_id: messageId, user_id: currentUserId, emoji })
              }}
              onDeleteMessage={async id => {
                await supabase.from('messages').update({ is_deleted: true, content: 'This message was deleted.' }).eq('id', id)
              }}
              onEditMessage={async (id, content) => {
                await supabase.from('messages').update({ content, is_edited: true }).eq('id', id)
              }}
            />
            <div ref={messagesEndRef} />

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div style={{ padding: '3px 16px 6px', display: 'flex', alignItems: 'center', gap: 7, color: '#b9bbbe', fontSize: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#72767d', animation: `pulse-dot 1.2s ${i*.2}s infinite` }} />
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
              members={channelMembers}
              workspaceId={ch.workspace_id}
              channelId={ch.id}
              channelName={ch.name}
            />
          </div>
        )}

        {/* Thread panel */}
        {threadMessage && !(hasTasks && activeTab === 'tasks') && (
          <ThreadPanel
            parentMessage={threadMessage}
            currentUserId={currentUserId}
            onClose={() => setThreadMessage(null)}
          />
        )}

        {/* Members side panel — only if explicitly toggled */}
        {showMembers && (
          <div style={{ width: 240, borderLeft: '1px solid #2a2d31', background: '#222529', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Members ({members.length})</span>
              <button onClick={() => setShowMembers(false)} style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {members.map((m, i) => {
                const p = m.profiles as Record<string, unknown>
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 5 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2c2f33')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: getAvatarColor(String(p?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {getInitials(String(p?.full_name || ''))}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(p?.full_name || p?.username || 'Unknown')}
                      </div>
                      <div style={{ fontSize: 11, color: '#72767d', textTransform: 'capitalize' }}>{String(p?.status || 'offline')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Video huddle overlay */}
    {showVideo && (
      <VideoHuddle
        channelId={ch.id}
        channelName={ch.name}
        workspaceId={ch.workspace_id}
        currentUserId={currentUserId}
        onClose={() => setShowVideo(false)}
      />
    )}

    <style>{`
      @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
      @media (min-width: 600px) {
        .ch-desc { display: inline !important; }
      }
      @media (max-width: 480px) {
        .huddle-label { display: none; }
      }
    `}</style>
    </>
  )
}

function getAvatarColor(str: string) {
  const cs = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
  let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
  return cs[Math.abs(h) % cs.length]
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

const hdrBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 6, border: '1px solid #3f4348',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, transition: 'background .1s',
}
