'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Hash, Lock, Plus, ChevronDown, ChevronRight, MessageSquare, Users, Settings, Bell, Headphones, X, Search, LogOut, Menu, GitBranch } from 'lucide-react'
import InviteModal from '@/components/modals/InviteModal'
import CreateChannelModal from '@/components/modals/CreateChannelModal'
import NewDMModal from '@/components/modals/NewDMModal'
import MembersModal from '@/components/modals/MembersModal'
import HuddleBar from '@/components/chat/HuddleBar'

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
  workspace, workspaces, channels: initialChannels, allChannels,
  conversations: initialConvs, profile, members, membership, currentUserId, children
}: Props) {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [channels, setChannels] = useState(initialChannels)
  const [conversations] = useState(initialConvs)
  const [showInvite, setShowInvite] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showChannelSection, setShowChannelSection] = useState(true)
  const [showDMSection, setShowDMSection] = useState(true)
  const [huddleActive, setHuddleActive] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [huddleChannelId, setHuddleChannelId] = useState<string | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [activeItem, setActiveItem] = useState<string | null>(null)

  const ws = workspace as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }

  // Determine active channel/conv from URL
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/\/channel\/(.+)$/) || path.match(/\/dm\/(.+)$/)
    if (match) setActiveItem(match[1])
  }, [params])

  // Listen for new messages to update unread counts
  useEffect(() => {
    const channel = supabase
      .channel(`workspace-${ws.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as Record<string, unknown>
        if (msg.sender_id === currentUserId) return
        const key = (msg.channel_id || msg.conversation_id) as string
        if (key && key !== activeItem) {
          setUnreadCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ws.id, currentUserId, activeItem, supabase])

  const navigateTo = useCallback((path: string, id: string) => {
    setActiveItem(id)
    setUnreadCounts(prev => { const n = { ...prev }; delete n[id]; return n })
    router.push(path)
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function getAvatarColor(str: string) {
    const colors = ['#5865f2','#ed4245','#e8912d','#2eb67d','#4a90d9','#7b2d8b','#e91e8c']
    let hash = 0
    for (const c of str) hash = hash * 31 + c.charCodeAt(0)
    return colors[Math.abs(hash) % colors.length]
  }

  function getInitials(name: string | null | undefined) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function getStatusColor(status: string) {
    return status === 'active' ? '#2eb67d' : status === 'away' ? '#faa61a' : status === 'dnd' ? '#ed4245' : '#72767d'
  }

  // Process DMs
  const dmList = conversations.map((m: Record<string, unknown>) => {
    const conv = m.conversations as Record<string, unknown>
    if (!conv) return null
    const convMembers = (conv.conversation_members as Record<string, unknown>[]) || []
    const others = convMembers
      .filter((cm: Record<string, unknown>) => cm.user_id !== currentUserId)
      .map((cm: Record<string, unknown>) => cm.profiles as Record<string, unknown>)
      .filter(Boolean)
    return { ...conv, others }
  }).filter(Boolean)

  const myProfile = profile as { id: string; full_name: string; status: string; avatar_url?: string } | null

  return (
    <div className="app-layout" style={{ height: '100vh', overflow: 'hidden', background: '#1a1d21', position: 'relative' }}>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Workspace Bar */}
      <div style={{ width: 68, background: '#1a1d21', borderRight: '1px solid #2a2d31', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 6, flexShrink: 0 }}>
        {workspaces.map((w: Record<string, unknown>) => {
          const ww = w as { id: string; name: string; slug: string; icon_color: string; icon_letter: string }
          const isActive = ww.slug === ws.slug
          return (
            <div key={ww.id}
              onClick={() => router.push(`/workspace/${ww.slug}`)}
              title={ww.name}
              style={{
                width: 42, height: 42, borderRadius: isActive ? 14 : 10,
                background: ww.icon_color || '#4a154b', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 16, cursor: 'pointer',
                border: isActive ? '2px solid #fff' : '2px solid transparent',
                transition: 'all .15s', flexShrink: 0,
              }}>
              {ww.icon_letter || ww.name?.[0]}
            </div>
          )
        })}
        <div style={{ width: 32, height: 1, background: '#3f4348', margin: '4px 0' }} />
        <div onClick={() => router.push('/workspace/new')} title="Create workspace"
          style={{ width: 42, height: 42, borderRadius: '50%', border: '2px dashed #72767d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#72767d', fontSize: 20, transition: 'all .15s' }}>
          +
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ width: 240, background: '#222529', display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2d31', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2d31', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#f2f3f5', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2eb67d', flexShrink: 0 }} />
              {ws.name}
            </div>
            <div style={{ fontSize: 11, color: '#72767d', marginTop: 2 }}>{members.length} members</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setShowInvite(true)} title="Invite people" style={iconBtnStyle}>✉</button>
            <button onClick={() => {}} title="Compose" style={iconBtnStyle}>✏</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2d31' }}>
          <div style={{ background: '#2c2f33', border: '1px solid #3f4348', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, color: '#72767d', fontSize: 13, cursor: 'text' }}>
            <Search size={13} />
            <span>Search channels & DMs</span>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ padding: '4px 8px' }}>
          {[
            { icon: '🔔', label: 'Threads' },
            { icon: '📌', label: 'Saved items' },
          ].map(item => (
            <div key={item.label} style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', color: '#b9bbbe', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2c2f33')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {item.icon} {item.label}
            </div>
          ))}
        </div>

        {/* Scrollable section */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>

          {/* Channels */}
          <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#b9bbbe', fontSize: 13, fontWeight: 600 }}
            onClick={() => setShowChannelSection(s => !s)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {showChannelSection ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Channels
            </span>
            <button onClick={e => { e.stopPropagation(); setShowCreateChannel(true) }} style={{ ...iconBtnStyle, fontSize: 18 }}>+</button>
          </div>

          {showChannelSection && channels.map((ch: Record<string, unknown>) => {
            const c = ch as { id: string; name: string; is_private: boolean }
            const isActive = c.id === activeItem
            const unread = unreadCounts[c.id] || 0
            return (
              <div key={c.id}
                onClick={() => navigateTo(`/workspace/${ws.slug}/channel/${c.id}`, c.id)}
                style={{
                  padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  borderRadius: 6, margin: '0 6px', color: isActive ? '#fff' : unread ? '#f2f3f5' : '#b9bbbe',
                  background: isActive ? '#4a90d9' : 'transparent', fontWeight: unread ? 700 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2c2f33' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                {c.is_private ? <Lock size={14} style={{ flexShrink: 0 }} /> : <Hash size={14} style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{c.name}</span>
                {unread > 0 && !isActive && (
                  <span style={{ background: '#ed4245', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{unread}</span>
                )}
              </div>
            )
          })}

          <div onClick={() => setShowCreateChannel(true)}
            style={{ padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#72767d', fontSize: 13, margin: '0 6px', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2c2f33')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Plus size={14} /> Add a channel
          </div>

          {/* DMs */}
          <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#b9bbbe', fontSize: 13, fontWeight: 600 }}
            onClick={() => setShowDMSection(s => !s)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {showDMSection ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Direct Messages
            </span>
            <button onClick={e => { e.stopPropagation(); setShowNewDM(true) }} style={{ ...iconBtnStyle, fontSize: 18 }}>+</button>
          </div>

          {showDMSection && dmList.map((dm) => {
            if (!dm) return null
            const conv = dm as { id: string; others: Record<string, unknown>[]; is_group: boolean; name?: string }
            const isActive = conv.id === activeItem
            const unread = unreadCounts[conv.id] || 0
            const displayName = conv.is_group
              ? (conv.name || conv.others.map((o: Record<string, unknown>) => (o.full_name || o.username)).join(', '))
              : ((conv.others[0] as Record<string, unknown>)?.full_name || (conv.others[0] as Record<string, unknown>)?.username || 'Unknown')
            const firstOther = conv.others[0] as Record<string, unknown> | undefined
            const status = firstOther?.status as string || 'offline'

            return (
              <div key={conv.id}
                onClick={() => navigateTo(`/workspace/${ws.slug}/dm/${conv.id}`, conv.id)}
                style={{
                  padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  borderRadius: 6, margin: '0 6px', color: isActive ? '#fff' : unread ? '#f2f3f5' : '#b9bbbe',
                  background: isActive ? '#4a90d9' : 'transparent', fontWeight: unread ? 700 : 400,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2c2f33' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarColor(String(firstOther?.id || '')), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                    {getInitials(String(firstOther?.full_name || firstOther?.username || ''))}
                  </div>
                  <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: getStatusColor(status), border: '2px solid #222529' }} />
                </div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{String(displayName)}</span>
                {unread > 0 && !isActive && (
                  <span style={{ background: '#ed4245', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{unread}</span>
                )}
              </div>
            )
          })}

          <div onClick={() => setShowNewDM(true)}
            style={{ padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#72767d', fontSize: 13, margin: '0 6px', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2c2f33')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Plus size={14} /> New direct message
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #2a2d31', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#7b2d8b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {getInitials(myProfile?.full_name || '')}
            </div>
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: getStatusColor(myProfile?.status || 'active'), border: '2px solid #222529' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f3f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myProfile?.full_name || 'You'}</div>
            <div style={{ fontSize: 11, color: getStatusColor(myProfile?.status || 'active'), display: 'flex', alignItems: 'center', gap: 4 }}>● Active</div>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => setShowMembers(true)} title="Members" style={iconBtnStyle}><Users size={15} /></button>
            <button onClick={handleSignOut} title="Sign out" style={iconBtnStyle}><LogOut size={15} /></button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile header */}
        <div style={{ display: 'none' }} className="mobile-top-bar">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: '#b9bbbe', cursor: 'pointer', padding: 8 }}>
            <Menu size={20} />
          </button>
        </div>
        {huddleActive && (
          <HuddleBar
            channelId={huddleChannelId!}
            currentUserId={currentUserId}
            onLeave={() => { setHuddleActive(false); setHuddleChannelId(null) }}
          />
        )}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>

      {/* Modals */}
      {showInvite && (
        <InviteModal
          workspaceId={ws.id}
          workspaceName={ws.name}
          currentUserId={currentUserId}
          onClose={() => setShowInvite(false)}
        />
      )}
      {showCreateChannel && (
        <CreateChannelModal
          workspaceId={ws.id}
          currentUserId={currentUserId}
          workspaceSlug={ws.slug}
          onClose={() => setShowCreateChannel(false)}
          onCreated={(ch) => {
            setChannels(prev => [...prev, ch as Record<string, unknown>])
            navigateTo(`/workspace/${ws.slug}/channel/${(ch as Record<string, unknown>).id}`, String((ch as Record<string, unknown>).id))
            setShowCreateChannel(false)
          }}
        />
      )}
      {showNewDM && (
        <NewDMModal
          workspaceId={ws.id}
          workspaceSlug={ws.slug}
          currentUserId={currentUserId}
          members={members}
          onClose={() => setShowNewDM(false)}
        />
      )}
      {showMembers && (
        <MembersModal
          members={members}
          currentUserId={currentUserId}
          membership={membership as Record<string, unknown>}
          workspaceId={ws.id}
          workspaceSlug={ws.slug}
          onClose={() => setShowMembers(false)}
          onInvite={() => { setShowMembers(false); setShowInvite(true) }}
        />
      )}
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
  color: '#b9bbbe', cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: 15, transition: 'background .1s',
}
