-- KELAS IX.6 CHAT - Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username in ('Rizky','Chalista','Syakina','Nadira')),
  display_name text not null,
  avatar_url text,
  bio text default '',
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('private','group','channel')),
  name text,
  description text default '',
  avatar_url text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment_url text,
  attachment_type text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text default '',
  media_url text,
  media_type text,
  mentions uuid[] default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create index if not exists status_user_created_idx on public.statuses(user_id,created_at desc);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.statuses enable row level security;

create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.conversation_members where conversation_id=cid and user_id=auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (public.is_admin());

drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select to authenticated using (owner_id=auth.uid() or public.is_member(id));

drop policy if exists conv_insert on public.conversations;
create policy conv_insert on public.conversations for insert to authenticated with check (owner_id=auth.uid());

drop policy if exists member_select on public.conversation_members;
create policy member_select on public.conversation_members for select to authenticated using (user_id=auth.uid() or public.is_member(conversation_id));

drop policy if exists member_insert on public.conversation_members;
create policy member_insert on public.conversation_members for insert to authenticated with check (user_id=auth.uid() or exists(select 1 from public.conversations c where c.id=conversation_id and c.owner_id=auth.uid()));

drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated using (public.is_member(conversation_id));

drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert to authenticated with check (sender_id=auth.uid() and public.is_member(conversation_id));

drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages for update to authenticated using (sender_id=auth.uid()) with check (sender_id=auth.uid());

drop policy if exists status_select on public.statuses;
create policy status_select on public.statuses for select to authenticated using (expires_at > now());

drop policy if exists status_insert on public.statuses;
create policy status_insert on public.statuses for insert to authenticated with check (user_id=auth.uid());

drop policy if exists status_update on public.statuses;
create policy status_update on public.statuses for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Realtime (idempotent: safe to run schema.sql more than once)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'statuses'
  ) then
    alter publication supabase_realtime add table public.statuses;
  end if;
end $$;

-- Optional public media bucket for profile/group/status media.
insert into storage.buckets (id,name,public) values ('chat-media','chat-media',true) on conflict (id) do update set public=true;
drop policy if exists chat_media_read on storage.objects;
create policy chat_media_read on storage.objects for select using (bucket_id='chat-media');
drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects for insert to authenticated with check (bucket_id='chat-media');
drop policy if exists chat_media_update on storage.objects;
create policy chat_media_update on storage.objects for update to authenticated using (bucket_id='chat-media' and owner_id=auth.uid());
drop policy if exists chat_media_delete on storage.objects;
create policy chat_media_delete on storage.objects for delete to authenticated using (bucket_id='chat-media' and owner_id=auth.uid());
