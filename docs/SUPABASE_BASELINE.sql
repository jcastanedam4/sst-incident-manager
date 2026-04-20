-- Baseline recomendado para soporte RF3, RF4, RF5, RF6, RF9, RF10
-- Ejecutar en SQL Editor de Supabase y adaptar nombres/constraints a tu esquema actual.

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

-- 2) Tabla de medidas correctivas
create table if not exists public.medidas_correctivas (
  id uuid primary key default gen_random_uuid(),
  incidente_id uuid not null references public.incidentes(id) on delete cascade,
  descripcion_accion text not null,
  responsable text,
  created_at timestamptz not null default now()
);

-- 3) Tabla de auditoria
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null,
  changed_by uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- 4) Trigger de auditoria
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

-- 5) Indices recomendados
create index if not exists idx_incidentes_estado_created_at on public.incidentes (estado, created_at desc);
create index if not exists idx_incidentes_tipo_peligro on public.incidentes (tipo_peligro);
create index if not exists idx_audit_logs_record_created_at on public.audit_logs (record_id, created_at desc);

-- 6) Nota Storage
-- Crear bucket: evidencias-incidentes
-- Definir politicas de acceso segun rol y necesidad del proyecto.
