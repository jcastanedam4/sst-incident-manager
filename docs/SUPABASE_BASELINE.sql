-- Baseline para autenticacion real (Supabase Auth) y RLS por rol.
-- Requiere usuarios autenticados con metadata role: ADMIN o EMPLEADO.

-- 1) Tabla de incidentes
create table if not exists public.incidentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null,
  tipo_peligro text not null,
  estado text not null default 'Abierto',
  fecha_suceso timestamptz not null default now(),
  user_email text,
  evidencia_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Tabla de evidencias
create table if not exists public.evidencias (
  id uuid primary key default gen_random_uuid(),
  incidente_id uuid not null references public.incidentes(id) on delete cascade,
  url_storage text not null,
  tipo_archivo text,
  created_at timestamptz not null default now(),
  unique (incidente_id, url_storage)
);

-- 3) Tabla de medidas correctivas
create table if not exists public.medidas_correctivas (
  id uuid primary key default gen_random_uuid(),
  incidente_id uuid not null references public.incidentes(id) on delete cascade,
  descripcion_accion text not null,
  responsable text,
  created_at timestamptz not null default now()
);

-- 4) Tabla de auditoria
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null,
  changed_by uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- 5) Trigger de auditoria
create or replace function public.fn_audit_incidente_changes()
returns trigger as $$
begin
  if (tg_op = 'UPDATE') then
    insert into public.audit_logs (record_id, changed_by, action, old_data, new_data)
    values (old.id, auth.uid(), 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;

  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs (record_id, changed_by, action, old_data, new_data)
    values (old.id, auth.uid(), 'DELETE', to_jsonb(old), null);
    return old;

  elsif (tg_op = 'INSERT') then
    insert into public.audit_logs (record_id, changed_by, action, old_data, new_data)
    values (new.id, auth.uid(), 'INSERT', null, to_jsonb(new));
    return new;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_incidentes on public.incidentes;

create trigger trg_audit_incidentes
after insert or update or delete on public.incidentes
for each row execute function public.fn_audit_incidente_changes();

-- 6) Indices recomendados
create index if not exists idx_incidentes_estado_created_at on public.incidentes (estado, created_at desc);
create index if not exists idx_incidentes_tipo_peligro on public.incidentes (tipo_peligro);
create index if not exists idx_evidencias_incidente_created_at on public.evidencias (incidente_id, created_at desc);
create index if not exists idx_audit_logs_record_created_at on public.audit_logs (record_id, created_at desc);

-- 7) RLS
alter table public.incidentes enable row level security;
alter table public.evidencias enable row level security;
alter table public.medidas_correctivas enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "incidentes_select" on public.incidentes;
create policy "incidentes_select"
on public.incidentes
for select
to authenticated
using (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
  or auth.email() = 'encargado.sst@empresa.com'
  or user_email = auth.email()
  or (user_id is not null and user_id::text = auth.uid()::text)
);

drop policy if exists "incidentes_insert" on public.incidentes;
create policy "incidentes_insert"
on public.incidentes
for insert
to authenticated
with check (
  (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
  )
  or (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'EMPLEADO'
    and user_email = auth.email()
  )
);

drop policy if exists "incidentes_update_admin" on public.incidentes;
create policy "incidentes_update_admin"
on public.incidentes
for update
to authenticated
using (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
)
with check (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
);

drop policy if exists "evidencias_select" on public.evidencias;
create policy "evidencias_select"
on public.evidencias
for select
to authenticated
using (
  exists (
    select 1
    from public.incidentes i
    where i.id = evidencias.incidente_id
      and (
        coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
        or i.user_email = auth.email()
      )
  )
);

drop policy if exists "evidencias_insert" on public.evidencias;
create policy "evidencias_insert"
on public.evidencias
for insert
to authenticated
with check (
  exists (
    select 1
    from public.incidentes i
    where i.id = evidencias.incidente_id
      and (
        coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
        or i.user_email = auth.email()
      )
  )
);

drop policy if exists "medidas_select" on public.medidas_correctivas;
create policy "medidas_select"
on public.medidas_correctivas
for select
to authenticated
using (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
);

drop policy if exists "medidas_insert_admin" on public.medidas_correctivas;
create policy "medidas_insert_admin"
on public.medidas_correctivas
for insert
to authenticated
with check (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
);

drop policy if exists "audit_logs_insert_from_trigger" on public.audit_logs;
create policy "audit_logs_insert_from_trigger"
on public.audit_logs
for insert
to authenticated
with check (changed_by = auth.uid());

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
);

-- 8) Storage (ejecutar en SQL Editor si usas bucket evidencias-incidentes)
-- create policy "storage_evidencias_read"
-- on storage.objects
-- for select
-- to authenticated
-- using (bucket_id = 'evidencias-incidentes');
--
-- create policy "storage_evidencias_insert"
-- on storage.objects
-- for insert
-- to authenticated
-- with check (bucket_id = 'evidencias-incidentes');
