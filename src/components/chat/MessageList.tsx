'use client'

import { useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { Smile, MessageSquare, Trash2, Edit2, Download, Play, Pause } from 'lucide-react'

const EMOJI_QUICK = ['👍','❤️','😂','🎉','🔥','👀','✅','🚀']

interface Props {
  messages: Record<string, unknown>[]
  currentUserId: string
  onThreadOpen: (msg: Record<string, unknown>) => void
  onReact: (messageId: string, emoji: string) => void
  onDeleteMessage: (messageId: string) => void
  onEditMessage: (messageId: string, content: string) => void
}

export default function MessageList({ messages, currentUserId, onThreadOpen, onReact, onDeleteMessage, onEditMessage }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)

  function getDateLabel(dateStr: string) {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'MMMM d, yyyy')
  }

  function shouldShowDivider(i: number) {
    if (i === 0) return true
    const prev = new Date(String((messages[i-1] as Record<string,unknown>).created_at))
    const curr = new Date(String((messages[i] as Record<string,unknown>).created_at))
    return prev.toDateString() !== curr.toDateString()
  }

  function shouldGroupWithPrev(i: number) {
    if (i === 0) return false
    const prev = messages[i-1] as Record<string,unknown>
    const curr = messages[i] as Record<string,unknown>
    const ps = prev.sender as Record<string,unknown>
    const cs = curr.sender as Record<string,unknown>
    if (ps?.id !== cs?.id) return false
    return new Date(String(curr.created_at)).getTime() - new Date(String(prev.created_at)).getTime() < 300000
  }

  function groupReactions(reactions: Record<string,unknown>[]) {
    const map: Record<string, { count: number; users: string[]; hasMe: boolean }> = {}
    for (const r of reactions) {
      const e = String(r.emoji)
      if (!map[e]) map[e] = { count: 0, users: [], hasMe: false }
      map[e].count++
      const p = r.profiles as Record<string,unknown>
      map[e].users.push(String(p?.full_name || 'Someone'))
      if (r.user_id === currentUserId) map[e].hasMe = true
    }
    return map
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  function renderContent(text: string) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/@([A-Za-z][\w ]*?)(?=\s|$)/g, '<span class="mention-chip">@$1</span>')
      .replace(/`([^`]+)`/g, '<code style="background:#2c2f33;border:1px solid #3f4348;border-radius:4px;padding:1px 5px;font-family:monospace;font-size:12px;color:#e3e5e8">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f2f3f5">$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
    return colors[Math.abs(h) % colors.length]
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  function isImageFile(url: string, type?: string, name?: string) {
    if (type?.startsWith('image/')) return true
    const ext = (url || name || '').split('.').pop()?.toLowerCase()
    return ['jpg','jpeg','png','gif','webp','svg'].includes(ext || '')
  }

  function isAudioFile(url: string, type?: string, name?: string) {
    if (type?.startsWith('audio/')) return true
    const ext = (url || name || '').split('.').pop()?.toLowerCase()
    return ['mp3','wav','webm','ogg','m4a','aac'].includes(ext || '')
  }

  function isVideoFile(url: string, type?: string, name?: string) {
    if (type?.startsWith('video/')) return true
    const ext = (url || name || '').split('.').pop()?.toLowerCase()
    return ['mp4','webm','mov','avi','mkv'].includes(ext || '')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 8px' }}>
      {messages.map((msg, i) => {
        const m = msg as Record<string,unknown>
        const sender = m.sender as Record<string,unknown>
        const reactions = (m.reactions as Record<string,unknown>[]) || []
        const grouped = groupReactions(reactions)
        const isMe = m.sender_id === currentUserId
        const isEditing = editingId === String(m.id)
        const msgId = String(m.id)
        const fileUrl = m.file_url as string | undefined
        const fileName = m.file_name as string | undefined
        const fileSize = m.file_size as number | undefined
        const fileType = (m.content_type as string) || ''

        return (
          <div key={msgId}>
            {shouldShowDivider(i) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 16px 10px', color: '#72767d', fontSize: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
                {getDateLabel(String(m.created_at))}
                <div style={{ flex: 1, height: 1, background: '#3f4348' }} />
              </div>
            )}

            <div className="message-row" style={{ padding: `${shouldGroupWithPrev(i) ? 2 : 8}px 16px`, display: 'flex', gap: 10, position: 'relative' }}>
              {!shouldGroupWithPrev(i) ? (
                <div style={{ width: 36, height: 36, borderRadius: 8, background: getAvatarColor(String(sender?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
                  {getInitials(String(sender?.full_name || ''))}
                </div>
              ) : (
                <div style={{ width: 36, flexShrink: 0 }} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                {!shouldGroupWithPrev(i) && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#f2f3f5' }}>{String(sender?.full_name || sender?.username || 'Unknown')}</span>
                    <span style={{ fontSize: 11, color: '#72767d' }}>{format(new Date(String(m.created_at)), 'h:mm a')}</span>
                    {Boolean(m.is_edited) && <span style={{ fontSize: 11, color: '#72767d' }}>(edited)</span>}
                  </div>
                )}

                {m.is_deleted ? (
                  <div style={{ color: '#72767d', fontStyle: 'italic', fontSize: 14 }}>This message was deleted.</div>
                ) : isEditing ? (
                  <div>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (editContent.trim()) { onEditMessage(msgId, editContent.trim()); setEditingId(null) } }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      style={{ width: '100%', background: '#2c2f33', border: '1px solid #4a90d9', borderRadius: 6, padding: '8px 12px', color: '#f2f3f5', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none' }}
                      rows={2}
                    />
                    <div style={{ fontSize: 12, color: '#72767d', marginTop: 4 }}>
                      <span style={{ color: '#4a90d9', cursor: 'pointer' }} onClick={() => { if (editContent.trim()) { onEditMessage(msgId, editContent.trim()); setEditingId(null) } }}>Save</span>
                      {' · '}<span style={{ cursor: 'pointer' }} onClick={() => setEditingId(null)}>Cancel</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Text content */}
                    {Boolean(m.content) && !Boolean(m.is_deleted) && (
                      <div style={{ fontSize: 14, color: '#d1d2d3', lineHeight: 1.6, wordBreak: 'break-word' }}
                        dangerouslySetInnerHTML={{ __html: renderContent(String(m.content)) }} />
                    )}

                    {/* IMAGE */}
                    {Boolean(fileUrl) && isImageFile(fileUrl!, fileType, fileName) && (
                      <div style={{ marginTop: 6, display: 'inline-block', maxWidth: '100%' }}>
                        <img
                          src={fileUrl}
                          alt={fileName || 'Image'}
                          style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 8, display: 'block', cursor: 'pointer', objectFit: 'contain', background: '#1a1d21' }}
                          onClick={() => window.open(fileUrl, '_blank')}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <a href={fileUrl} download={fileName || 'image'} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, color: '#4a90d9', textDecoration: 'none' }}>
                          <Download size={12} /> Download {fileName || 'image'}
                        </a>
                      </div>
                    )}

                    {/* AUDIO */}
                    {Boolean(fileUrl) && isAudioFile(fileUrl!, fileType, fileName) && (
                      <div style={{ marginTop: 6, background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 340 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>🎙</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName || 'Voice message'}</div>
                          <audio controls preload="metadata" style={{ width: '100%', height: 32, outline: 'none' }}>
                            <source src={fileUrl} />
                            Your browser doesn't support audio.
                          </audio>
                        </div>
                        <a href={fileUrl} download={fileName || 'audio'} style={{ color: '#4a90d9', flexShrink: 0 }}><Download size={16} /></a>
                      </div>
                    )}

                    {/* VIDEO */}
                    {Boolean(fileUrl) && isVideoFile(fileUrl!, fileType, fileName) && (
                      <div style={{ marginTop: 6, maxWidth: 420 }}>
                        <video controls preload="metadata" style={{ width: '100%', maxHeight: 280, borderRadius: 10, background: '#000', display: 'block' }}>
                          <source src={fileUrl} />
                          Your browser doesn't support video.
                        </video>
                        <a href={fileUrl} download={fileName || 'video'} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 12, color: '#4a90d9', textDecoration: 'none' }}>
                          <Download size={12} /> Download {fileName || 'video'}
                        </a>
                      </div>
                    )}

                    {/* OTHER FILE */}
                    {Boolean(fileUrl) && !isImageFile(fileUrl!, fileType, fileName) && !isAudioFile(fileUrl!, fileType, fileName) && !isVideoFile(fileUrl!, fileType, fileName) && (
                      <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '10px 14px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 320 }}>
                        <span style={{ fontSize: 24, flexShrink: 0 }}>{getFileIcon(fileName || '')}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
                          <div style={{ fontSize: 11, color: '#72767d' }}>{fileSize ? formatSize(fileSize) : ''}</div>
                        </div>
                        <a href={fileUrl} download={fileName} target="_blank" rel="noreferrer" style={{ color: '#4a90d9', flexShrink: 0 }}><Download size={16} /></a>
                      </div>
                    )}
                  </div>
                )}

                {/* Reactions */}
                {Object.keys(grouped).length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                    {Object.entries(grouped).map(([emoji, data]) => (
                      <button key={emoji} onClick={() => onReact(msgId, emoji)} title={data.users.join(', ')}
                        style={{ background: data.hasMe ? 'rgba(74,144,217,.15)' : '#2c2f33', border: `1px solid ${data.hasMe ? '#4a90d9' : '#3f4348'}`, borderRadius: 12, padding: '2px 8px', fontSize: 13, cursor: 'pointer', color: data.hasMe ? '#4a90d9' : '#b9bbbe', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {emoji} {data.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hover actions */}
              <div className="hover-actions" style={{ position: 'absolute', right: 12, top: -14, background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 1, zIndex: 10 }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowEmojiFor(showEmojiFor === msgId ? null : msgId)} style={hvrBtn} title="React">
                    <Smile size={14} />
                  </button>
                  {showEmojiFor === msgId && (
                    <div style={{ position: 'absolute', bottom: '100%', right: 0, background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 10, padding: 8, display: 'flex', gap: 3, zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,.4)', marginBottom: 4 }}>
                      {EMOJI_QUICK.map(e => (
                        <button key={e} onClick={() => { onReact(msgId, e); setShowEmojiFor(null) }}
                          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', borderRadius: 5, padding: '2px 3px' }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => onThreadOpen(msg)} style={hvrBtn} title="Reply in thread"><MessageSquare size={14} /></button>
                {isMe && !m.is_deleted && (
                  <>
                    <button onClick={() => { setEditingId(msgId); setEditContent(String(m.content)) }} style={hvrBtn} title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => onDeleteMessage(msgId)} style={{ ...hvrBtn, color: '#ed4245' }} title="Delete"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['zip','tar','gz'].includes(ext || '')) return '📦'
  if (['js','ts','py','go','rb'].includes(ext || '')) return '💻'
  if (['doc','docx'].includes(ext || '')) return '📝'
  if (['xls','xlsx'].includes(ext || '')) return '📊'
  return '📎'
}

const hvrBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent', color: '#b9bbbe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
