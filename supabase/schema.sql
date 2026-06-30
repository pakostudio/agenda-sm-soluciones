create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'member', 'viewer');
create type public.appointment_status as enum ('pendiente', 'confirmada', 'realizada', 'cancelada', 'reagendada');
create type public.appointment_type as enum ('llamada', 'junta', 'visita', 'seguimiento', 'entrega', 'cobranza', 'otro');
create type public.appointment_modality as enum ('presencial', 'llamada', 'videollamada');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  primary_email text not null,
  role public.app_role not null default 'member',
  avatar_url text,
  color text not null default '#104080',
  active boolean not null default true,
  last_sign_in_at timestamptz,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  type text not null default 'secondary',
  is_primary boolean not null default false,
  notifications_enabled boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  created_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'activo',
  notes text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  status text not null default 'activo',
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  position text,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  contact_id uuid references public.contacts(id),
  responsible_user_id uuid not null references public.profiles(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null,
  type public.appointment_type not null default 'junta',
  modality public.appointment_modality not null default 'videollamada',
  location_or_link text,
  status public.appointment_status not null default 'pendiente',
  notes text,
  next_action text,
  next_action_due_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_valid_range check (end_at > start_at)
);

create table public.appointment_participants (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (appointment_id, user_id)
);

create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  change_type text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  constraint working_hours_valid_range check (end_time > start_time)
);

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  source text not null default 'internal' check (source in ('internal', 'google')),
  created_at timestamptz not null default now(),
  constraint time_blocks_valid_range check (end_at > start_at)
);

create table public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  google_account_email text not null,
  calendar_id text not null default 'primary',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  channel text not null check (channel in ('in_app', 'email', 'whatsapp')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'read', 'failed')),
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  reminder_24h boolean not null default true,
  reminder_1h boolean not null default true,
  reminder_15m boolean not null default false
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function public.can_read_appointment(appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.responsible_user_id = auth.uid()
    )
    or exists (
      select 1 from public.appointment_participants ap
      where ap.appointment_id = appointment_id and ap.user_id = auth.uid()
    );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_touch_updated_at
before update on public.appointments
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.user_emails enable row level security;
alter table public.user_pins enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.contacts enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_participants enable row level security;
alter table public.appointment_history enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_blocks enable row level security;
alter table public.google_calendar_connections enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

create policy "profiles read admin or own" on public.profiles for select using (public.is_admin() or id = auth.uid());
create policy "profiles admin write" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "own emails" on public.user_emails for select using (user_id = auth.uid() or public.is_admin());
create policy "manage emails admin only" on public.user_emails for all using (public.is_admin()) with check (public.is_admin());

create policy "user pins admin only" on public.user_pins for all using (public.is_admin()) with check (public.is_admin());

create policy "read crm references" on public.clients for select using (auth.uid() is not null);
create policy "write clients admin member" on public.clients for all using (public.is_admin()) with check (public.is_admin());
create policy "read projects" on public.projects for select using (auth.uid() is not null);
create policy "write projects admin" on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy "read contacts" on public.contacts for select using (auth.uid() is not null);
create policy "write contacts admin" on public.contacts for all using (public.is_admin()) with check (public.is_admin());

create policy "read appointments visible" on public.appointments for select using (
  public.is_admin()
  or responsible_user_id = auth.uid()
  or exists (select 1 from public.appointment_participants ap where ap.appointment_id = id and ap.user_id = auth.uid())
);
create policy "insert appointments admin member" on public.appointments for insert with check (
  public.is_admin()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'member' and p.active = true)
);
create policy "update appointments owner admin" on public.appointments for update using (
  public.is_admin() or responsible_user_id = auth.uid()
) with check (
  public.is_admin() or responsible_user_id = auth.uid()
);

create policy "read appointment participants" on public.appointment_participants for select using (public.can_read_appointment(appointment_id));
create policy "write appointment participants" on public.appointment_participants for all using (public.is_admin() or public.can_read_appointment(appointment_id)) with check (public.is_admin() or public.can_read_appointment(appointment_id));

create policy "read appointment history" on public.appointment_history for select using (public.can_read_appointment(appointment_id));
create policy "insert appointment history" on public.appointment_history for insert with check (public.can_read_appointment(appointment_id));

create policy "read working hours admin or own" on public.working_hours for select using (public.is_admin() or user_id = auth.uid());
create policy "write working hours admin only" on public.working_hours for all using (public.is_admin()) with check (public.is_admin());

create policy "read time blocks own team" on public.time_blocks for select using (auth.uid() is not null);
create policy "write time blocks own" on public.time_blocks for all using (public.is_admin() or user_id = auth.uid()) with check (public.is_admin() or user_id = auth.uid());

create policy "own google connection" on public.google_calendar_connections for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "own notifications" on public.notifications for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "own notification preferences" on public.notification_preferences for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

comment on table public.google_calendar_connections is 'Tokens must be handled only by server routes/service role. Do not expose access_token or refresh_token to client code.';
