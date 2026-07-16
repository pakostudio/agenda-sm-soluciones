# SM Content Studio

Aplicación privada para administrar y producir contenido de GPC, SM Soluciones y LEM con Next.js, Supabase y Vercel.

## Funciones incluidas

- Login con Supabase Auth.
- Usuarios y roles `admin`, `editor`, `viewer`.
- Dashboard con estados de contenido.
- Marcas, perfil editorial y prompts maestros editables.
- Generador de contenido por marca y red social.
- Editor manual para copy, hashtags, CTA, títulos, descripciones, guiones de video y textos en pantalla.
- Biblioteca de imágenes y videos con Supabase Storage privado.
- Límites: imágenes 10 MB, videos 80 MB.
- Vista previa, descarga y selección de material por publicación.
- Calendario editorial interno.
- Estados: borrador, revisión, aprobado y publicado.
- Historial de cambios en `content_history`.
- Buscador y filtros por marca, red, fecha y estado.
- Registro de publicaciones y métricas manuales básicas.
- RLS en tablas y Storage.
- OAuth oficial para Meta/Instagram, LinkedIn y TikTok.
- Tokens cifrados server-side con AES-256-GCM.
- Selección de cuenta conectada, publicación inmediata y programación por cron.

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Variables requeridas:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
BOOTSTRAP_ADMIN_SECRET=
OAUTH_ENCRYPTION_KEY=
CRON_SECRET=
META_APP_ID=
META_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

Redirect URIs:

```txt
https://agenda-sm-soluciones-github.vercel.app/api/oauth/meta/callback
https://agenda-sm-soluciones-github.vercel.app/api/oauth/linkedin/callback
https://agenda-sm-soluciones-github.vercel.app/api/oauth/tiktok/callback
```

## Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` en SQL Editor.
3. Ejecuta `supabase/seed.sql`.
4. Configura las variables en Vercel.
5. Crea el primer admin con `scripts/bootstrap-admin.mjs`.
6. Desde la app, entra a Ajustes > Usuarios para crear editores y viewers.

El bucket `content-media` se crea desde la migración con políticas privadas y URLs firmadas.

## Producción en Vercel

1. Conecta este repo de GitHub a Vercel.
2. Configura las variables de entorno de Supabase.
3. Despliega con:

```bash
vercel --prod
```

Para cargar variables de producción desde tu shell:

```bash
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
NEXT_PUBLIC_APP_URL=https://agenda-sm-soluciones-github.vercel.app \
BOOTSTRAP_ADMIN_SECRET=... \
OAUTH_ENCRYPTION_KEY=... \
CRON_SECRET=... \
META_APP_ID=... \
META_APP_SECRET=... \
LINKEDIN_CLIENT_ID=... \
LINKEDIN_CLIENT_SECRET=... \
TIKTOK_CLIENT_KEY=... \
TIKTOK_CLIENT_SECRET=... \
node scripts/add-vercel-env.mjs
```

Después redespliega:

```bash
vercel --prod --yes
```

Para crear el primer admin:

```bash
APP_URL=https://agenda-sm-soluciones-github.vercel.app \
BOOTSTRAP_ADMIN_SECRET=... \
ADMIN_FULL_NAME="Nombre Apellido" \
ADMIN_EMAIL="correo@dominio.com" \
ADMIN_PASSWORD="contraseña-temporal" \
node scripts/bootstrap-admin.mjs
```

## Verificación

Comandos usados:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build
```

Verificación de producción después de configurar Supabase:

```bash
APP_URL=https://agenda-sm-soluciones-github.vercel.app \
ADMIN_EMAIL="correo@dominio.com" \
ADMIN_PASSWORD="contraseña-temporal" \
node scripts/verify-production.mjs
```

También puedes revisar el diagnóstico servidor:

```bash
curl https://agenda-sm-soluciones-github.vercel.app/api/setup-status
```

## Credenciales externas de redes sociales

Meta / Instagram:

- Crear Meta App y agregar Facebook Login.
- Conectar Facebook Page con Instagram Professional Account.
- Configurar redirect URI `/api/oauth/meta/callback`.
- Solicitar permisos: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
- Variables: `META_APP_ID`, `META_APP_SECRET`.

LinkedIn:

- Crear LinkedIn Developer App.
- Agregar OpenID Connect y Share on LinkedIn.
- Configurar redirect URI `/api/oauth/linkedin/callback`.
- Solicitar scopes: `openid`, `profile`, `w_member_social`, `r_organization_social`, `w_organization_social`.
- Para publicar como página, el usuario OAuth debe tener rol autorizado en la organización.
- Variables: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.

TikTok:

- Crear TikTok Developer App con Login Kit y Content Posting API.
- Configurar redirect URI `/api/oauth/tiktok/callback`.
- Solicitar scopes: `user.info.basic`, `video.publish`, `video.upload`.
- Para publicación pública con Direct Post se requiere auditoría/aprobación de TikTok. Sin auditoría, TikTok restringe publicaciones a `SELF_ONLY`.
- Variables: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.

Seguridad:

- `OAUTH_ENCRYPTION_KEY` debe tener al menos 32 caracteres y no debe rotarse sin migrar tokens.
- `CRON_SECRET` protege `/api/cron/publish-due`.
- Los tokens no se exponen al navegador; solo se listan cuentas sanitizadas desde `/api/social/connections`.

La app no integra Canva, Metricool, Buffer, Cloudinary ni n8n. Funciona con publicación directa por APIs oficiales donde las plataformas otorguen permisos y aprobación.
