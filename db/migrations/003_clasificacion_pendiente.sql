-- Permite registrar incidentes sin predicción y clasificar después desde admin.
begin;

alter table public.incidentes
  alter column prioridad_asignada drop not null,
  alter column requiere_atencion_inmediata drop not null;

alter table public.incidentes
  drop constraint if exists chk_incidentes_tipo_peligro;

alter table public.incidentes
  add constraint chk_incidentes_tipo_peligro
  check (
    tipo_peligro in (
      'Fisico',
      'Quimico',
      'Biologico',
      'Biomecanico',
      'Psicosocial',
      'Seguridad',
      'Fenomeno natural',
      'Sin clasificar'
    )
  )
  not valid;

alter table public.incidentes
  drop constraint if exists chk_incidentes_clasificacion_pendiente;

alter table public.incidentes
  add constraint chk_incidentes_clasificacion_pendiente
  check (
    (
      tipo_peligro = 'Sin clasificar'
      and prioridad_asignada is null
      and requiere_atencion_inmediata is null
    )
    or (
      tipo_peligro <> 'Sin clasificar'
      and prioridad_asignada is not null
      and requiere_atencion_inmediata is not null
    )
  )
  not valid;

commit;
