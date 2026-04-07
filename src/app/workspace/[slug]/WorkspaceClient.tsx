'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Hash, Lock, Plus, ChevronDown, ChevronRight,
  MessageSquare, Users, LogOut, Menu, X, GitBranch, Bell
} from 'lucide-react'
import InviteModal from '@/components/modals/InviteModal'
import CreateChannelModal from '@/components/modals/CreateChannelModal'
import NewDMModal from '@/components/modals/NewDMModal'
import MembersModal from '@/components/modals/MembersModal'

interface Props {
  workspace: Record<string, unknown>
  workspaces: Record<string, unknown>[]
  channels: Record<string, unknown>[]
  allChannels: Record<string, unknown>[]
  conversations: Record<string, unknown>[]
  profile: Record<string, unknown> | null
  members: Record<string, unknown>[]
  membership: Record<string, unknown>
  currentUserId: string
  children: React.ReactNode
}

export default function WorkspaceClient({
  workspace, workspaces, channels: initialChannels,
  conversations: initialConvs, profile, members, membership, currentUserId, children
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [channels, setChannels] = useState(initialChannels)
  const [showInvite, setShowInvite] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showChannels, setShowChannels] = useState(true)
  const [showDMs, setShowDMs] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<string | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  // mobile tab: 'chat' | 'dms' | 'tools'
  const [mobileTab, setMobileTab] = useState<'chat' | 'dms' | 'tools'>('chat')

  const ws = workspace as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }
  const myProfile = profile as { id: string; full_name: string; status: string } | null

  // Set active item from URL
  useEffect(() => {
    const path = window.location.pathname
    const m = path.match(/\/channel\/([^/]+)$/) || path.match(/\/dm\/([^/]+)$/)
    if (m) setActiveItem(m[1])
  }, [])

  // Realtime unread counts
  useEffect(() => {
    const ch = supabase.channel(`ws-unread-${ws.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as Record<string, unknown>
        if (msg.sender_id === currentUserId) return
        const key = (msg.channel_id || msg.conversation_id) as string
        if (key && key !== activeItem) {
          setUnread(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [ws.id, currentUserId, activeItem, supabase])

  const navigate = useCallback((path: string, id: string) => {
    setActiveItem(id)
    setUnread(prev => { const n = { ...prev }; delete n[id]; return n })
    setSidebarOpen(false)
    router.push(path)
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function color(id: string) {
    const cs = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b']
    let h = 0; for (const c of id) h = h * 31 + c.charCodeAt(0)
    return cs[Math.abs(h) % cs.length]
  }
  function initials(n: string) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  function statusColor(s: string) { return s==='active'?'#2eb67d':s==='away'?'#faa61a':s==='dnd'?'#ed4245':'#72767d' }

  const dmList = initialConvs.map(m => {
    const conv = (m as Record<string,unknown>).conversations as Record<string,unknown>
    if (!conv) return null
    const cms = (conv.conversation_members as Record<string,unknown>[]) || []
    const others = cms.filter(cm => cm.user_id !== currentUserId).map(cm => cm.profiles as Record<string,unknown>).filter(Boolean)
    return { ...conv, others }
  }).filter(Boolean)

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  // Sidebar content — shared between desktop and mobile drawer
  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg1)' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
            {ws.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{members.length} members</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShowInvite(true)} style={iconBtn} title="Invite">✉</button>
          <button onClick={() => setSidebarOpen(false)} style={{ ...iconBtn, display: 'none' }} className="sidebar-close-btn">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Channels section */}
        <div style={{ padding: '6px 14px 3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}
          onClick={() => setShowChannels(s => !s)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {showChannels ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Channels
          </span>
          <button onClick={e => { e.stopPropagation(); setShowCreateChannel(true) }} style={{ ...iconBtn, fontSize: 17 }}>+</button>
        </div>

        {showChannels && channels.map(ch => {
          const c = ch as { id: string; name: string; is_private: boolean }
          const isActive = c.id === activeItem
          const badge = unread[c.id] || 0
          return (
            <div key={c.id}
              onClick={() => navigate(`/workspace/${ws.slug}/channel/${c.id}`, c.id)}
              style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', borderRadius: 6, margin: '0 6px', color: isActive ? '#fff' : badge ? 'var(--text1)' : 'var(--text2)', background: isActive ? 'var(--accent)' : 'transparent', fontWeight: badge ? 700 : 400, fontSize: 14 }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg2)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
              {c.is_private ? <Lock size={13} style={{ flexShrink: 0 }} /> : <Hash size={13} style={{ flexShrink: 0 }} />}
              <span className="truncate" style={{ flex: 1 }}>{c.name}</span>
              {badge > 0 && !isActive && <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge > 9 ? '9+' : badge}</span>}
            </div>
          )
        })}

        <div onClick={() => setShowCreateChannel(true)}
          style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--text3)', fontSize: 13, margin: '0 6px', borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <Plus size={13} /> Add a channel
        </div>

        {/* DMs section */}
        <div style={{ padding: '8px 14px 3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}
          onClick={() => setShowDMs(s => !s)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {showDMs ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Direct Messages
          </span>
          <button onClick={e => { e.stopPropagation(); setShowNewDM(true) }} style={{ ...iconBtn, fontSize: 17 }}>+</button>
        </div>

        {showDMs && dmList.map(dm => {
          if (!dm) return null
          const conv = dm as { id: string; others: Record<string,unknown>[]; is_group: boolean; name?: string }
          const isActive = conv.id === activeItem
          const badge = unread[conv.id] || 0
          const first = conv.others[0] as Record<string,unknown> | undefined
          const displayName = conv.is_group
            ? (conv.name || conv.others.map(o => String(o?.full_name || o?.username)).join(', '))
            : String(first?.full_name || first?.username || 'Unknown')
          const st = String(first?.status || 'offline')
          return (
            <div key={conv.id}
              onClick={() => navigate(`/workspace/${ws.slug}/dm/${conv.id}`, conv.id)}
              style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 6, margin: '0 6px', color: isActive ? '#fff' : badge ? 'var(--text1)' : 'var(--text2)', background: isActive ? 'var(--accent)' : 'transparent', fontWeight: badge ? 700 : 400 }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg2)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: color(String(first?.id||'')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>
                  {initials(String(first?.full_name||''))}
                </div>
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: statusColor(st), border: '2px solid var(--bg1)' }} />
              </div>
              <span className="truncate" style={{ flex: 1, fontSize: 14 }}>{displayName}</span>
              {badge > 0 && !isActive && <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge > 9 ? '9+' : badge}</span>}
            </div>
          )
        })}

        <div onClick={() => setShowNewDM(true)}
          style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--text3)', fontSize: 13, margin: '0 6px', borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <Plus size={13} /> New direct message
        </div>

        {/* Tools link */}
        <div style={{ marginTop: 8, padding: '6px 14px 3px', color: 'var(--text2)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tools</div>
        <div onClick={() => { navigate(`/tools/diagram`, 'diagram'); window.open('/tools/diagram', '_blank') }}
          style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--text2)', fontSize: 14, margin: '0 6px', borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <GitBranch size={13} /> Architecture Diagram
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#7b2d8b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {initials(myProfile?.full_name || '')}
          </div>
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: statusColor(myProfile?.status || 'active'), border: '2px solid var(--bg1)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{myProfile?.full_name || 'You'}</div>
          <div style={{ fontSize: 10, color: 'var(--green)' }}>● Active</div>
        </div>
        <button onClick={() => setShowMembers(true)} style={iconBtn} title="Members"><Users size={14} /></button>
        <button onClick={signOut} style={iconBtn} title="Sign out"><LogOut size={14} /></button>
      </div>
    </div>
  )

  return (
    <div className={`app-layout${sidebarOpen ? ' sidebar-open' : ''}`}>

      {/* Mobile overlay */}
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

      {/* Workspace bar — desktop only */}
      <div className="app-ws-bar">
        {workspaces.map(w => {
          const ww = w as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }
          const isAct = ww.slug === ws.slug
          return (
            <div key={ww.id} onClick={() => router.push(`/workspace/${ww.slug}`)} title={ww.name}
              style={{ width: 42, height: 42, borderRadius: isAct ? 14 : 10, background: ww.icon_color || '#4a154b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, cursor: 'pointer', border: isAct ? '2px solid #fff' : '2px solid transparent', transition: 'all .15s', flexShrink: 0 }}>
              {ww.icon_letter || ww.name?.[0]}
            </div>
          )
        })}
        <div style={{ width: 32, height: 1, background: 'var(--border)', margin: '2px 0' }} />
        <div onClick={() => router.push('/workspace/new')} title="New workspace"
          style={{ width: 42, height: 42, borderRadius: '50%', border: '2px dashed var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)', fontSize: 20 }}>
          +
        </div>
      </div>

      {/* Sidebar */}
      <div className="app-sidebar">
        {sidebarContent}
      </div>

      {/* Main */}
      <div className="app-main">
        {/* Mobile top bar */}
        <div style={{ display: 'none', padding: '8px 12px', borderBottom: '1px solid #2a2d31', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--bg1)' }} className="mobile-topbar">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', position: 'relative' }}>
            <Menu size={20} />
            {totalUnread > 0 && <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--red)', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{totalUnread > 9 ? '9+' : totalUnread}</span>}
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1, color: 'var(--text1)' }} className="truncate">
            {ws.name}
          </span>
          <button onClick={() => setShowMembers(true)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}><Users size={18} /></button>
        </div>

        {children}
      </div>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav">
        <button className={`mobile-nav-btn${mobileTab === 'chat' ? ' active' : ''}`}
          onClick={() => { setMobileTab('chat'); setSidebarOpen(false) }}>
          <Hash size={20} />
          <span>Channels</span>
          {totalUnread > 0 && <span className="badge">{totalUnread > 9 ? '9+' : totalUnread}</span>}
        </button>
        <button className={`mobile-nav-btn${mobileTab === 'dms' ? ' active' : ''}`}
          onClick={() => { setMobileTab('dms'); setSidebarOpen(true) }}>
          <MessageSquare size={20} />
          <span>Messages</span>
        </button>
        <button className="mobile-nav-btn"
          onClick={() => setShowMembers(true)}>
          <Users size={20} />
          <span>Members</span>
        </button>
        <button className="mobile-nav-btn"
          onClick={() => window.open('/tools/diagram', '_blank')}>
          <GitBranch size={20} />
          <span>Tools</span>
        </button>
        <button className="mobile-nav-btn"
          onClick={() => setShowInvite(true)}>
          <Bell size={20} />
          <span>Invite</span>
        </button>
      </nav>

      {/* Modals */}
      {showInvite && <InviteModal workspaceId={ws.id} workspaceName={ws.name} currentUserId={currentUserId} onClose={() => setShowInvite(false)} />}
      {showCreateChannel && (
        <CreateChannelModal workspaceId={ws.id} workspaceSlug={ws.slug} currentUserId={currentUserId}
          onClose={() => setShowCreateChannel(false)}
          onCreated={ch => {
            setChannels(prev => [...prev, ch as Record<string,unknown>])
            navigate(`/workspace/${ws.slug}/channel/${(ch as Record<string,unknown>).id}`, String((ch as Record<string,unknown>).id))
            setShowCreateChannel(false)
          }} />
      )}
      {showNewDM && <NewDMModal workspaceId={ws.id} workspaceSlug={ws.slug} currentUserId={currentUserId} members={members} onClose={() => setShowNewDM(false)} />}
      {showMembers && (
        <MembersModal members={members} currentUserId={currentUserId} membership={membership} workspaceId={ws.id} workspaceSlug={ws.slug} workspaceName={ws.name} onClose={() => setShowMembers(false)} onInvite={() => { setShowMembers(false); setShowInvite(true) }} />
      )}

      <style>{`
        @media (max-width: 680px) {
          .mobile-topbar { display: flex !important; }
          .sidebar-close-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

const iconBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }
