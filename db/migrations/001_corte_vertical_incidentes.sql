-- Migración 001 — Corte vertical SST (RF-01 registrar/clasificar, RF-02 consultar)
-- Ejecutar DESPUÉS de docs/SUPABASE_BASELINE.sql. Es idempotente (se puede repetir).
-- Cambios frente al modelo previo: gravedad, prioridad_asignada,
-- requiere_atencion_inmediata, user_id y restricciones de integridad.
-- Nota: fecha_registro del contrato de API = columna existente created_at.

begin;

alter table public.incidentes
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Los valores por defecto mantienen compatibles los scripts de seed heredados;
-- la aplicación SIEMPRE envía los valores calculados por el servicio.
alter table public.incidentes
  add column if not exists gravedad text not null default 'Media',
  add column if not exists prioridad_asignada text not null default 'Media',
  add column if not exists requiere_atencion_inmediata boolean not null default false;

-- Corrección única de filas heredadas según la matriz (peligro biológico/químico => Alta).
-- Nota: dispara el trigger de auditoría con changed_by nulo, es esperado.
update public.incidentes
set prioridad_asignada = 'Alta',
    requiere_atencion_inmediata = true
where tipo_peligro in ('Biologico', 'Quimico')
  and prioridad_asignada <> 'Alta';

alter table public.incidentes drop constraint if exists chk_incidentes_gravedad;
alter table public.incidentes add constraint chk_incidentes_gravedad
  check (gravedad in ('Baja', 'Media', 'Alta'));

alter table public.incidentes drop constraint if exists chk_incidentes_prioridad;
alter table public.incidentes add constraint chk_incidentes_prioridad
  check (prioridad_asignada in ('Baja', 'Media', 'Alta'));

-- Coherencia: atención inmediata <=> prioridad Alta.
alter table public.incidentes drop constraint if exists chk_incidentes_atencion_coherente;
alter table public.incidentes add constraint chk_incidentes_atencion_coherente
  check (requiere_atencion_inmediata = (prioridad_asignada = 'Alta'));

-- NOT VALID: se exige a toda fila nueva o modificada sin bloquear datos heredados.
alter table public.incidentes drop constraint if exists chk_incidentes_tipo_peligro;
alter table public.incidentes add constraint chk_incidentes_tipo_peligro
  check (tipo_peligro in ('Fisico', 'Quimico', 'Biologico', 'Biomecanico', 'Psicosocial', 'Seguridad', 'Fenomeno natural'))
  not valid;

create index if not exists idx_incidentes_prioridad_created_at
  on public.incidentes (prioridad_asignada, created_at desc);

commit;
