-- Baseline para autenticacion real (Supabase Auth) y RLS por rol.
-- Requiere usuarios autenticados con role en app_metadata o el correo encargado.sst@empresa.com.

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

alter table public.incidentes
add column if not exists user_email text;

-- Si ya existia el campo desde una version previa, este alter no hace nada.

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

-- Asegurar que changed_by puede ser NULL (no hay restricción FK)
alter table public.audit_logs alter column changed_by drop not null;

-- 5) Trigger de auditoria - permite NULL para changed_by
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
$$ language plpgsql security definer;

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

-- Helper central para no repetir logica de admin
create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'ADMIN'
     or auth.email() = 'encargado.sst@empresa.com';
$$;

-- Incidentes: lectura para admin y dueño; insercion para el usuario autenticado; escritura solo admin
drop policy if exists "incidentes_select" on public.incidentes;
create policy "incidentes_select"
on public.incidentes
for select
to authenticated
using (
  public.is_admin_user()
  or user_email = auth.email()
);

drop policy if exists "incidentes_insert" on public.incidentes;
create policy "incidentes_insert"
on public.incidentes
for insert
to authenticated
with check (
  auth.email() is not null
  and user_email = auth.email()
);

drop policy if exists "incidentes_update_admin" on public.incidentes;
create policy "incidentes_update_admin"
on public.incidentes
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "incidentes_delete_admin" on public.incidentes;
create policy "incidentes_delete_admin"
on public.incidentes
for delete
to authenticated
using (public.is_admin_user());

-- Evidencias: lectura para admin y dueño del incidente; insercion para usuario autenticado sobre su incidente
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
        public.is_admin_user()
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
        public.is_admin_user()
        or i.user_email = auth.email()
      )
  )
);

-- Medidas correctivas: solo admin puede leer/escribir
drop policy if exists "medidas_select" on public.medidas_correctivas;
create policy "medidas_select"
on public.medidas_correctivas
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "medidas_insert_admin" on public.medidas_correctivas;
create policy "medidas_insert_admin"
on public.medidas_correctivas
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "medidas_update_admin" on public.medidas_correctivas;
create policy "medidas_update_admin"
on public.medidas_correctivas
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "medidas_delete_admin" on public.medidas_correctivas;
create policy "medidas_delete_admin"
on public.medidas_correctivas
for delete
to authenticated
using (public.is_admin_user());

-- Audit logs: solo admin puede leer; los inserts los realiza el trigger de incidentes
drop policy if exists "audit_logs_insert_from_trigger" on public.audit_logs;
create policy "audit_logs_insert_from_trigger"
on public.audit_logs
for insert
to authenticated
with check (true);

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (public.is_admin_user());

-- 8) Storage: bucket de evidencias
-- Si usas evidencia multimedia, estas policies son necesarias para subir/leer archivos en el bucket.
drop policy if exists "storage_evidencias_read" on storage.objects;
create policy "storage_evidencias_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'evidencias-incidentes');

drop policy if exists "storage_evidencias_insert" on storage.objects;
create policy "storage_evidencias_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'evidencias-incidentes');
