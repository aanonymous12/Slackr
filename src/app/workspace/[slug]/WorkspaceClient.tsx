'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Hash, Lock, Plus, ChevronDown, ChevronRight,
  MessageSquare, Users, LogOut, Menu, X, Search,
  GitBranch, Bell
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
  workspace, workspaces, channels: initChannels,
  conversations: initConvs, profile, members: initMembers,
  membership, currentUserId, children
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [channels, setChannels] = useState(initChannels)
  const [members, setMembers] = useState(initMembers)
  const [showInvite, setShowInvite] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showChannels, setShowChannels] = useState(true)
  const [showDMs, setShowDMs] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<string | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [searchQ, setSearchQ] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)
  const [showWsSwitcher, setShowWsSwitcher] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const ws = workspace as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }
  const myProfile = profile as { id: string; full_name: string; status: string } | null

  useEffect(() => {
    const path = window.location.pathname
    const m = path.match(/\/channel\/([^/]+)$/) || path.match(/\/dm\/([^/]+)$/)
    if (m) setActiveItem(m[1])
  }, [])

  // Realtime: unread message counts
  useEffect(() => {
    const sub = supabase.channel(`ws-${ws.id}-unread`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as Record<string, unknown>
        if (msg.sender_id === currentUserId) return
        const key = (msg.channel_id || msg.conversation_id) as string
        if (key && key !== activeItem) {
          setUnread(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
        }
      }).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [ws.id, currentUserId, activeItem, supabase])

  // Realtime: new channels created anywhere → immediately show to all users
  useEffect(() => {
    const sub = supabase.channel(`ws-${ws.id}-channels`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'channels',
        filter: `workspace_id=eq.${ws.id}`,
      }, payload => {
        const ch = payload.new as Record<string, unknown>
        if (!ch.is_private) {
          setChannels(prev => {
            if (prev.some(c => (c as Record<string,unknown>).id === ch.id)) return prev
            return [...prev, ch].sort((a, b) =>
              String((a as Record<string,unknown>).name).localeCompare(String((b as Record<string,unknown>).name))
            )
          })
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'channels',
        filter: `workspace_id=eq.${ws.id}`,
      }, payload => {
        setChannels(prev => prev.filter(c => (c as Record<string,unknown>).id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [ws.id, supabase])

  // Realtime: workspace member changes
  useEffect(() => {
    const sub = supabase.channel(`ws-${ws.id}-members`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'workspace_members',
        filter: `workspace_id=eq.${ws.id}`,
      }, async () => {
        const { data } = await supabase
          .from('workspace_members')
          .select('*, profiles(id, full_name, username, avatar_url, status, email)')
          .eq('workspace_id', ws.id)
        if (data) setMembers(data)
      }).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [ws.id, supabase])

  const navigate = useCallback((path: string, id: string) => {
    setActiveItem(id)
    setUnread(prev => { const n = { ...prev }; delete n[id]; return n })
    setSidebarOpen(false)
    setSearchQ('')
    router.push(path)
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Build DM list
  const dmList = initConvs.map(m => {
    const conv = (m as Record<string, unknown>).conversations as Record<string, unknown>
    if (!conv) return null
    const cms = (conv.conversation_members as Record<string, unknown>[]) || []
    const others = cms
      .filter(cm => (cm as Record<string,unknown>).user_id !== currentUserId)
      .map(cm => (cm as Record<string,unknown>).profiles as Record<string,unknown>)
      .filter(Boolean)
    return { ...conv, others }
  }).filter(Boolean) as (Record<string,unknown> & { others: Record<string,unknown>[] })[]

  // Search filter
  const q = searchQ.toLowerCase().trim()
  const filteredChannels = q
    ? channels.filter(c => String((c as Record<string,unknown>).name).toLowerCase().includes(q))
    : channels
  const filteredDMs = q
    ? dmList.filter(dm => {
        const first = dm.others[0] as Record<string,unknown> | undefined
        return String(first?.full_name || first?.username || '').toLowerCase().includes(q)
      })
    : dmList

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  function avatarColor(id: string) {
    const cs = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b','#e91e8c']
    let h = 0; for (const c of id) h = h * 31 + c.charCodeAt(0)
    return cs[Math.abs(h) % cs.length]
  }
  function initials(n: string) {
    return (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  }
  function statusDot(s: string) {
    return s === 'active' ? '#2eb67d' : s === 'away' ? '#faa61a' : s === 'dnd' ? '#ed4245' : '#555'
  }
  // Shorten long channel names for display
  function shortName(name: string, max = 18) {
    if (name.length <= max) return name
    return name.slice(0, max - 1) + '…'
  }

  // ── SIDEBAR CONTENT ────────────────────────────────────────────
  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#222529' }}>

      {/* ── Workspace header with switcher ── */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #2a2d31', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {/* WS icon — tap to open switcher on mobile */}
          <div
            onClick={() => setShowWsSwitcher(s => !s)}
            style={{ width: 28, height: 28, borderRadius: '7px', background: ws.icon_color || '#4a154b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
            {ws.icon_letter || ws.name?.[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
              onClick={() => setShowWsSwitcher(s => !s)}>
              {ws.name}
              <ChevronDown size={11} style={{ marginLeft: 4, opacity: .6, verticalAlign: 'middle' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#72767d' }}>{members.length} members</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="mobile-only" style={iconBtn}><X size={15} /></button>
        </div>

        {/* Workspace switcher dropdown */}
        {showWsSwitcher && (
          <div style={{ background: '#1a1d21', border: '1px solid #3f4348', borderRadius: '8px', overflow: 'hidden', marginBottom: 8 }}>
            {workspaces.map(w => {
              const ww = w as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }
              const isActive = ww.slug === ws.slug
              return (
                <div key={ww.id}
                  onClick={() => { setShowWsSwitcher(false); setSidebarOpen(false); router.push(`/workspace/${ww.slug}`) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: isActive ? 'rgba(74,144,217,.1)' : 'transparent', borderLeft: isActive ? '3px solid #4a90d9' : '3px solid transparent' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2c2f33' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '7px', background: ww.icon_color || '#4a154b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                    {ww.icon_letter || ww.name?.[0]}
                  </div>
                  <span style={{ fontSize: '13px', color: isActive ? '#4a90d9' : '#f2f3f5', fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ww.name}
                  </span>
                  {isActive && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#4a90d9' }}>✓</span>}
                </div>
              )
            })}
            <div onClick={() => { setShowWsSwitcher(false); router.push('/workspace/new') }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #3f4348', color: '#72767d', fontSize: '13px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2c2f33')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 26, height: 26, borderRadius: '7px', border: '1px dashed #3f4348', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>+</div>
              <span>New workspace</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#72767d', pointerEvents: 'none' }} />
          <input
            ref={searchRef}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            placeholder="Search…"
            style={{ width: '100%', background: searchFocus ? '#1a1d21' : '#2c2f33', border: `1px solid ${searchFocus ? '#4a90d9' : '#3f4348'}`, borderRadius: '6px', padding: '5px 24px 5px 24px', color: '#f2f3f5', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Nav items ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>

        {/* Channels section */}
        <SectionHeader label="Channels" open={showChannels} onToggle={() => setShowChannels(s => !s)}
          onAdd={() => setShowCreateChannel(true)} addTitle="Add channel" />

        {showChannels && filteredChannels.map(ch => {
          const c = ch as { id: string; name: string; is_private: boolean }
          const isActive = c.id === activeItem
          const badge = unread[c.id] || 0
          return (
            <NavRow key={c.id}
              onClick={() => navigate(`/workspace/${ws.slug}/channel/${c.id}`, c.id)}
              isActive={isActive} badge={badge}>
              {c.is_private ? <Lock size={12} style={{ flexShrink: 0, opacity: .7 }} /> : <Hash size={13} style={{ flexShrink: 0, opacity: .7 }} />}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }} title={c.name}>
                {shortName(c.name)}
              </span>
              {badge > 0 && !isActive && <Badge n={badge} />}
            </NavRow>
          )
        })}

        {!q && (
          <AddRow onClick={() => setShowCreateChannel(true)} label="Add a channel" />
        )}

        {/* DMs section */}
        <SectionHeader label="Direct Messages" open={showDMs} onToggle={() => setShowDMs(s => !s)}
          onAdd={() => setShowNewDM(true)} addTitle="New DM" style={{ marginTop: 6 }} />

        {showDMs && filteredDMs.map(dm => {
          const isActive = dm.id === activeItem
          const badge = unread[String(dm.id)] || 0
          const first = dm.others[0] as Record<string,unknown> | undefined
          const name = dm.is_group
            ? (String(dm.name || dm.others.slice(0,2).map(o => String((o as Record<string,unknown>)?.full_name || '')).join(', ')))
            : String(first?.full_name || first?.username || 'Unknown')
          const st = String(first?.status || 'offline')
          return (
            <NavRow key={String(dm.id)}
              onClick={() => navigate(`/workspace/${ws.slug}/dm/${dm.id}`, String(dm.id))}
              isActive={isActive} badge={badge}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: avatarColor(String(first?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700 }}>
                  {initials(String(first?.full_name || ''))}
                </div>
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: '50%', background: statusDot(st), border: '1.5px solid #222529' }} />
              </div>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }} title={name}>
                {shortName(name)}
              </span>
              {badge > 0 && !isActive && <Badge n={badge} />}
            </NavRow>
          )
        })}

        {!q && (
          <AddRow onClick={() => setShowNewDM(true)} label="New direct message" />
        )}

        {q && filteredChannels.length === 0 && filteredDMs.length === 0 && (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: '#72767d', fontSize: '13px' }}>
            No results for &ldquo;{searchQ}&rdquo;
          </div>
        )}

        {/* ── Tools section ── */}
        {!q && (
          <>
            <div style={{ padding: '10px 12px 3px', fontSize: '11px', fontWeight: 700, color: '#72767d', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>
              Tools
            </div>
            <NavRow onClick={() => window.open('/tools/diagram', '_blank')} isActive={false}>
              <GitBranch size={13} style={{ flexShrink: 0, opacity: .7 }} />
              <span style={{ flex: 1, fontSize: '14px' }}>Architecture Diagram</span>
            </NavRow>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: '8px', background: avatarColor(currentUserId), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>
            {initials(myProfile?.full_name || '')}
          </div>
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: statusDot(myProfile?.status || 'active'), border: '2px solid #222529' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortName(myProfile?.full_name || 'You', 16)}
          </div>
          <div style={{ fontSize: '10px', color: '#2eb67d' }}>● Active</div>
        </div>
        <button onClick={() => setShowMembers(true)} style={iconBtn} title="Members"><Users size={14} /></button>
        <button onClick={() => setShowInvite(true)} style={iconBtn} title="Invite people"><Bell size={14} /></button>
        <button onClick={signOut} style={iconBtn} title="Sign out"><LogOut size={14} /></button>
      </div>
    </div>
  )

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div className={`app-layout${sidebarOpen ? ' sidebar-open' : ''}`}>

      {/* Mobile overlay to close sidebar */}
      <div className="sidebar-overlay" onClick={() => { setSidebarOpen(false); setShowWsSwitcher(false) }} />

      {/* Workspace bar — desktop only (hidden on mobile via CSS) */}
      <div className="app-ws-bar">
        {workspaces.map(w => {
          const ww = w as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }
          const isAct = ww.slug === ws.slug
          return (
            <div key={ww.id} onClick={() => router.push(`/workspace/${ww.slug}`)} title={ww.name}
              style={{ width: 42, height: 42, borderRadius: isAct ? '14px' : '10px', background: ww.icon_color || '#4a154b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', cursor: 'pointer', border: isAct ? '2px solid rgba(255,255,255,.45)' : '2px solid transparent', transition: 'all .15s', flexShrink: 0, userSelect: 'none' }}
              onMouseEnter={e => { if (!isAct) (e.currentTarget as HTMLDivElement).style.borderRadius = '14px' }}
              onMouseLeave={e => { if (!isAct) (e.currentTarget as HTMLDivElement).style.borderRadius = '10px' }}>
              {ww.icon_letter || ww.name?.[0]}
            </div>
          )
        })}
        <div style={{ width: 28, height: 1, background: '#3a3d41', margin: '2px 0' }} />
        <div onClick={() => router.push('/workspace/new')} title="New workspace"
          style={{ width: 42, height: 42, borderRadius: '50%', border: '2px dashed #3f4348', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#72767d', fontSize: '20px', transition: 'all .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#4a90d9'; (e.currentTarget as HTMLDivElement).style.color = '#4a90d9' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3f4348'; (e.currentTarget as HTMLDivElement).style.color = '#72767d' }}>
          +
        </div>
      </div>

      {/* Sidebar */}
      <div className="app-sidebar">{sidebarContent}</div>

      {/* Main content */}
      <div className="app-main">
        {/* Mobile top bar */}
        <div className="mobile-topbar" style={{ display: 'none', height: 48, padding: '0 10px', alignItems: 'center', gap: 8, borderBottom: '1px solid #2a2d31', background: '#222529', flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', color: '#b9bbbe', cursor: 'pointer', padding: '6px', position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Menu size={20} />
            {totalUnread > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 0, background: '#ed4245', color: '#fff', borderRadius: '50%', width: 15, height: 15, fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
          {/* Current workspace name — tappable to switch */}
          <div onClick={() => { setSidebarOpen(true); setTimeout(() => setShowWsSwitcher(true), 50) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, cursor: 'pointer' }}>
            <div style={{ width: 22, height: 22, borderRadius: '6px', background: ws.icon_color || '#4a154b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px', flexShrink: 0 }}>
              {ws.icon_letter || ws.name?.[0]}
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shortName(ws.name, 20)}
            </span>
          </div>
          <button onClick={() => setShowNewDM(true)}
            style={{ background: 'none', border: 'none', color: '#b9bbbe', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <MessageSquare size={18} />
          </button>
        </div>

        {children}
      </div>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav">
        <button className={`mobile-nav-btn${!sidebarOpen ? ' active' : ''}`}
          onClick={() => setSidebarOpen(false)}>
          <Hash size={19} />
          <span>Channels</span>
          {totalUnread > 0 && <span className="badge">{totalUnread > 9 ? '9+' : totalUnread}</span>}
        </button>
        <button className="mobile-nav-btn"
          onClick={() => { setSidebarOpen(true); setTimeout(() => searchRef.current?.focus(), 250) }}>
          <Search size={19} />
          <span>Search</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowNewDM(true)}>
          <MessageSquare size={19} />
          <span>DMs</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowMembers(true)}>
          <Users size={19} />
          <span>Members</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => window.open('/tools/diagram', '_blank')}>
          <GitBranch size={19} />
          <span>Tools</span>
        </button>
      </nav>

      {/* Modals */}
      {showInvite && (
        <InviteModal workspaceId={ws.id} workspaceName={ws.name} currentUserId={currentUserId} onClose={() => setShowInvite(false)} />
      )}
      {showCreateChannel && (
        <CreateChannelModal workspaceId={ws.id} workspaceSlug={ws.slug} currentUserId={currentUserId}
          onClose={() => setShowCreateChannel(false)}
          onCreated={ch => {
            const c = ch as Record<string,unknown>
            setChannels(prev => {
              if (prev.some(x => (x as Record<string,unknown>).id === c.id)) return prev
              return [...prev, c].sort((a, b) =>
                String((a as Record<string,unknown>).name).localeCompare(String((b as Record<string,unknown>).name))
              )
            })
            navigate(`/workspace/${ws.slug}/channel/${c.id}`, String(c.id))
            setShowCreateChannel(false)
          }} />
      )}
      {showNewDM && (
        <NewDMModal workspaceId={ws.id} workspaceSlug={ws.slug} currentUserId={currentUserId}
          members={members} onClose={() => setShowNewDM(false)} />
      )}
      {showMembers && (
        <MembersModal members={members} currentUserId={currentUserId} membership={membership}
          workspaceId={ws.id} workspaceSlug={ws.slug} workspaceName={ws.name}
          onClose={() => setShowMembers(false)}
          onInvite={() => { setShowMembers(false); setShowInvite(true) }} />
      )}

      <style>{`
        @media (max-width: 680px) {
          .mobile-topbar { display: flex !important; }
          .mobile-only { display: flex !important; }
        }
        .mobile-only { display: none; }
      `}</style>
    </div>
  )
}

// ── Reusable sub-components ────────────────────────────────────────
function SectionHeader({ label, open, onToggle, onAdd, addTitle, style: extraStyle }: {
  label: string; open: boolean; onToggle: () => void; onAdd: () => void; addTitle: string; style?: React.CSSProperties
}) {
  return (
    <div style={{ padding: '4px 12px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#72767d', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', ...extraStyle }}
      onClick={onToggle}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {label}
      </span>
      <button onClick={e => { e.stopPropagation(); onAdd() }}
        style={{ width: 20, height: 20, borderRadius: '4px', border: 'none', background: 'transparent', color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title={addTitle}>
        <Plus size={13} />
      </button>
    </div>
  )
}

function NavRow({ children, onClick, isActive, badge }: {
  children: React.ReactNode; onClick: () => void; isActive: boolean; badge?: number
}) {
  return (
    <div onClick={onClick}
      style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', borderRadius: '5px', margin: '0 5px', color: isActive ? '#fff' : (badge ? '#f2f3f5' : '#b9bbbe'), background: isActive ? '#4a90d9' : 'transparent', fontWeight: badge && badge > 0 ? 600 : 400, transition: 'background .1s', userSelect: 'none', minHeight: 30 }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2c2f33' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </div>
  )
}

function AddRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div onClick={onClick}
      style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#72767d', fontSize: '13px', margin: '0 5px', borderRadius: '5px', userSelect: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.color = '#b9bbbe'; e.currentTarget.style.background = '#2c2f33' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#72767d'; e.currentTarget.style.background = 'transparent' }}>
      <Plus size={12} />
      {label}
    </div>
  )
}

function Badge({ n }: { n: number }) {
  return (
    <span style={{ background: '#ed4245', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '10px', fontWeight: 700, flexShrink: 0, lineHeight: '14px' }}>
      {n > 9 ? '9+' : n}
    </span>
  )
}

const iconBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: '5px', border: 'none', background: 'transparent', color: '#b9bbbe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .1s', flexShrink: 0 }
