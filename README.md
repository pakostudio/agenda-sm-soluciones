# Agenda SM

Agenda SM es una PWA privada para SM Soluciones. Centraliza citas internas, clientes, proyectos, contactos, participantes, disponibilidad cruzada y consulta externa de Google Calendar solo mediante Free/Busy.

Google Calendar no es la fuente oficial de agenda. La fuente principal es Supabase.

## Estado Actual Verificado

- Estado local: la app corre en desarrollo en `http://127.0.0.1:3000`.
- Vercel: produccion esperada en `https://agenda-sm-soluciones.vercel.app`. Este checkout local no tiene carpeta `.vercel`; las variables productivas deben vivir en el panel de Vercel, no en el codigo.
- Variables locales: no existe `.env.local` en este checkout de `agenda-sm`; solo existe `.env.example`.
- Build: ejecutar `pnpm build` antes de desplegar.

## Stack

- Next.js + React
- Supabase Auth, Postgres, Admin API, RLS y Realtime-ready
- FullCalendar
- Resend para emails de notificacion
- Supabase Admin API `createUser` para alta de usuarios sin email automatico
- Resend para invitaciones por email separadas del alta
- Google Calendar OAuth + Free/Busy API
- Vercel
- PWA instalable

## Desarrollo Local

```bash
cd agenda-sm
cp .env.example .env.local
pnpm install
pnpm dev
```

Abre `http://localhost:3000`.

Si no configuras Supabase, la app corre con datos locales de demostracion para QA visual. Las funciones sensibles de administracion quedan preparadas, pero para crear usuarios reales necesitan Supabase y `SUPABASE_SERVICE_ROLE_KEY`.

## Variables De Entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RESEND_API_KEY=
EMAIL_FROM=Agenda SM <agenda@smsoluciones.com>

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://agenda-sm-soluciones.vercel.app/api/google/callback
GOOGLE_OAUTH_STATE_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Variables faltantes para produccion en este workspace:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_OAUTH_STATE_SECRET`
- `NEXT_PUBLIC_APP_URL=https://agenda-sm-soluciones.vercel.app`

## Panel Admin De Usuarios

Ruta:

```text
/admin/users
```

Funciones implementadas:

- Crear usuarios desde la app usando Supabase Admin API en servidor.
- Nuevo usuario usa `supabase.auth.admin.createUser` con `email_confirm: true`.
- Nuevo usuario no envia email automatico y no llama `inviteUserByEmail`.
- Enviar invitacion por email es una accion separada usando Resend.
- No se usa recuperacion de contrasena de Supabase para invitaciones, porque la configuracion global compartida puede redirigir a otros proyectos.
- Capturar nombre completo, email principal, emails secundarios, rol, PIN temporal, color, horario laboral y estado activo/inactivo.
- Selector visual de color con `input[type=color]`.
- Tabla con nombre, email, rol, color, estado, Google Calendar conectado/no conectado, ultimo acceso y acciones.
- Editar usuario.
- Activar/desactivar usuario.
- Resetear PIN.
- Enviar invitacion por email.
- Validacion server-side para que solo un Admin activo use estas APIs.
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en rutas server-side. No se expone al frontend.

Endpoints:

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-pin`
- `POST /api/admin/users/:id/invite`

El PIN individual se usa como clave de acceso en Supabase Auth y tambien se guarda como hash + salt en `user_pins` para auditoria/reset. Agenda SM no obliga cambio de contrasena, no manda recovery email y no usa PIN global.

## Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` en el SQL editor para una base nueva.
3. Si ya tenias el esquema anterior, ejecuta `supabase/migrations/20260630_admin_users.sql`.
4. Crea el primer Admin desde Supabase Auth o SQL controlado.
5. Asegurate de que ese usuario tenga una fila en `profiles` con `role = 'admin'` y `active = true`.
6. Copia estas variables en `.env.local` y en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

Tablas principales:

- `profiles`
- `user_emails`
- `user_pins`
- `working_hours`
- `google_calendar_connections`
- `clients`
- `projects`
- `contacts`
- `appointments`
- `appointment_participants`
- `appointment_history`
- `time_blocks`
- `notifications`
- `notification_preferences`

RLS de usuarios:

- Admin ve y edita todos los usuarios.
- Miembro solo ve su propio perfil.
- Lectura no puede editar usuarios.
- `user_pins` es solo para Admin.
- Tokens de Google se guardan para uso server-side y no deben exponerse al cliente.
- `google_calendar_connections` queda protegida con RLS de Admin y las rutas server-side usan service role; el frontend nunca recibe `access_token` ni `refresh_token`.

## Vercel

1. Sube el proyecto a GitHub.
2. En Vercel, importa la carpeta/proyecto `agenda-sm`.
3. Agrega las variables de entorno en Project Settings.
4. Build command:

```bash
pnpm build
```

5. Install command:

```bash
pnpm install
```

6. Confirma el dominio `https://agenda-sm-soluciones.vercel.app` o agrega un dominio propio si SM Soluciones lo define despues.

Evidencia local: este workspace no tiene `.vercel`, por lo que desde esta maquina no hay enlace local de proyecto Vercel ni variables sincronizadas. En produccion, confirma en Vercel que existan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` y `EMAIL_FROM`.

## Google Calendar OAuth + Free/Busy

API correcta: `https://www.googleapis.com/calendar/v3/freeBusy`.

Rutas implementadas:

```text
GET /api/google/connect
GET /api/google/callback
GET /api/google/status
POST /api/google/freebusy
```

Estado actual:

- Integracion server-side por usuario.
- Sin credenciales en este workspace.
- No importa titulos, invitados, notas ni ubicaciones.
- Solo procesa bloques `busy` con `start` y `end`.
- Si un usuario no conecto Google Calendar, Agenda SM sigue operando con citas internas, bloqueos y horario laboral.

Para produccion:

1. Crea OAuth Client en Google Cloud.
2. Agrega redirect URI:
   - `https://agenda-sm-soluciones.vercel.app/api/google/callback`
3. Configura:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `GOOGLE_OAUTH_STATE_SECRET`
4. Cada usuario entra a Configuracion y usa `Conectar Google Calendar`.
5. Agenda SM guarda tokens por usuario en `google_calendar_connections` via server-side.
6. Consulta solo Free/Busy al buscar horario disponible.

## Resend

Ruta preparada para notificaciones:

```text
POST /api/notifications/email
```

Estado actual:

- API integrada a nivel de codigo con paquete `resend`.
- Sin `RESEND_API_KEY` ni `EMAIL_FROM` en este checkout local.
- Si faltan variables, `POST /api/admin/users/:id/invite` responde: `Resend no configurado; usuario creado sin envío de invitación`.
- La falta de Resend no bloquea el alta de usuarios.

Para produccion:

1. Verifica dominio remitente en Resend.
2. Agrega `RESEND_API_KEY` en Vercel.
3. Agrega `EMAIL_FROM`.
4. Usa esta API para recordatorios, cambios de cita y seguimientos.

## APIs Integradas Realmente

- Supabase Auth en cliente: login Email + PIN individual con `signInWithPassword` cuando existen variables.
- Supabase Admin API en servidor: crear/invitar/editar usuarios cuando existen variables y sesion Admin.
- FullCalendar: calendario real en UI.
- Resend: endpoint server-side listo para enviar con credenciales.
- Google OAuth/FreeBusy: endpoints server-side listos para conectar usuarios, guardar tokens y consultar disponibilidad sin detalles privados.
- Google Meet: endpoint server-side listo para crear evento con `conferenceDataVersion=1` cuando el responsable conecto Google Calendar con scope de eventos.

## APIs Preparadas Pero Sin Credenciales Locales

- Supabase proyecto real: falta `.env.local`.
- Supabase Admin API: falta `SUPABASE_SERVICE_ROLE_KEY`.
- Google OAuth/FreeBusy: falta cargar credenciales OAuth en Vercel/local.
- Resend: falta API key y remitente verificado.
- Vercel: falta conectar proyecto y cargar variables en el panel.
