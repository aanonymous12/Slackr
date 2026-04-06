-- ============================================================
-- SLACKR - Full Schema for Supabase
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
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

-- ============================================================
-- 2. WORKSPACES
-- ============================================================
create table if not exists public.workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  icon_color text default '#4a154b',
  icon_letter text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. WORKSPACE MEMBERS
-- ============================================================
create table if not exists public.workspace_members (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- ============================================================
-- 4. CHANNELS
-- ============================================================
create table if not exists public.channels (
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

-- ============================================================
-- 5. CHANNEL MEMBERS
-- ============================================================
create table if not exists public.channel_members (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  unique(channel_id, user_id)
);

-- ============================================================
-- 6. CONVERSATIONS (DMs)
-- ============================================================
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  is_group boolean default false,
  name text,
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  unique(conversation_id, user_id)
);

-- ============================================================
-- 7. MESSAGES
-- ============================================================
create table if not exists public.messages (
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

create index if not exists messages_channel_id_idx on public.messages(channel_id, created_at);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id, created_at);
create index if not exists messages_thread_parent_id_idx on public.messages(thread_parent_id);

-- ============================================================
-- 8. REACTIONS
-- ============================================================
create table if not exists public.reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- ============================================================
-- 9. INVITES
-- ============================================================
create table if not exists public.invites (
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

-- ============================================================
-- 10. HUDDLES
-- ============================================================
create table if not exists public.huddles (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade not null,
  started_by uuid references public.profiles(id) on delete set null,
  is_active boolean default true,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists public.huddle_participants (
  id uuid default uuid_generate_v4() primary key,
  huddle_id uuid references public.huddles(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  left_at timestamptz,
  unique(huddle_id, user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY — enable on all tables first
-- ============================================================
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.invites enable row level security;
alter table public.huddles enable row level security;
alter table public.huddle_participants enable row level security;

-- ============================================================
-- RLS POLICIES — profiles
-- ============================================================
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- ============================================================
-- RLS POLICIES — workspaces
-- ============================================================
drop policy if exists "workspaces_select" on public.workspaces;
create policy "workspaces_select"
  on public.workspaces for select to authenticated
  using (
    id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

drop policy if exists "workspaces_insert" on public.workspaces;
create policy "workspaces_insert"
  on public.workspaces for insert to authenticated with check (true);

drop policy if exists "workspaces_update" on public.workspaces;
create policy "workspaces_update"
  on public.workspaces for update to authenticated using (owner_id = auth.uid());

-- ============================================================
-- RLS POLICIES — workspace_members
-- ============================================================
drop policy if exists "wm_select" on public.workspace_members;
create policy "wm_select"
  on public.workspace_members for select to authenticated
  using (
    user_id = auth.uid()
    or workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

drop policy if exists "wm_insert" on public.workspace_members;
create policy "wm_insert"
  on public.workspace_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wm_update" on public.workspace_members;
create policy "wm_update"
  on public.workspace_members for update to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "wm_delete" on public.workspace_members;
create policy "wm_delete"
  on public.workspace_members for delete to authenticated
  using (
    user_id = auth.uid()
    or workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ============================================================
-- RLS POLICIES — channels
-- ============================================================
drop policy if exists "channels_select" on public.channels;
create policy "channels_select"
  on public.channels for select to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
    and (
      is_private = false
      or id in (
        select channel_id from public.channel_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "channels_insert" on public.channels;
create policy "channels_insert"
  on public.channels for insert to authenticated
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

drop policy if exists "channels_update" on public.channels;
create policy "channels_update"
  on public.channels for update to authenticated
  using (
    created_by = auth.uid()
    or workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ============================================================
-- RLS POLICIES — channel_members
-- ============================================================
drop policy if exists "cm_select" on public.channel_members;
create policy "cm_select"
  on public.channel_members for select to authenticated using (true);

drop policy if exists "cm_insert" on public.channel_members;
create policy "cm_insert"
  on public.channel_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "cm_update" on public.channel_members;
create policy "cm_update"
  on public.channel_members for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "cm_delete" on public.channel_members;
create policy "cm_delete"
  on public.channel_members for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES — conversations
-- ============================================================
drop policy if exists "conv_select" on public.conversations;
create policy "conv_select"
  on public.conversations for select to authenticated
  using (
    id in (
      select conversation_id from public.conversation_members where user_id = auth.uid()
    )
  );

drop policy if exists "conv_insert" on public.conversations;
create policy "conv_insert"
  on public.conversations for insert to authenticated with check (true);

-- ============================================================
-- RLS POLICIES — conversation_members
-- ============================================================
drop policy if exists "convm_select" on public.conversation_members;
create policy "convm_select"
  on public.conversation_members for select to authenticated
  using (
    conversation_id in (
      select conversation_id from public.conversation_members where user_id = auth.uid()
    )
  );

drop policy if exists "convm_insert" on public.conversation_members;
create policy "convm_insert"
  on public.conversation_members for insert to authenticated with check (true);

drop policy if exists "convm_update" on public.conversation_members;
create policy "convm_update"
  on public.conversation_members for update to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES — messages
-- ============================================================
drop policy if exists "msg_select" on public.messages;
create policy "msg_select"
  on public.messages for select to authenticated
  using (
    (
      channel_id is not null
      and channel_id in (
        select channel_id from public.channel_members where user_id = auth.uid()
      )
    )
    or (
      conversation_id is not null
      and conversation_id in (
        select conversation_id from public.conversation_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "msg_insert" on public.messages;
create policy "msg_insert"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "msg_update" on public.messages;
create policy "msg_update"
  on public.messages for update to authenticated
  using (sender_id = auth.uid());

-- ============================================================
-- RLS POLICIES — reactions
-- ============================================================
drop policy if exists "react_select" on public.reactions;
create policy "react_select"
  on public.reactions for select to authenticated using (true);

drop policy if exists "react_insert" on public.reactions;
create policy "react_insert"
  on public.reactions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "react_delete" on public.reactions;
create policy "react_delete"
  on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES — invites
-- ============================================================
drop policy if exists "invites_select" on public.invites;
create policy "invites_select"
  on public.invites for select
  using (true); -- allow anon to read by token

drop policy if exists "invites_insert" on public.invites;
create policy "invites_insert"
  on public.invites for insert to authenticated
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "invites_update" on public.invites;
create policy "invites_update"
  on public.invites for update to authenticated
  with check (true);

-- ============================================================
-- RLS POLICIES — huddles
-- ============================================================
drop policy if exists "huddles_select" on public.huddles;
create policy "huddles_select"
  on public.huddles for select to authenticated using (true);

drop policy if exists "huddles_insert" on public.huddles;
create policy "huddles_insert"
  on public.huddles for insert to authenticated
  with check (started_by = auth.uid());

drop policy if exists "huddles_update" on public.huddles;
create policy "huddles_update"
  on public.huddles for update to authenticated
  using (started_by = auth.uid());

drop policy if exists "hp_select" on public.huddle_participants;
create policy "hp_select"
  on public.huddle_participants for select to authenticated using (true);

drop policy if exists "hp_insert" on public.huddle_participants;
create policy "hp_insert"
  on public.huddle_participants for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "hp_update" on public.huddle_participants;
create policy "hp_update"
  on public.huddle_participants for update to authenticated
  using (user_id = auth.uid());

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
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
  before update on public.messages
  for each row execute procedure public.set_updated_at();

-- Helper function to find existing DM conversation
create or replace function public.find_dm_conversation(user1 uuid, user2 uuid, workspace uuid)
returns uuid language plpgsql security definer as $$
declare
  conv_id uuid;
begin
  select c.id into conv_id
  from public.conversations c
  where c.workspace_id = workspace
    and c.is_group = false
    and (
      select count(*) from public.conversation_members cm where cm.conversation_id = c.id
    ) = 2
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = user1)
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = user2)
  limit 1;
  return conv_id;
end;
$$;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.channel_members;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.huddles;
alter publication supabase_realtime add table public.huddle_participants;
alter publication supabase_realtime add table public.conversation_members;

-- ============================================================
-- STORAGE
-- ============================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "attach_upload" on storage.objects;
create policy "attach_upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists "attach_select" on storage.objects;
create policy "attach_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

drop policy if exists "attach_delete" on storage.objects;
create policy "attach_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- DEFAULT ADMIN ACCOUNT SEED
-- Creates admin@nepalitrip.com / nepali123
-- Run AFTER the main schema above
-- ============================================================

-- Step 1: Create the auth user directly in Supabase auth
-- NOTE: Supabase hashes passwords with bcrypt. We use the admin API approach.
-- Paste and run this in SQL Editor:

do $$
declare
  new_user_id uuid;
  new_workspace_id uuid;
  general_channel_id uuid;
  random_channel_id uuid;
begin

  -- Create auth user (Supabase internal approach)
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@nepalitrip.com',
    crypt('nepali123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Nepali Trip Admin"}',
    now(),
    now(),
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  )
  on conflict (email) do nothing
  returning id into new_user_id;

  -- If user already existed, get their id
  if new_user_id is null then
    select id into new_user_id from auth.users where email = 'admin@nepalitrip.com';
  end if;

  -- Step 2: Ensure profile exists
  insert into public.profiles (id, email, full_name, username, status)
  values (
    new_user_id,
    'admin@nepalitrip.com',
    'Nepali Trip Admin',
    'admin_nepalitrip',
    'active'
  )
  on conflict (id) do update set
    full_name = 'Nepali Trip Admin',
    username  = 'admin_nepalitrip';

  -- Step 3: Create default workspace
  insert into public.workspaces (id, name, slug, icon_color, icon_letter, owner_id)
  values (
    gen_random_uuid(),
    'Nepali Trip',
    'nepali-trip',
    '#e8912d',
    'N',
    new_user_id
  )
  on conflict (slug) do nothing
  returning id into new_workspace_id;

  -- If workspace already existed, get its id
  if new_workspace_id is null then
    select id into new_workspace_id from public.workspaces where slug = 'nepali-trip';
  end if;

  -- Step 4: Add admin as owner of workspace
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  -- Step 5: Create default channels
  insert into public.channels (id, workspace_id, name, description, is_private, created_by)
  values (gen_random_uuid(), new_workspace_id, 'general', 'Company-wide announcements and work-based matters', false, new_user_id)
  on conflict (workspace_id, name) do nothing
  returning id into general_channel_id;

  if general_channel_id is null then
    select id into general_channel_id from public.channels
    where workspace_id = new_workspace_id and name = 'general';
  end if;

  insert into public.channels (id, workspace_id, name, description, is_private, created_by)
  values (gen_random_uuid(), new_workspace_id, 'random', 'Non-work banter and water cooler talk', false, new_user_id)
  on conflict (workspace_id, name) do nothing
  returning id into random_channel_id;

  if random_channel_id is null then
    select id into random_channel_id from public.channels
    where workspace_id = new_workspace_id and name = 'random';
  end if;

  insert into public.channels (workspace_id, name, description, is_private, created_by)
  values (new_workspace_id, 'trip-planning', 'Plan upcoming trips and itineraries', false, new_user_id)
  on conflict (workspace_id, name) do nothing;

  insert into public.channels (workspace_id, name, description, is_private, created_by)
  values (new_workspace_id, 'announcements', 'Official announcements', false, new_user_id)
  on conflict (workspace_id, name) do nothing;

  -- Step 6: Join admin to all channels
  insert into public.channel_members (channel_id, user_id)
  select id, new_user_id from public.channels
  where workspace_id = new_workspace_id
  on conflict (channel_id, user_id) do nothing;

  -- Step 7: Post welcome message in general
  insert into public.messages (channel_id, sender_id, content, content_type)
  values (
    general_channel_id,
    new_user_id,
    'Welcome to Nepali Trip workspace! 🏔️ This is the beginning of something great.',
    'text'
  );

  raise notice 'Admin account ready: admin@nepalitrip.com / nepali123';
  raise notice 'Workspace created: Nepali Trip (slug: nepali-trip)';
  raise notice 'User ID: %', new_user_id;

end;
$$;
