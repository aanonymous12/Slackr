export type UserStatus = 'active' | 'away' | 'dnd' | 'offline'
export type MemberRole = 'owner' | 'admin' | 'member' | 'guest'
export type MessageContentType = 'text' | 'file' | 'image' | 'system'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  status: UserStatus
  status_text: string | null
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  icon_color: string
  icon_letter: string | null
  owner_id: string | null
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  profile?: Profile
}

export interface Channel {
  id: string
  workspace_id: string
  name: string
  description: string | null
  is_private: boolean
  is_archived: boolean
  created_by: string | null
  created_at: string
  unread_count?: number
  member_count?: number
}

export interface ChannelMember {
  id: string
  channel_id: string
  user_id: string
  joined_at: string
  last_read_at: string
  profile?: Profile
}

export interface Conversation {
  id: string
  workspace_id: string
  is_group: boolean
  name: string | null
  created_at: string
  other_members?: Profile[]
  unread_count?: number
}

export interface Message {
  id: string
  channel_id: string | null
  conversation_id: string | null
  thread_parent_id: string | null
  sender_id: string
  content: string
  content_type: MessageContentType
  file_url: string | null
  file_name: string | null
  file_size: number | null
  is_edited: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  sender?: Profile
  reactions?: Reaction[]
  thread_count?: number
}

export interface Reaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  profile?: Profile
}

export interface Invite {
  id: string
  workspace_id: string
  invited_by: string | null
  email: string
  role: MemberRole
  token: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface Huddle {
  id: string
  channel_id: string
  started_by: string | null
  is_active: boolean
  started_at: string
  ended_at: string | null
  participants?: Profile[]
}
