'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Hash, Lock, Plus, ChevronDown, ChevronRight,
  MessageSquare, Users, LogOut, Menu, X, Search,
  GitBranch, Bell, Settings
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
  const searchRef = useRef<HTMLInputElement>(null)

  const ws = workspace as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }
  const myProfile = profile as { id: string; full_name: string; status: string } | null

  // Active item from URL
  useEffect(() => {
    const path = window.location.pathname
    const m = path.match(/\/channel\/([^/]+)$/) || path.match(/\/dm\/([^/]+)$/)
    if (m) setActiveItem(m[1])
  }, [])

  // Realtime: new messages → increment unread
  useEffect(() => {
    const sub = supabase.channel(`ws-${ws.id}-unread`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as Record<string, unknown>
        if (msg.sender_id === currentUserId) return
        const key = (msg.channel_id || msg.conversation_id) as string
        if (key && key !== activeItem) {
          setUnread(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [ws.id, currentUserId, activeItem, supabase])

  // Realtime: new channels added anywhere → update channel list
  useEffect(() => {
    const sub = supabase.channel(`ws-${ws.id}-channels`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'channels',
        filter: `workspace_id=eq.${ws.id}`,
      }, payload => {
        const newCh = payload.new as Record<string, unknown>
        if (!newCh.is_private) {
          setChannels(prev => {
            if (prev.find(c => (c as Record<string,unknown>).id === newCh.id)) return prev
            return [...prev, newCh].sort((a, b) =>
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

  // Realtime: new workspace members
  useEffect(() => {
    const sub = supabase.channel(`ws-${ws.id}-members`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'workspace_members',
        filter: `workspace_id=eq.${ws.id}`,
      }, async () => {
        // Refresh members list
        const { data } = await supabase
          .from('workspace_members')
          .select('*, profiles(id, full_name, username, avatar_url, status, email)')
          .eq('workspace_id', ws.id)
        if (data) setMembers(data)
      })
      .subscribe()
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

  // Build DM list from conversations - always show all DMs
  const dmList = initConvs.map(m => {
    const conv = (m as Record<string, unknown>).conversations as Record<string, unknown>
    if (!conv) return null
    const cms = (conv.conversation_members as Record<string, unknown>[]) || []
    const others = cms
      .filter(cm => (cm as Record<string,unknown>).user_id !== currentUserId)
      .map(cm => (cm as Record<string,unknown>).profiles as Record<string, unknown>)
      .filter(Boolean)
    return { ...conv, others }
  }).filter(Boolean) as (Record<string, unknown> & { others: Record<string,unknown>[] })[]

  // Search filter
  const q = searchQ.toLowerCase()
  const filteredChannels = q ? channels.filter(c => String((c as Record<string,unknown>).name).toLowerCase().includes(q)) : channels
  const filteredDMs = q ? dmList.filter(dm => {
    const first = dm.others[0] as Record<string,unknown> | undefined
    const name = String(first?.full_name || first?.username || '')
    return name.toLowerCase().includes(q)
  }) : dmList

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  function avatarColor(id: string) {
    const cs = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b','#e91e8c']
    let h = 0; for (const c of id) h = h * 31 + c.charCodeAt(0)
    return cs[Math.abs(h) % cs.length]
  }
  function initials(n: string) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?' }
  function statusDot(s: string) { return s==='active'?'#2eb67d':s==='away'?'#faa61a':s==='dnd'?'#ed4245':'#555' }

  const NavItem = ({ id, path, icon, name, badge, isActive }: {
    id: string; path: string; icon: React.ReactNode; name: string; badge?: number; isActive: boolean
  }) => (
    <div onClick={() => navigate(path, id)}
      style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: '6px', margin: '1px 6px', color: isActive ? '#fff' : badge ? '#f2f3f5' : '#b9bbbe', background: isActive ? '#4a90d9' : 'transparent', fontWeight: badge ? 600 : 400, fontSize: '14px', transition: 'background .1s', userSelect: 'none' }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2c2f33' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {badge && badge > 0 && !isActive && (
        <span style={{ background: '#ed4245', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
  )

  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Workspace header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #2a2d31', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#f2f3f5', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2eb67d', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#72767d', marginTop: '2px' }}>{members.length} members</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={iconBtnSm} className="mobile-only">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ marginTop: '10px', position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#72767d', pointerEvents: 'none' }} />
          <input
            ref={searchRef}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            placeholder="Search channels & DMs"
            style={{ width: '100%', background: searchFocus ? '#1a1d21' : '#2c2f33', border: `1px solid ${searchFocus ? '#4a90d9' : '#3f4348'}`, borderRadius: '6px', padding: '6px 10px 6px 28px', color: '#f2f3f5', fontSize: '13px', outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s' }}
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#72767d', cursor: 'pointer', padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>

        {/* Channels */}
        <div style={{ padding: '4px 12px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#72767d', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}
          onClick={() => setShowChannels(s => !s)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {showChannels ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Channels
          </span>
          <button onClick={e => { e.stopPropagation(); setShowCreateChannel(true) }}
            style={{ ...iconBtnSm, color: '#72767d' }} title="Add channel">
            <Plus size={13} />
          </button>
        </div>

        {showChannels && filteredChannels.map(ch => {
          const c = ch as { id: string; name: string; is_private: boolean }
          return (
            <NavItem key={c.id} id={c.id} path={`/workspace/${ws.slug}/channel/${c.id}`}
              icon={c.is_private ? <Lock size={13} /> : <Hash size={13} />}
              name={c.name} badge={unread[c.id]} isActive={c.id === activeItem} />
          )
        })}

        {!q && (
          <div onClick={() => setShowCreateChannel(true)}
            style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#72767d', fontSize: '13px', margin: '1px 6px', borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#b9bbbe')}
            onMouseLeave={e => (e.currentTarget.style.color = '#72767d')}>
            <Plus size={13} /> Add a channel
          </div>
        )}

        {/* Direct Messages */}
        <div style={{ padding: '10px 12px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#72767d', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '4px' }}
          onClick={() => setShowDMs(s => !s)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {showDMs ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Direct Messages
          </span>
          <button onClick={e => { e.stopPropagation(); setShowNewDM(true) }}
            style={{ ...iconBtnSm, color: '#72767d' }} title="New DM">
            <Plus size={13} />
          </button>
        </div>

        {showDMs && filteredDMs.map(dm => {
          const conv = dm as { id: string; others: Record<string,unknown>[]; is_group: boolean; name?: string }
          const isActive = conv.id === activeItem
          const first = conv.others[0] as Record<string,unknown> | undefined
          const name = conv.is_group
            ? (conv.name || conv.others.slice(0,2).map(o => String((o as Record<string,unknown>)?.full_name || (o as Record<string,unknown>)?.username)).join(', '))
            : String(first?.full_name || first?.username || 'Unknown')
          const st = String(first?.status || 'offline')

          return (
            <div key={conv.id}
              onClick={() => navigate(`/workspace/${ws.slug}/dm/${conv.id}`, conv.id)}
              style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: '6px', margin: '1px 6px', color: isActive ? '#fff' : unread[conv.id] ? '#f2f3f5' : '#b9bbbe', background: isActive ? '#4a90d9' : 'transparent', fontWeight: unread[conv.id] ? 600 : 400, fontSize: '14px' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2c2f33' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor(String(first?.id||'')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700 }}>
                  {initials(String(first?.full_name||''))}
                </div>
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: statusDot(st), border: '2px solid #222529' }} />
              </div>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              {(unread[conv.id] || 0) > 0 && !isActive && (
                <span style={{ background: '#ed4245', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                  {(unread[conv.id] || 0) > 9 ? '9+' : unread[conv.id]}
                </span>
              )}
            </div>
          )
        })}

        {!q && (
          <div onClick={() => setShowNewDM(true)}
            style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#72767d', fontSize: '13px', margin: '1px 6px', borderRadius: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#b9bbbe')}
            onMouseLeave={e => (e.currentTarget.style.color = '#72767d')}>
            <Plus size={13} /> New direct message
          </div>
        )}

        {/* No results */}
        {q && filteredChannels.length === 0 && filteredDMs.length === 0 && (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: '#72767d', fontSize: '13px' }}>
            No results for &ldquo;{searchQ}&rdquo;
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: avatarColor(currentUserId), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
            {initials(myProfile?.full_name || '')}
          </div>
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: statusDot(myProfile?.status || 'active'), border: '2px solid #222529' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myProfile?.full_name || 'You'}</div>
          <div style={{ fontSize: '11px', color: '#2eb67d' }}>● Active</div>
        </div>
        <button onClick={() => setShowMembers(true)} style={iconBtnSm} title="Workspace members"><Users size={15} /></button>
        <button onClick={() => setShowInvite(true)} style={iconBtnSm} title="Invite people"><Bell size={15} /></button>
        <button onClick={signOut} style={iconBtnSm} title="Sign out"><LogOut size={15} /></button>
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
              style={{ width: 42, height: 42, borderRadius: isAct ? '14px' : '10px', background: ww.icon_color || '#4a154b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', cursor: 'pointer', border: isAct ? '2px solid rgba(255,255,255,.5)' : '2px solid transparent', transition: 'all .15s', flexShrink: 0 }}>
              {ww.icon_letter || ww.name?.[0]}
            </div>
          )
        })}
        <div style={{ width: 28, height: 1, background: '#3f4348', margin: '2px 0' }} />
        <div onClick={() => router.push('/workspace/new')} title="New workspace"
          style={{ width: 42, height: 42, borderRadius: '50%', border: '2px dashed #3f4348', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#72767d', fontSize: '20px', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4a90d9'; e.currentTarget.style.color = '#4a90d9' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f4348'; e.currentTarget.style.color = '#72767d' }}>
          +
        </div>
      </div>

      {/* Sidebar */}
      <div className="app-sidebar">{sidebar}</div>

      {/* Main */}
      <div className="app-main">
        {/* Mobile top bar */}
        <div style={{ display: 'none', padding: '0 12px', height: '48px', borderBottom: '1px solid #2a2d31', alignItems: 'center', gap: 10, flexShrink: 0, background: '#222529' }} className="mobile-topbar">
          <button onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', color: '#b9bbbe', cursor: 'pointer', padding: '6px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Menu size={20} />
            {totalUnread > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 2, background: '#ed4245', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
          <span style={{ fontWeight: 700, fontSize: '16px', flex: 1, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ws.name}
          </span>
          <button onClick={() => setShowNewDM(true)} style={{ background: 'none', border: 'none', color: '#b9bbbe', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }} title="New DM">
            <MessageSquare size={18} />
          </button>
        </div>

        {children}
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <button className={`mobile-nav-btn${!sidebarOpen ? ' active' : ''}`}
          onClick={() => setSidebarOpen(false)}>
          <Hash size={20} />
          <span>Channels</span>
          {totalUnread > 0 && <span className="badge">{totalUnread > 9 ? '9+' : totalUnread}</span>}
        </button>
        <button className="mobile-nav-btn" onClick={() => { setSidebarOpen(true); setTimeout(() => searchRef.current?.focus(), 200) }}>
          <Search size={20} />
          <span>Search</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowNewDM(true)}>
          <MessageSquare size={20} />
          <span>New DM</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowMembers(true)}>
          <Users size={20} />
          <span>Members</span>
        </button>
        <button className="mobile-nav-btn" onClick={() => setShowInvite(true)}>
          <Plus size={20} />
          <span>Invite</span>
        </button>
      </nav>

      {/* Modals */}
      {showInvite && <InviteModal workspaceId={ws.id} workspaceName={ws.name} currentUserId={currentUserId} onClose={() => setShowInvite(false)} />}
      {showCreateChannel && (
        <CreateChannelModal workspaceId={ws.id} workspaceSlug={ws.slug} currentUserId={currentUserId}
          onClose={() => setShowCreateChannel(false)}
          onCreated={ch => {
            const c = ch as Record<string, unknown>
            setChannels(prev => {
              if (prev.find(x => (x as Record<string,unknown>).id === c.id)) return prev
              return [...prev, c].sort((a, b) => String((a as Record<string,unknown>).name).localeCompare(String((b as Record<string,unknown>).name)))
            })
            navigate(`/workspace/${ws.slug}/channel/${c.id}`, String(c.id))
            setShowCreateChannel(false)
          }} />
      )}
      {showNewDM && <NewDMModal workspaceId={ws.id} workspaceSlug={ws.slug} currentUserId={currentUserId} members={members} onClose={() => setShowNewDM(false)} />}
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

const iconBtnSm: React.CSSProperties = { width: 28, height: 28, borderRadius: '6px', border: 'none', background: 'transparent', color: '#b9bbbe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .1s' }
