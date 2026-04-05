'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import MessageComposer from './MessageComposer'

interface Props {
  parentMessage: Record<string, unknown>
  currentUserId: string
  onClose: () => void
}

export default function ThreadPanel({ parentMessage, currentUserId, onClose }: Props) {
  const [replies, setReplies] = useState<Record<string, unknown>[]>([])
  const supabase = createClient()
  const endRef = useRef<HTMLDivElement>(null)
  const parent = parentMessage as Record<string, unknown>

  useEffect(() => {
    loadReplies()
    const sub = supabase
      .channel(`thread-${parent.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `thread_parent_id=eq.${parent.id}`,
      }, async (payload) => {
        const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).single()
        setReplies(prev => [...prev, { ...payload.new, sender, reactions: [] }])
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [parent.id])

  async function loadReplies() {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, full_name, username, avatar_url, status), reactions(*)')
      .eq('thread_parent_id', String(parent.id))
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
    setReplies(data || [])
    setTimeout(() => endRef.current?.scrollIntoView(), 100)
  }

  async function sendReply(content: string) {
    await supabase.from('messages').insert({
      channel_id: parent.channel_id,
      conversation_id: parent.conversation_id,
      thread_parent_id: parent.id,
      sender_id: currentUserId,
      content,
    })
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }
  function getInitials(n: string) { return n.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?' }

  const parentSender = parent.sender as Record<string, unknown>

  return (
    <div style={{ width: 340, borderLeft: '1px solid #2a2d31', background: '#222529', display: 'flex', flexDirection: 'column', animation: 'slide-right .2s ease' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Thread</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Parent message */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: getAvatarColor(String(parentSender?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {getInitials(String(parentSender?.full_name || ''))}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{String(parentSender?.full_name || 'Unknown')}</span>
              <span style={{ fontSize: 11, color: '#72767d' }}>{format(new Date(String(parent.created_at)), 'h:mm a')}</span>
            </div>
            <div style={{ fontSize: 14, color: '#d1d2d3', lineHeight: 1.5 }}>{String(parent.content)}</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', color: '#72767d', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
        </div>

        {/* Replies */}
        {replies.map((reply) => {
          const r = reply as Record<string, unknown>
          const rs = r.sender as Record<string, unknown>
          return (
            <div key={String(r.id)} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: getAvatarColor(String(rs?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {getInitials(String(rs?.full_name || ''))}
              </div>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{String(rs?.full_name || 'Unknown')}</span>
                  <span style={{ fontSize: 11, color: '#72767d' }}>{format(new Date(String(r.created_at)), 'h:mm a')}</span>
                </div>
                <div style={{ fontSize: 14, color: '#d1d2d3', lineHeight: 1.5 }}>{String(r.content)}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <MessageComposer
        placeholder="Reply in thread…"
        onSend={sendReply}
        currentUserId={currentUserId}
      />
    </div>
  )
}
