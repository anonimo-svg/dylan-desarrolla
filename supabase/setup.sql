-- BLACKOUT: ejecutar TODO este archivo en Supabase > SQL Editor > New query.
-- Las tablas no quedan accesibles al navegador. Solo las funciones de Netlify usan la clave secreta.

create table if not exists public.blackout_site_content (
  id integer primary key check (id = 1),
  services jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.blackout_site_content enable row level security;
revoke all on table public.blackout_site_content from anon, authenticated;
grant all on table public.blackout_site_content to service_role;

insert into public.blackout_site_content (id, services, updated_at)
values (
  1,
  $services$[
    {"id":"web-basic","title":"Página web básica","description":"Una presencia web clara para empezar a mostrar tu negocio o proyecto.","price":100000,"quote":false},
    {"id":"web-advanced","title":"Página web avanzada","description":"Más secciones y recursos para presentar mejor tus servicios.","price":150000,"quote":false},
    {"id":"web-pro","title":"Página web profesional","description":"Una web más completa, cuidada y adaptada a tus objetivos.","price":200000,"quote":false},
    {"id":"web-company","title":"Página web de empresa","description":"Presencia digital empresarial con estructura personalizada.","price":300000,"quote":false},
    {"id":"notebook-unlock","title":"Desbloqueo de notebooks de gobierno","description":"Consulta por desbloqueo y revisión según el modelo y estado del equipo.","price":15000,"quote":false},
    {"id":"windows-install","title":"Instalación de Windows","description":"Instalación del sistema operativo y configuración inicial.","price":10000,"quote":false},
    {"id":"pc-optimization","title":"Optimización de PC","description":"Revisión del equipo y evaluación del trabajo necesario antes de presupuestar.","price":null,"quote":true}
  ]$services$::jsonb,
  now()
)
on conflict (id) do nothing;

create table if not exists public.blackout_admin_login_attempts (
  ip_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

alter table public.blackout_admin_login_attempts enable row level security;
revoke all on table public.blackout_admin_login_attempts from anon, authenticated;
grant all on table public.blackout_admin_login_attempts to service_role;

-- Verificación: debe devolver una fila con id = 1 y siete servicios.
select id, jsonb_array_length(services) as cantidad_servicios, updated_at
from public.blackout_site_content
where id = 1;
