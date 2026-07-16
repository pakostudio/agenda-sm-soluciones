insert into public.brands (name, slug, networks, editorial_profile, voice_tone, audience, cta_style)
values
  ('GPC', 'gpc', array['instagram','linkedin']::social_network[], 'Marca orientada a autoridad, claridad comercial y contenido que convierte aprendizajes en decisiones.', 'Profesional, cercano, estratégico y concreto.', 'Dueños, directores y equipos que necesitan comunicar valor con orden.', 'Escríbenos y aterrizamos la siguiente pieza de contenido.'),
  ('SM Soluciones', 'sm-soluciones', array['linkedin']::social_network[], 'Comunicación B2B enfocada en procesos, soluciones operativas, confianza y resultados medibles.', 'Consultivo, sobrio, claro y orientado a negocio.', 'Empresas que buscan ordenar operaciones, marketing y seguimiento comercial.', 'Agenda una conversación con SM Soluciones.'),
  ('LEM', 'lem', array['instagram','tiktok']::social_network[], 'Contenido ágil, visual y educativo para videos cortos, comunidad y recordación de marca.', 'Dinámico, directo, fresco y útil.', 'Audiencias digitales que consumen contenido práctico y visual.', 'Guarda este contenido y compártelo con quien lo necesita.')
on conflict (slug) do update set
  networks = excluded.networks,
  editorial_profile = excluded.editorial_profile,
  voice_tone = excluded.voice_tone,
  audience = excluded.audience,
  cta_style = excluded.cta_style;

insert into public.master_prompts (brand_id, network, title, prompt)
select id, 'instagram', 'GPC Instagram', 'Genera copy para Instagram con hook breve, valor práctico, CTA claro, hashtags moderados y textos en pantalla si hay video.'
from public.brands where slug = 'gpc'
on conflict (brand_id, network) do update set title = excluded.title, prompt = excluded.prompt;

insert into public.master_prompts (brand_id, network, title, prompt)
select id, 'linkedin', 'GPC LinkedIn', 'Genera publicación profesional para LinkedIn con apertura fuerte, desarrollo consultivo, aprendizaje accionable y cierre conversacional.'
from public.brands where slug = 'gpc'
on conflict (brand_id, network) do update set title = excluded.title, prompt = excluded.prompt;

insert into public.master_prompts (brand_id, network, title, prompt)
select id, 'linkedin', 'SM Soluciones LinkedIn', 'Genera contenido B2B sobrio para LinkedIn: problema operativo, enfoque de solución, resultado esperado y CTA a conversación.'
from public.brands where slug = 'sm-soluciones'
on conflict (brand_id, network) do update set title = excluded.title, prompt = excluded.prompt;

insert into public.master_prompts (brand_id, network, title, prompt)
select id, 'instagram', 'LEM Instagram', 'Genera contenido visual para Instagram con hook, copy corto, guion si aplica, textos en pantalla, CTA y hashtags.'
from public.brands where slug = 'lem'
on conflict (brand_id, network) do update set title = excluded.title, prompt = excluded.prompt;

insert into public.master_prompts (brand_id, network, title, prompt)
select id, 'tiktok', 'LEM TikTok', 'Genera guion para TikTok con hook de 3 segundos, estructura por escenas, textos en pantalla, descripción, CTA y hashtags.'
from public.brands where slug = 'lem'
on conflict (brand_id, network) do update set title = excluded.title, prompt = excluded.prompt;

insert into public.social_connections (brand_id, network, provider, status)
select id, unnest(networks), 'official_api', 'not_connected'
from public.brands
on conflict (brand_id, network, provider) do nothing;
