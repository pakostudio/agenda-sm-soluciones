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
- Arquitectura preparada para futuras APIs oficiales en `social_connections`.

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
```

## Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` en SQL Editor.
3. Ejecuta `supabase/seed.sql`.
4. Crea usuarios desde Supabase Auth.
5. Inserta el perfil de cada usuario en `public.profiles` usando el mismo `id` de `auth.users`.

Ejemplo:

```sql
insert into public.profiles (id, full_name, email, role, active)
values ('AUTH_USER_UUID', 'Nombre Apellido', 'correo@dominio.com', 'admin', true);
```

El bucket `content-media` se crea desde la migración con políticas privadas y URLs firmadas.

## Producción en Vercel

1. Conecta este repo de GitHub a Vercel.
2. Configura las variables de entorno de Supabase.
3. Despliega con:

```bash
vercel --prod
```

## Verificación

Comandos usados:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build
```

La app no integra todavía Meta, LinkedIn, TikTok, Canva, Metricool, Buffer, Cloudinary ni n8n. Funciona completa con publicación interna, copiado, descarga, Storage y registro manual de métricas.
