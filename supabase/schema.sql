-- ============================================================
-- SLACKR - Full Schema for Supabase
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  username text unique,
  avatar_url text,
  status text default 'active' check (status in ('active', 'away', 'dnd', 'offline')),
  status_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- ============================================================
-- WORKSPACES
-- ============================================================
create table public.workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  icon_color text default '#4a154b',
  icon_letter text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.workspaces enable row level security;

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table public.workspace_members (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);
alter table public.workspace_members enable row level security;
create policy "Members can view workspace members"
  on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));
create policy "Members can insert themselves"
  on public.workspace_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "Admins can manage members"
  on public.workspace_members for all to authenticated
  using (workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  ));

-- Workspace visibility
create policy "Workspace viewable by members"
  on public.workspaces for select to authenticated
  using (id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
create policy "Anyone can create workspace"
  on public.workspaces for insert to authenticated with check (true);
create policy "Owners can update workspace"
  on public.workspaces for update to authenticated using (owner_id = auth.uid());

-- ============================================================
-- CHANNELS
-- ============================================================
create table public.channels (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  is_private boolean default false,
  is_archived boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(workspace_id, name)
);
alter table public.channels enable row level security;
create policy "Channel viewable by workspace members"
  on public.channels for select to authenticated
  using (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ) and (is_private = false or id in (
    select channel_id from public.channel_members where user_id = auth.uid()
  )));
create policy "Members can create channels"
  on public.channels for insert to authenticated
  with check (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));
create policy "Admins can update channels"
  on public.channels for update to authenticated
  using (workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  ) or created_by = auth.uid());

-- ============================================================
-- CHANNEL MEMBERS
-- ============================================================
create table public.channel_members (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  unique(channel_id, user_id)
);
alter table public.channel_members enable row level security;
create policy "Channel members viewable by workspace members"
  on public.channel_members for select to authenticated using (true);
create policy "Users can join channels"
  on public.channel_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users can leave channels"
  on public.channel_members for delete to authenticated
  using (user_id = auth.uid());
create policy "Users can update their own membership"
  on public.channel_members for update to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- DIRECT MESSAGE CONVERSATIONS
-- ============================================================
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  is_group boolean default false,
  name text,
  created_at timestamptz default now()
);
alter table public.conversations enable row level security;

create table public.conversation_members (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  unique(conversation_id, user_id)
);
alter table public.conversation_members enable row level security;
create policy "Conversation members viewable by participants"
  on public.conversations for select to authenticated
  using (id in (select conversation_id from public.conversation_members where user_id = auth.uid()));
create policy "Users can create conversations"
  on public.conversations for insert to authenticated with check (true);
create policy "Conversation members table"
  on public.conversation_members for select to authenticated
  using (conversation_id in (select conversation_id from public.conversation_members where user_id = auth.uid()));
create policy "Users can join conversations"
  on public.conversation_members for insert to authenticated with check (true);
create policy "Users can update their conversation membership"
  on public.conversation_members for update to authenticated using (user_id = auth.uid());

-- ============================================================
-- MESSAGES
-- ============================================================
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  thread_parent_id uuid references public.messages(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null not null,
  content text not null,
  content_type text default 'text' check (content_type in ('text','file','image','system')),
  file_url text,
  file_name text,
  file_size integer,
  is_edited boolean default false,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (channel_id is not null or conversation_id is not null)
);
alter table public.messages enable row level security;
create index on public.messages(channel_id, created_at);
create index on public.messages(conversation_id, created_at);
create index on public.messages(thread_parent_id);

create policy "Messages viewable by channel members"
  on public.messages for select to authenticated
  using (
    (channel_id is not null and channel_id in (
      select cm.channel_id from public.channel_members cm
      join public.channels c on c.id = cm.channel_id
      where cm.user_id = auth.uid()
    ))
    or
    (conversation_id is not null and conversation_id in (
      select conversation_id from public.conversation_members where user_id = auth.uid()
    ))
  );
create policy "Authenticated users can send messages"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid());
create policy "Users can edit their own messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid());

-- ============================================================
-- REACTIONS
-- ============================================================
create table public.reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);
alter table public.reactions enable row level security;
create policy "Reactions viewable by authenticated"
  on public.reactions for select to authenticated using (true);
create policy "Users can add reactions"
  on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "Users can remove their reactions"
  on public.reactions for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- INVITES
-- ============================================================
create table public.invites (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  invited_by uuid references public.profiles(id) on delete set null,
  email text not null,
  role text default 'member',
  token text unique default encode(gen_random_bytes(32), 'hex'),
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);
alter table public.invites enable row level security;
create policy "Admins can manage invites"
  on public.invites for all to authenticated
  using (workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin','member')
  ));
create policy "Anyone can read invite by token"
  on public.invites for select to anon using (true);

-- ============================================================
-- HUDDLES (active voice sessions)
-- ============================================================
create table public.huddles (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade not null,
  started_by uuid references public.profiles(id) on delete set null,
  is_active boolean default true,
  started_at timestamptz default now(),
  ended_at timestamptz
);
alter table public.huddles enable row level security;

create table public.huddle_participants (
  id uuid default uuid_generate_v4() primary key,
  huddle_id uuid references public.huddles(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  left_at timestamptz,
  unique(huddle_id, user_id)
);
alter table public.huddles enable row level security;
create policy "Huddles viewable by workspace members"
  on public.huddles for select to authenticated using (true);
create policy "Members can create huddles"
  on public.huddles for insert to authenticated with check (started_by = auth.uid());
create policy "Participants can update huddles"
  on public.huddles for update to authenticated using (started_by = auth.uid());
alter table public.huddle_participants enable row level security;
create policy "Huddle participants viewable"
  on public.huddle_participants for select to authenticated using (true);
create policy "Users can join huddles"
  on public.huddle_participants for insert to authenticated with check (user_id = auth.uid());
create policy "Users can leave huddles"
  on public.huddle_participants for update to authenticated using (user_id = auth.uid());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1) || '_' || floor(random()*9000+1000)::text
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger set_messages_updated_at before update on public.messages
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.channel_members;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.huddles;
alter publication supabase_realtime add table public.huddle_participants;

-- ============================================================
-- STORAGE
-- ============================================================
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
  on conflict do nothing;
create policy "Authenticated users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');
create policy "Public read access"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');
create policy "Users can delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
