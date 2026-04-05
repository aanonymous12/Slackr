'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Smile, AtSign, Video, Mic, Bold, Italic, Code } from 'lucide-react'

const EMOJI_LIST = ['😀','😂','😍','🤔','👍','👎','❤️','🔥','🎉','✅','⚠️','🚀','💯','👀','🙏','😎','🤝','💪','🎯','⭐']

interface Props {
  placeholder?: string
  onSend: (content: string, fileData?: { url: string; name: string; size: number }) => void
  onTyping?: (name: string) => void
  currentUserId: string
  disabled?: boolean
  defaultValue?: string
}

export default function MessageComposer({ placeholder, onSend, onTyping, currentUserId, disabled, defaultValue }: Props) {
  const [content, setContent] = useState(defaultValue || '')
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<{ name: string; size: number } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; size: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const typingRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [content])

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const text = content.trim()
    if (!text && !pendingFile) return
    onSend(text || (pendingFile ? `Shared a file: ${pendingFile.name}` : ''), pendingFile || undefined)
    setContent('')
    setPendingFile(null)
    setUploadPreview(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    // Trigger typing
    clearTimeout(typingRef.current)
    if (onTyping && e.target.value) {
      onTyping('You')
    }
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
      setPendingFile({ url: publicUrl, name: file.name, size: file.size })
      setUploadPreview({ name: file.name, size: file.size })
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const canSend = (content.trim().length > 0 || pendingFile !== null) && !disabled && !uploading

  return (
    <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
      {/* File preview */}
      {uploadPreview && (
        <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 8, padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📎</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5' }}>{uploadPreview.name}</div>
            <div style={{ fontSize: 11, color: '#72767d' }}>{formatSize(uploadPreview.size)}</div>
          </div>
          <button onClick={() => { setPendingFile(null); setUploadPreview(null) }}
            style={{ background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 10, overflow: 'visible', position: 'relative' }}>
        {/* Formatting bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px 4px', borderBottom: '1px solid #3f4348' }}>
          {[
            { icon: <Bold size={14} />, label: 'Bold', action: () => wrap('**', '**') },
            { icon: <Italic size={14} />, label: 'Italic', action: () => wrap('_', '_') },
            { icon: <Code size={14} />, label: 'Code', action: () => wrap('`', '`') },
          ].map(({ icon, label, action }) => (
            <button key={label} onClick={action} title={label} style={fmtBtn}>{icon}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '6px 10px 6px' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'This channel is archived' : (placeholder || 'Type a message…')}
            disabled={disabled || uploading}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#f2f3f5', fontSize: 14, fontFamily: 'inherit', resize: 'none',
              lineHeight: 1.5, minHeight: 24, maxHeight: 160,
            }}
          />
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px 8px', borderTop: '1px solid #3f4348' }}>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
            <button onClick={() => fileRef.current?.click()} style={toolBtn} title="Attach file" disabled={uploading}>
              {uploading ? '⏳' : <Paperclip size={16} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowEmoji(!showEmoji)} style={toolBtn} title="Emoji"><Smile size={16} /></button>
              {showEmoji && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 12, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,.5)', marginBottom: 4 }}>
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={() => { setContent(prev => prev + e); setShowEmoji(false); textareaRef.current?.focus() }}
                      style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', borderRadius: 6, padding: '4px 6px' }}
                      onMouseEnter={el => (el.currentTarget.style.background = '#36393f')}
                      onMouseLeave={el => (el.currentTarget.style.background = 'none')}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setContent(prev => prev + '@')} style={toolBtn} title="Mention"><AtSign size={16} /></button>
            <button style={toolBtn} title="Record video"><Video size={16} /></button>
            <button style={toolBtn} title="Record audio"><Mic size={16} /></button>
          </div>

          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: 32, height: 32, borderRadius: 6, border: 'none',
              background: canSend ? '#4a90d9' : '#2c2f33',
              color: canSend ? '#fff' : '#72767d',
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, transition: 'all .15s',
            }}>
            ➤
          </button>
        </div>
      </div>
    </div>
  )

  function wrap(before: string, after: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const selected = content.slice(start, end)
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }
}

const fmtBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent',
  color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const toolBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent',
  color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
}
