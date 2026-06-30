alter table public.profiles
  add column if not exists last_sign_in_at timestamptz,
  add column if not exists must_change_password boolean not null default true;

create table if not exists public.user_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  created_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_pins enable row level security;

drop policy if exists "profiles read team" on public.profiles;
drop policy if exists "profiles read admin or own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read admin or own" on public.profiles
for select using (public.is_admin() or id = auth.uid());

drop policy if exists "manage own emails" on public.user_emails;
drop policy if exists "manage emails admin or own" on public.user_emails;
drop policy if exists "manage emails admin only" on public.user_emails;
create policy "manage emails admin only" on public.user_emails
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "user pins admin only" on public.user_pins;
create policy "user pins admin only" on public.user_pins
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "read working hours" on public.working_hours;
drop policy if exists "read working hours admin or own" on public.working_hours;
create policy "read working hours admin or own" on public.working_hours
for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists "write working hours admin own" on public.working_hours;
drop policy if exists "write working hours admin only" on public.working_hours;
create policy "write working hours admin only" on public.working_hours
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "insert appointments admin member" on public.appointments;
create policy "insert appointments admin member" on public.appointments
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'member'
      and p.active = true
  )
);
