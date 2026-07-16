alter table public.social_connections
  add column if not exists account_id text,
  add column if not exists account_name text,
  add column if not exists account_type text,
  add column if not exists access_token_encrypted text,
  add column if not exists refresh_token_encrypted text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists refresh_expires_at timestamptz,
  add column if not exists scopes text[] not null default '{}',
  add column if not exists last_error text,
  add column if not exists connected_by uuid references public.profiles(id);

do $$ begin
  alter table public.social_connections drop constraint if exists social_connections_brand_id_network_provider_key;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.social_connections add constraint social_connections_brand_id_network_provider_account_id_key unique (brand_id, network, provider, account_id);
exception when duplicate_object then null; end $$;

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

drop trigger if exists touch_social_connections on public.social_connections;
create trigger touch_social_connections before update on public.social_connections for each row execute function public.touch_updated_at();
drop trigger if exists touch_publish_jobs on public.publish_jobs;
create trigger touch_publish_jobs before update on public.publish_jobs for each row execute function public.touch_updated_at();

alter table public.publish_jobs enable row level security;

drop policy if exists social_read on public.social_connections;
create policy social_read on public.social_connections for select using (public.current_role() = 'admin');
drop policy if exists social_admin on public.social_connections;
create policy social_admin on public.social_connections for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
revoke all on public.social_connections from anon, authenticated;

drop policy if exists jobs_read on public.publish_jobs;
create policy jobs_read on public.publish_jobs for select using (public.current_role() is not null);
drop policy if exists jobs_edit on public.publish_jobs;
create policy jobs_edit on public.publish_jobs for all using (public.current_role() in ('admin','editor')) with check (public.current_role() in ('admin','editor'));
