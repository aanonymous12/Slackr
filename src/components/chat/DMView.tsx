'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import ThreadPanel from './ThreadPanel'

interface Props {
  conversation: Record<string, unknown> | null
  initialMessages: Record<string, unknown>[]
  currentUserId: string
  workspaceSlug: string
  workspaceId?: string
  workspaceMembers?: Record<string, unknown>[]
}

export default function DMView({
  conversation, initialMessages, currentUserId,
  workspaceSlug, workspaceId, workspaceMembers = [],
}: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState(initialMessages)
  const [threadMessage, setThreadMessage] = useState<Record<string, unknown> | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const conv = conversation as Record<string, unknown> | null
  const convMembers = (conv?.conversation_members as Record<string, unknown>[]) || []
  const others = convMembers
    .filter(m => (m as Record<string,unknown>).user_id !== currentUserId)
    .map(m => (m as Record<string,unknown>).profiles as Record<string, unknown>)
    .filter(Boolean)

  const isGroup = Boolean(conv?.is_group)
  const displayName = isGroup
    ? String(conv?.name || others.slice(0,3).map(o => String(o?.full_name || o?.username || '?')).join(', '))
    : String(others[0]?.full_name || others[0]?.username || 'Direct Message')
  const first = others[0] as Record<string,unknown> | undefined

  // Build member list for @mentions — combine conversation members + workspace members
  const mentionMembers: Record<string,unknown>[] = workspaceMembers.length > 0
    ? workspaceMembers
    : convMembers.map(m => ({ profiles: (m as Record<string,unknown>).profiles, user_id: (m as Record<string,unknown>).user_id }))

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conv?.id) return
    const sub = supabase.channel(`dm-${conv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conv.id}`,
      }, async payload => {
        const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).single()
        setMessages(prev => [...prev, { ...payload.new, sender, reactions: [] }])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conv.id}` },
        payload => setMessages(prev => prev.map(m =>
          (m as Record<string,unknown>).id === payload.new.id ? { ...m, ...payload.new } : m
        ))
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' },
        async payload => {
          const r = payload.new as Record<string, unknown>
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', r.user_id).single()
          setMessages(prev => prev.map(m => {
            const msg = m as Record<string,unknown>
            if (msg.id !== r.message_id) return m
            return { ...msg, reactions: [...((msg.reactions as Record<string,unknown>[]) || []), { ...r, profiles: profile }] }
          }))
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' },
        payload => setMessages(prev => prev.map(m => {
          const msg = m as Record<string,unknown>
          return { ...msg, reactions: ((msg.reactions as Record<string,unknown>[]) || []).filter(r => r.id !== payload.old.id) }
        }))
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [conv?.id, supabase])

  async function sendMessage(content: string, fileData?: { url: string; name: string; size: number; type: string }) {
    if (!conv?.id || (!content.trim() && !fileData)) return
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: currentUserId,
      content: content || (fileData ? `Shared a file: ${fileData.name}` : ''),
      content_type: fileData ? 'file' : 'text',
      file_url: fileData?.url,
      file_name: fileData?.name,
      file_size: fileData?.size,
    })
  }

  function avatarColor(id: string) {
    const cs = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of id) h = h * 31 + c.charCodeAt(0)
    return cs[Math.abs(h) % cs.length]
  }
  function initials(n: string) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  function statusColor(s: string) { return s==='active'?'#2eb67d':s==='away'?'#faa61a':s==='dnd'?'#ed4245':'#72767d' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#222529', minWidth: 0 }}>

      {/* ── Header ── */}
      <div style={{
        height: 48, padding: '0 14px',
        borderBottom: '1px solid #2a2d31',
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#222529', flexShrink: 0,
      }}>
        {/* Avatar(s) */}
        {isGroup ? (
          <div style={{ display: 'flex', gap: -4, flexShrink: 0 }}>
            {others.slice(0, 3).map((o, i) => (
              <div key={i} style={{
                width: 26, height: 26, borderRadius: '50%',
                background: avatarColor(String(o?.id || i)),
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, border: '2px solid #222529',
                marginLeft: i > 0 ? -6 : 0, position: 'relative', zIndex: 3 - i,
              }}>
                {initials(String(o?.full_name || ''))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: avatarColor(String(first?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {initials(String(first?.full_name || ''))}
            </div>
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: statusColor(String(first?.status || 'offline')), border: '2px solid #222529' }} />
          </div>
        )}

        {/* Name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          {!isGroup && first && (
            <div style={{ fontSize: 11, color: statusColor(String(first.status || 'offline')) }}>
              {first.status === 'active' ? '● Active now' : first.status === 'away' ? '● Away' : first.status === 'dnd' ? '● Do not disturb' : '● Offline'}
            </div>
          )}
          {isGroup && (
            <div style={{ fontSize: 11, color: '#72767d' }}>
              {others.length + 1} members
            </div>
          )}
        </div>
      </div>

      {/* ── DM intro for empty conversations ── */}
      {messages.length === 0 && (
        <div style={{ padding: '48px 24px 20px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: avatarColor(String(first?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, margin: '0 auto 16px' }}>
            {isGroup ? '👥' : initials(String(first?.full_name || ''))}
          </div>
          <h3 style={{ color: '#f2f3f5', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>{displayName}</h3>
          <p style={{ color: '#72767d', margin: 0, fontSize: 14 }}>
            {isGroup
              ? `This is the start of your group conversation.`
              : `This is the beginning of your direct message history with ${displayName}.`}
          </p>
        </div>
      )}

      {/* ── Messages + thread ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            onThreadOpen={setThreadMessage}
            onReact={async (messageId, emoji) => {
              const msg = messages.find(m => (m as Record<string,unknown>).id === messageId) as Record<string,unknown>
              const reactions = (msg?.reactions as Record<string,unknown>[]) || []
              const existing = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji)
              if (existing) await supabase.from('reactions').delete().eq('id', existing.id)
              else await supabase.from('reactions').insert({ message_id: messageId, user_id: currentUserId, emoji })
            }}
            onDeleteMessage={async id => await supabase.from('messages').update({ is_deleted: true, content: 'This message was deleted.' }).eq('id', id)}
            onEditMessage={async (id, content) => await supabase.from('messages').update({ content, is_edited: true }).eq('id', id)}
          />
          <div ref={endRef} />

          <MessageComposer
            placeholder={`Message ${isGroup ? displayName : first?.full_name || displayName}`}
            onSend={sendMessage}
            currentUserId={currentUserId}
            members={mentionMembers}
            workspaceId={workspaceId}
            channelName={displayName}
          />
        </div>

        {threadMessage && (
          <ThreadPanel
            parentMessage={threadMessage}
            currentUserId={currentUserId}
            onClose={() => setThreadMessage(null)}
          />
        )}
      </div>
    </div>
  )
}
