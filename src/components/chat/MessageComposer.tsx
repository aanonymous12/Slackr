'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Smile, AtSign, Video, Mic, Bold, Italic, Code, Send, X, StopCircle } from 'lucide-react'

const EMOJI_LIST = ['😀','😂','😍','🤔','👍','👎','❤️','🔥','🎉','✅','⚠️','🚀','💯','👀','🙏','😎','🤝','💪','🎯','⭐','🏔️','✈️','📋','🔔']

interface FilePreview { url: string; name: string; size: number; type: string }
interface MentionSuggestion { id: string; full_name: string; username: string | null }

interface Props {
  placeholder?: string
  onSend: (content: string, fileData?: { url: string; name: string; size: number; type: string }) => void
  onTyping?: (name: string) => void
  currentUserId: string
  disabled?: boolean
  members?: Record<string, unknown>[]
  workspaceId?: string
  channelId?: string
  channelName?: string
}

export default function MessageComposer({
  placeholder, onSend, onTyping, currentUserId,
  disabled, members = [], workspaceId, channelId, channelName
}: Props) {
  const [content, setContent] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingVideo, setRecordingVideo] = useState(false)
  const [pendingFile, setPendingFile] = useState<FilePreview | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([])
  const [mentionIdx, setMentionIdx] = useState(0)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobEvent['data'][]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const supabase = createClient()
  const typingRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Build mention list from members
  const memberList: MentionSuggestion[] = members
    .map(m => (m as Record<string, unknown>).profiles as Record<string, unknown>)
    .filter(Boolean)
    .map(p => ({ id: String(p.id), full_name: String(p.full_name || ''), username: p.username as string | null }))

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [content])

  // Detect @mention typing
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)

    // Typing indicator
    clearTimeout(typingRef.current)
    if (val && onTyping) {
      onTyping('You')
    }

    // Mention detection
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const mentionMatch = textBefore.match(/@(\w*)$/)
    if (mentionMatch) {
      const q = mentionMatch[1].toLowerCase()
      setMentionQuery(q)
      const filtered = memberList.filter(m =>
        m.full_name.toLowerCase().includes(q) ||
        (m.username || '').toLowerCase().includes(q)
      ).slice(0, 6)
      setMentionSuggestions(filtered)
      setMentionIdx(0)
    } else {
      setMentionQuery(null)
      setMentionSuggestions([])
    }
  }

  function insertMention(member: MentionSuggestion) {
    const ta = textareaRef.current
    if (!ta) return
    const cursor = ta.selectionStart
    const textBefore = content.slice(0, cursor)
    const textAfter = content.slice(cursor)
    const mentionStart = textBefore.lastIndexOf('@')
    const newContent = textBefore.slice(0, mentionStart) + `@${member.full_name} ` + textAfter
    setContent(newContent)
    setMentionQuery(null)
    setMentionSuggestions([])
    setTimeout(() => {
      ta.focus()
      const pos = mentionStart + member.full_name.length + 2
      ta.setSelectionRange(pos, pos)
    }, 0)
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    // Navigate mention suggestions
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionSuggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionSuggestions[mentionIdx]); return }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionSuggestions([]); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleSend() {
    const text = content.trim()
    if (!text && !pendingFile) return

    // Extract mentions and notify
    const mentionMatches = text.matchAll(/@([A-Za-z][\w ]*?)(?=\s|$)/g)
    const mentionedNames = [...mentionMatches].map(m => m[1].trim())
    if (mentionedNames.length > 0 && workspaceId) {
      const mentionedIds = memberList
        .filter(m => mentionedNames.some(n => m.full_name.toLowerCase() === n.toLowerCase()))
        .map(m => m.id)
        .filter(id => id !== currentUserId)
      if (mentionedIds.length > 0) {
        fetch('/api/mention', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mentioned_user_ids: mentionedIds,
            workspace_id: workspaceId,
            channel_name: channelName,
            channel_id: channelId,
            message_preview: text.slice(0, 200),
          }),
        }).catch(console.error)
      }
    }

    onSend(text || (pendingFile ? `Shared a file: ${pendingFile.name}` : ''), pendingFile || undefined)
    setContent('')
    setPendingFile(null)
    setMentionQuery(null)
    setMentionSuggestions([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `${currentUserId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { data, error } = await supabase.storage.from('attachments').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path)
      setPendingFile({ url: publicUrl, name: file.name, size: file.size, type: file.type })
    } catch (err) { console.error('Upload failed:', err) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function startAudioRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fileName = `voice-note-${Date.now()}.webm`
        const file = new File([blob], fileName, { type: 'audio/webm' })
        setUploading(true)
        const path = `${currentUserId}/${Date.now()}-${fileName}`
        const { data, error } = await supabase.storage.from('attachments').upload(path, file)
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path)
          setPendingFile({ url: publicUrl, name: fileName, size: blob.size, type: 'audio/webm' })
        }
        setUploading(false)
        setRecording(false)
        setRecordSeconds(0)
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
      setRecordSeconds(0)
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch (err) { console.error('Audio recording failed:', err) }
  }

  function stopAudioRecording() {
    mediaRef.current?.stop()
  }

  async function startVideoRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const fileName = `video-note-${Date.now()}.webm`
        const file = new File([blob], fileName, { type: 'video/webm' })
        setUploading(true)
        const path = `${currentUserId}/${Date.now()}-${fileName}`
        const { data, error } = await supabase.storage.from('attachments').upload(path, file)
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path)
          setPendingFile({ url: publicUrl, name: fileName, size: blob.size, type: 'video/webm' })
        }
        setUploading(false)
        setRecordingVideo(false)
        setRecordSeconds(0)
      }
      mr.start()
      mediaRef.current = mr
      setRecordingVideo(true)
      setRecordSeconds(0)
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch (err) { console.error('Video recording failed:', err) }
  }

  function stopVideoRecording() { mediaRef.current?.stop() }

  function wrap(before: string, after: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const selected = content.slice(start, end)
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end)
    setContent(newContent)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + before.length, end + before.length) }, 0)
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const canSend = (content.trim().length > 0 || pendingFile !== null) && !disabled && !uploading
  const isAudio = pendingFile?.type?.startsWith('audio/')
  const isVideo = pendingFile?.type?.startsWith('video/')
  const isImage = pendingFile?.type?.startsWith('image/')

  return (
    <div style={{ padding: '0 12px 12px', flexShrink: 0, position: 'relative' }}>
      {/* Mention suggestions dropdown */}
      {mentionSuggestions.length > 0 && (
        <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 10, overflow: 'hidden', zIndex: 50, boxShadow: '0 -4px 20px rgba(0,0,0,.4)', marginBottom: 4 }}>
          {mentionSuggestions.map((m, i) => (
            <div key={m.id} onClick={() => insertMention(m)}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: i === mentionIdx ? 'rgba(74,144,217,.15)' : 'transparent', borderLeft: i === mentionIdx ? '3px solid #4a90d9' : '3px solid transparent' }}
              onMouseEnter={() => setMentionIdx(i)}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: getAvatarColor(m.id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {m.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5' }}>{m.full_name}</div>
                {m.username && <div style={{ fontSize: 11, color: '#72767d' }}>@{m.username}</div>}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#72767d' }}>↵</span>
            </div>
          ))}
        </div>
      )}

      {/* Recording indicator */}
      {(recording || recordingVideo) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(237,66,69,.1)', border: '1px solid rgba(237,66,69,.3)', borderRadius: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ed4245', animation: 'pulse-dot 1s infinite' }} />
          <span style={{ color: '#fc8181', fontSize: 13, fontWeight: 600 }}>
            {recording ? '🎙 Recording audio' : '🎥 Recording video'} — {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
          </span>
          <button onClick={recording ? stopAudioRecording : stopVideoRecording}
            style={{ marginLeft: 'auto', background: '#ed4245', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <StopCircle size={13} /> Stop
          </button>
        </div>
      )}

      {/* File preview */}
      {pendingFile && (
        <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          {isImage && (
            <img src={pendingFile.url} alt={pendingFile.name} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          )}
          {isAudio && <span style={{ fontSize: 22, flexShrink: 0 }}>🎙</span>}
          {isVideo && <span style={{ fontSize: 22, flexShrink: 0 }}>🎥</span>}
          {!isImage && !isAudio && !isVideo && <span style={{ fontSize: 22, flexShrink: 0 }}>📎</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</div>
            <div style={{ fontSize: 11, color: '#72767d' }}>{formatSize(pendingFile.size)}</div>
          </div>
          <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 10, overflow: 'visible' }}>
        {/* Format bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 10px 4px', borderBottom: '1px solid #3f4348' }}>
          <button onClick={() => wrap('**', '**')} style={fmtBtn} title="Bold"><Bold size={13} /></button>
          <button onClick={() => wrap('_', '_')} style={fmtBtn} title="Italic"><Italic size={13} /></button>
          <button onClick={() => wrap('`', '`')} style={fmtBtn} title="Code"><Code size={13} /></button>
          <span style={{ width: 1, height: 16, background: '#3f4348', margin: '0 4px' }} />
          <span style={{ fontSize: 11, color: '#72767d' }}>Shift+Enter for new line</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '6px 10px 0' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'This channel is archived' : (placeholder || 'Type a message… (@ to mention)')}
            disabled={disabled || uploading}
            rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f2f3f5', fontSize: 14, fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, minHeight: 24, maxHeight: 160 }}
          />
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px 8px', gap: 2 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button onClick={() => fileRef.current?.click()} style={toolBtn} title="Attach file" disabled={uploading}>
            {uploading ? <span style={{ fontSize: 12 }}>⏳</span> : <Paperclip size={16} />}
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowEmoji(!showEmoji)} style={toolBtn} title="Emoji"><Smile size={16} /></button>
            {showEmoji && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 12, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, zIndex: 50, boxShadow: '0 -4px 20px rgba(0,0,0,.5)', marginBottom: 4, width: 220 }}>
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => { setContent(prev => prev + e); setShowEmoji(false); textareaRef.current?.focus() }}
                    style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', borderRadius: 6, padding: '4px 2px' }}
                    onMouseEnter={el => (el.currentTarget.style.background = '#36393f')}
                    onMouseLeave={el => (el.currentTarget.style.background = 'none')}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setContent(prev => prev + '@'); textareaRef.current?.focus(); handleChange({ target: { value: content + '@', selectionStart: content.length + 1 } } as React.ChangeEvent<HTMLTextAreaElement>) }} style={toolBtn} title="Mention someone"><AtSign size={16} /></button>

          {/* Audio record */}
          <button
            onClick={recording ? stopAudioRecording : startAudioRecording}
            style={{ ...toolBtn, color: recording ? '#ed4245' : '#72767d' }}
            title={recording ? 'Stop recording' : 'Record audio message'}>
            {recording ? <StopCircle size={16} /> : <Mic size={16} />}
          </button>

          {/* Video record */}
          <button
            onClick={recordingVideo ? stopVideoRecording : startVideoRecording}
            style={{ ...toolBtn, color: recordingVideo ? '#ed4245' : '#72767d' }}
            title={recordingVideo ? 'Stop recording' : 'Record video message'}>
            {recordingVideo ? <StopCircle size={16} /> : <Video size={16} />}
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={handleSend} disabled={!canSend}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: canSend ? '#4a90d9' : '#2c2f33', color: canSend ? '#fff' : '#72767d', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function getAvatarColor(str: string) {
  const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
  let h = 0; for (const c of str) h = h * 31 + c.charCodeAt(0)
  return colors[Math.abs(h) % colors.length]
}

const fmtBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const toolBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
