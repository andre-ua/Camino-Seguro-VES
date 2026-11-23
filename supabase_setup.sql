-- ============ ALTOQUE / ALERTA VES · tabla de reportes colaborativos ============
-- Pégalo completo en Supabase → SQL Editor → New query → Run

create table if not exists public.reportes (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('patrulla','serenazgo','ambulancia')),
  lat        double precision not null check (lat between -19 and 0),
  lon        double precision not null check (lon between -82 and -68),
  confianza  real not null check (confianza >= 0.85 and confianza <= 1),  -- la IA debe estar >=85% segura
  device_id  text not null,                                               -- id anónimo del celular (anti-spam)
  created_at timestamptz not null default now()
);
create index if not exists reportes_created_idx on public.reportes (created_at desc);

-- Seguridad (RLS): cualquiera puede LEER e INSERTAR; nadie puede editar ni borrar desde la app
alter table public.reportes enable row level security;
drop policy if exists "leer reportes"  on public.reportes;
drop policy if exists "crear reportes" on public.reportes;
create policy "leer reportes"  on public.reportes for select to anon using (true);
create policy "crear reportes" on public.reportes for insert to anon with check (true);

-- Anti-trolls: máximo 5 reportes por celular cada 10 minutos
create or replace function public.limitar_reportes() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.reportes
       where device_id = new.device_id and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Demasiados reportes seguidos, espera unos minutos';
  end if;
  return new;
end $$;
drop trigger if exists t_limitar on public.reportes;
create trigger t_limitar before insert on public.reportes
  for each row execute function public.limitar_reportes();

-- Tiempo real: avisa a todos los celulares conectados cuando entra un reporte nuevo
alter publication supabase_realtime add table public.reportes;
