create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type social_network as enum ('instagram', 'linkedin', 'tiktok');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_status as enum ('draft', 'review', 'approved', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_type as enum ('image', 'video');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'editor',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  networks social_network[] not null,
  editorial_profile text not null default '',
  voice_tone text not null default '',
  audience text not null default '',
  cta_style text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_prompts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  network social_network not null,
  title text not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, network)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  title text not null,
  asset_type asset_type not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (
    (asset_type = 'image' and file_size <= 10485760) or
    (asset_type = 'video' and file_size <= 83886080)
  ),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  network social_network not null,
  topic text not null,
  asset_id uuid references public.media_assets(id) on delete set null,
  status post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  copy_text text not null default '',
  hashtags text not null default '',
  cta text not null default '',
  video_script text not null default '',
  on_screen_text text not null default '',
  title text not null default '',
  description text not null default '',
  manual_metrics jsonb not null default '{"impressions":0,"reach":0,"clicks":0,"likes":0,"comments":0,"shares":0}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_history (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  change_type text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  network social_network not null,
  provider text not null,
  account_id text,
  account_name text,
  account_type text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'not_connected',
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  connected_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, network, provider, account_id)
);

create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  social_connection_id uuid not null references public.social_connections(id) on delete cascade,
  run_at timestamptz not null,
  status text not null default 'scheduled',
  provider_post_id text,
  provider_response jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  last_error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_item_id, social_connection_id)
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists touch_brands on public.brands;
create trigger touch_brands before update on public.brands for each row execute function public.touch_updated_at();
drop trigger if exists touch_master_prompts on public.master_prompts;
create trigger touch_master_prompts before update on public.master_prompts for each row execute function public.touch_updated_at();
drop trigger if exists touch_content_items on public.content_items;
create trigger touch_content_items before update on public.content_items for each row execute function public.touch_updated_at();
drop trigger if exists touch_social_connections on public.social_connections;
create trigger touch_social_connections before update on public.social_connections for each row execute function public.touch_updated_at();
drop trigger if exists touch_publish_jobs on public.publish_jobs;
create trigger touch_publish_jobs before update on public.publish_jobs for each row execute function public.touch_updated_at();

create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.master_prompts enable row level security;
alter table public.media_assets enable row level security;
alter table public.content_items enable row level security;
alter table public.content_history enable row level security;
alter table public.social_connections enable row level security;
alter table public.publish_jobs enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (public.current_role() is not null);
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands for select using (public.current_role() is not null);
drop policy if exists brands_edit on public.brands;
create policy brands_edit on public.brands for all using (public.current_role() in ('admin','editor')) with check (public.current_role() in ('admin','editor'));

drop policy if exists prompts_read on public.master_prompts;
create policy prompts_read on public.master_prompts for select using (public.current_role() is not null);
drop policy if exists prompts_edit on public.master_prompts;
create policy prompts_edit on public.master_prompts for all using (public.current_role() in ('admin','editor')) with check (public.current_role() in ('admin','editor'));

drop policy if exists assets_read on public.media_assets;
create policy assets_read on public.media_assets for select using (public.current_role() is not null);
drop policy if exists assets_edit on public.media_assets;
create policy assets_edit on public.media_assets for all using (public.current_role() in ('admin','editor')) with check (public.current_role() in ('admin','editor'));

drop policy if exists content_read on public.content_items;
create policy content_read on public.content_items for select using (public.current_role() is not null);
drop policy if exists content_edit on public.content_items;
create policy content_edit on public.content_items for all using (public.current_role() in ('admin','editor')) with check (public.current_role() in ('admin','editor'));

drop policy if exists history_read on public.content_history;
create policy history_read on public.content_history for select using (public.current_role() is not null);
drop policy if exists history_insert on public.content_history;
create policy history_insert on public.content_history for insert with check (public.current_role() in ('admin','editor'));

drop policy if exists social_read on public.social_connections;
create policy social_read on public.social_connections for select using (public.current_role() = 'admin');
drop policy if exists social_admin on public.social_connections;
create policy social_admin on public.social_connections for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

revoke all on public.social_connections from anon, authenticated;

drop policy if exists jobs_read on public.publish_jobs;
create policy jobs_read on public.publish_jobs for select using (public.current_role() is not null);
drop policy if exists jobs_edit on public.publish_jobs;
create policy jobs_edit on public.publish_jobs for all using (public.current_role() in ('admin','editor')) with check (public.current_role() in ('admin','editor'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-media', 'content-media', false, 83886080, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = 83886080, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists content_media_read on storage.objects;
create policy content_media_read on storage.objects for select using (bucket_id = 'content-media' and public.current_role() is not null);
drop policy if exists content_media_insert on storage.objects;
create policy content_media_insert on storage.objects for insert with check (bucket_id = 'content-media' and public.current_role() in ('admin','editor'));
drop policy if exists content_media_update on storage.objects;
create policy content_media_update on storage.objects for update using (bucket_id = 'content-media' and public.current_role() in ('admin','editor'));
