-- Create Auth users from the Supabase dashboard or CLI first, then replace the UUIDs below.
-- This seed creates team profile scaffolding, working hours and notification preferences.

insert into public.profiles (id, full_name, primary_email, role, color)
values
  ('00000000-0000-0000-0000-000000000001', 'Pako Studio', 'pako@smsoluciones.com', 'admin', '#104080'),
  ('00000000-0000-0000-0000-000000000002', 'Billy', 'billy@smsoluciones.com', 'member', '#30A0E0'),
  ('00000000-0000-0000-0000-000000000003', 'Juan', 'juan@smsoluciones.com', 'member', '#0F9D58'),
  ('00000000-0000-0000-0000-000000000004', 'Administracion', 'admin@smsoluciones.com', 'member', '#6D5BD0'),
  ('00000000-0000-0000-0000-000000000005', 'Lectura', 'lectura@smsoluciones.com', 'viewer', '#4B5563')
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, color = excluded.color;

insert into public.notification_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

insert into public.working_hours (user_id, day_of_week, start_time, end_time)
select p.id, d.day, '09:00'::time, '18:00'::time
from public.profiles p
cross join (values (1), (2), (3), (4), (5)) as d(day);

insert into public.clients (name, status, notes)
values ('Cliente Norte', 'activo', 'Cliente demo para arranque.'), ('Grupo Centro', 'activo', 'Cliente demo para seguimiento.')
on conflict do nothing;
