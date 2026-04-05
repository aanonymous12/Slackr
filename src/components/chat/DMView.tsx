'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import MessageList from './MessageList'
import MessageComposer from './MessageComposer'
import ThreadPanel from './ThreadPanel'

interface Props {
  conversation: Record<string, unknown> | null
  initialMessages: Record<string, unknown>[]
  currentUserId: string
  workspaceSlug: string
}

export default function DMView({ conversation, initialMessages, currentUserId }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState(initialMessages)
  const [threadMessage, setThreadMessage] = useState<Record<string, unknown> | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const conv = conversation as Record<string, unknown> | null
  const convMembers = (conv?.conversation_members as Record<string, unknown>[]) || []
  const others = convMembers
    .filter(m => (m as Record<string, unknown>).user_id !== currentUserId)
    .map(m => (m as Record<string, unknown>).profiles as Record<string, unknown>)
    .filter(Boolean)

  const displayName = conv?.is_group
    ? (conv?.name || others.map(o => o?.full_name || o?.username).join(', '))
    : (others[0]?.full_name || others[0]?.username || 'Direct Message')

  const firstOther = others[0] as Record<string, unknown> | undefined

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conv?.id) return
    const sub = supabase
      .channel(`dm-${conv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conv.id}`,
      }, async (payload) => {
        const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).single()
        setMessages(prev => [...prev, { ...payload.new, sender, reactions: [] }])
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'reactions',
      }, async (payload) => {
        const r = payload.new as Record<string, unknown>
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', r.user_id).single()
        setMessages(prev => prev.map(m => {
          const msg = m as Record<string, unknown>
          if (msg.id !== r.message_id) return m
          return { ...msg, reactions: [...((msg.reactions as unknown[]) || []), { ...r, profiles: profile }] }
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
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [conv?.id, supabase])

  async function sendMessage(content: string, fileData?: { url: string; name: string; size: number }) {
    await supabase.from('messages').insert({
      conversation_id: conv?.id,
      sender_id: currentUserId,
      content,
      content_type: fileData ? 'file' : 'text',
      file_url: fileData?.url,
      file_name: fileData?.name,
      file_size: fileData?.size,
    })
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }
  function getInitials(n: string) { return (n || '').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?' }
  function getStatusColor(s: string) { return s==='active'?'#2eb67d':s==='away'?'#faa61a':s==='dnd'?'#ed4245':'#72767d' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#222529' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: getAvatarColor(String(firstOther?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
            {getInitials(String(firstOther?.full_name || firstOther?.username || ''))}
          </div>
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: getStatusColor(String(firstOther?.status || 'offline')), border: '2px solid #222529' }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{String(displayName)}</div>
          <div style={{ fontSize: 12, color: getStatusColor(String(firstOther?.status || 'offline')) }}>
            {firstOther?.status === 'active' ? '● Active now' : firstOther?.status === 'away' ? '● Away' : firstOther?.status === 'dnd' ? '● Do not disturb' : '● Offline'}
          </div>
        </div>
      </div>

      {/* DM intro if first message */}
      {messages.length === 0 && (
        <div style={{ padding: '40px 20px 20px', textAlign: 'center', color: '#72767d' }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, background: getAvatarColor(String(firstOther?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, margin: '0 auto 16px' }}>
            {getInitials(String(firstOther?.full_name || ''))}
          </div>
          <h3 style={{ color: '#f2f3f5', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>{String(displayName)}</h3>
          <p style={{ margin: 0, fontSize: 14 }}>This is the beginning of your direct message history with <strong style={{ color: '#f2f3f5' }}>{String(displayName)}</strong>.</p>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            onThreadOpen={setThreadMessage}
            onReact={async (messageId, emoji) => {
              const msg = messages.find(m => (m as Record<string, unknown>).id === messageId) as Record<string, unknown>
              const reactions = (msg?.reactions as Record<string, unknown>[]) || []
              const existing = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji)
              if (existing) await supabase.from('reactions').delete().eq('id', existing.id)
              else await supabase.from('reactions').insert({ message_id: messageId, user_id: currentUserId, emoji })
            }}
            onDeleteMessage={async (id) => await supabase.from('messages').update({ is_deleted: true, content: 'This message was deleted.' }).eq('id', id)}
            onEditMessage={async (id, content) => await supabase.from('messages').update({ content, is_edited: true }).eq('id', id)}
          />
          <div ref={endRef} />
          <MessageComposer
            placeholder={`Message ${String(displayName)}`}
            onSend={sendMessage}
            currentUserId={currentUserId}
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
