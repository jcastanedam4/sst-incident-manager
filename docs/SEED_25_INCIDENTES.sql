-- Seed alternativo para poblar 25 incidentes de prueba desde SQL Editor.
-- Primero inserta incidentes y guarda los IDs en una tabla temporal.
-- Luego intenta poblar evidencias si la tabla existe y el entorno lo permite.

create temporary table if not exists seed_incidentes_tmp (
  titulo text not null,
  incidente_id uuid not null
) on commit drop;

truncate table seed_incidentes_tmp;

with dataset as (
  select *
  from (
    values
      (1, 'Resbalon en pasillo de produccion #1', 'Se identifico condicion insegura durante inspeccion rutinaria SST. Caso de prueba 1.', 'Seguridad', 'Abierto'),
      (2, 'Derrame menor de sustancia #2', 'El hallazgo fue reportado por operario y requiere seguimiento administrativo. Caso de prueba 2.', 'Quimico', 'En Proceso'),
      (3, 'Ruido excesivo en zona de maquinas #3', 'Se observaron riesgos potenciales para la integridad del personal en la zona. Caso de prueba 3.', 'Fisico', 'Cerrado'),
      (4, 'Postura forzada en area de carga #4', 'La situacion demanda acciones de control y registro en bitacora de incidentes. Caso de prueba 4.', 'Biomecanico', 'Abierto'),
      (5, 'Caida de objeto en bodega #5', 'Se detectaron incumplimientos de medidas preventivas definidas por el area SST. Caso de prueba 5.', 'Seguridad', 'En Proceso'),
      (6, 'Falla de senalizacion preventiva #6', 'Se identifico condicion insegura durante inspeccion rutinaria SST. Caso de prueba 6.', 'Seguridad', 'Cerrado'),
      (7, 'Iluminacion insuficiente en turno noche #7', 'El hallazgo fue reportado por operario y requiere seguimiento administrativo. Caso de prueba 7.', 'Fisico', 'Abierto'),
      (8, 'Contacto accidental con superficie caliente #8', 'Se observaron riesgos potenciales para la integridad del personal en la zona. Caso de prueba 8.', 'Fisico', 'En Proceso'),
      (9, 'Desorden en area de almacenamiento #9', 'La situacion demanda acciones de control y registro en bitacora de incidentes. Caso de prueba 9.', 'Seguridad', 'Cerrado'),
      (10, 'Fatiga por jornada extendida #10', 'Se detectaron incumplimientos de medidas preventivas definidas por el area SST. Caso de prueba 10.', 'Psicosocial', 'Abierto'),
      (11, 'Resbalon en pasillo de produccion #11', 'Se identifico condicion insegura durante inspeccion rutinaria SST. Caso de prueba 11.', 'Seguridad', 'En Proceso'),
      (12, 'Derrame menor de sustancia #12', 'El hallazgo fue reportado por operario y requiere seguimiento administrativo. Caso de prueba 12.', 'Quimico', 'Cerrado'),
      (13, 'Ruido excesivo en zona de maquinas #13', 'Se observaron riesgos potenciales para la integridad del personal en la zona. Caso de prueba 13.', 'Fisico', 'Abierto'),
      (14, 'Postura forzada en area de carga #14', 'La situacion demanda acciones de control y registro en bitacora de incidentes. Caso de prueba 14.', 'Biomecanico', 'En Proceso'),
      (15, 'Caida de objeto en bodega #15', 'Se detectaron incumplimientos de medidas preventivas definidas por el area SST. Caso de prueba 15.', 'Seguridad', 'Cerrado'),
      (16, 'Falla de senalizacion preventiva #16', 'Se identifico condicion insegura durante inspeccion rutinaria SST. Caso de prueba 16.', 'Seguridad', 'Abierto'),
      (17, 'Iluminacion insuficiente en turno noche #17', 'El hallazgo fue reportado por operario y requiere seguimiento administrativo. Caso de prueba 17.', 'Fisico', 'En Proceso'),
      (18, 'Contacto accidental con superficie caliente #18', 'Se observaron riesgos potenciales para la integridad del personal en la zona. Caso de prueba 18.', 'Fisico', 'Cerrado'),
      (19, 'Desorden en area de almacenamiento #19', 'La situacion demanda acciones de control y registro en bitacora de incidentes. Caso de prueba 19.', 'Seguridad', 'Abierto'),
      (20, 'Fatiga por jornada extendida #20', 'Se detectaron incumplimientos de medidas preventivas definidas por el area SST. Caso de prueba 20.', 'Psicosocial', 'En Proceso'),
      (21, 'Resbalon en pasillo de produccion #21', 'Se identifico condicion insegura durante inspeccion rutinaria SST. Caso de prueba 21.', 'Seguridad', 'Cerrado'),
      (22, 'Derrame menor de sustancia #22', 'El hallazgo fue reportado por operario y requiere seguimiento administrativo. Caso de prueba 22.', 'Quimico', 'Abierto'),
      (23, 'Ruido excesivo en zona de maquinas #23', 'Se observaron riesgos potenciales para la integridad del personal en la zona. Caso de prueba 23.', 'Fisico', 'En Proceso'),
      (24, 'Postura forzada en area de carga #24', 'La situacion demanda acciones de control y registro en bitacora de incidentes. Caso de prueba 24.', 'Biomecanico', 'Cerrado'),
      (25, 'Caida de objeto en bodega #25', 'Se detectaron incumplimientos de medidas preventivas definidas por el area SST. Caso de prueba 25.', 'Seguridad', 'Abierto')
  ) as t(idx, titulo, descripcion, tipo_peligro, estado)
),
insertados as (
  insert into public.incidentes (
    titulo,
    descripcion,
    tipo_peligro,
    estado,
    fecha_suceso
  )
  select
    d.titulo,
    d.descripcion,
    d.tipo_peligro,
    d.estado::public.incidente_estado,
    now() - make_interval(days => (d.idx % 20), hours => (d.idx % 8))
  from dataset d
  returning id, titulo
)
insert into seed_incidentes_tmp (incidente_id, titulo)
select id, titulo
from insertados;

do $$
begin
  if to_regclass('public.evidencias') is not null then
    begin
      insert into public.evidencias (incidente_id, url_storage, tipo_archivo)
      select
        s.incidente_id,
        'https://picsum.photos/seed/' || regexp_replace(s.titulo, '[^a-zA-Z0-9]+', '-', 'g') || '/1200/800',
        'image/jpeg'
      from seed_incidentes_tmp s
      on conflict (incidente_id, url_storage) do nothing;
    exception
      when undefined_table or insufficient_privilege then
        raise notice 'No se pudo poblar evidencias, pero los incidentes ya quedaron insertados.';
    end;
  end if;
end $$;
