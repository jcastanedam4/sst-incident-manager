-- Datos de prueba del corte vertical con IDs fijos (estado inicial conocido).
-- Idempotente. Úsalos como referencia en pruebas de repositorio, API y rendimiento.
-- Ejecutar en el SQL Editor (rol postgres, ignora RLS).

insert into public.incidentes
  (id, titulo, descripcion, tipo_peligro, gravedad, prioridad_asignada, requiere_atencion_inmediata, estado, user_email, created_at)
values
  ('00000000-0000-4000-8000-000000000001', 'Derrame en área de producción',  'Sustancia desconocida cerca de la zona de trabajo.', 'Quimico',     'Alta',  'Alta',  true,  'Abierto', 'empleado.demo@empresa.com', '2026-11-02 08:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', 'Postura forzada en carga',       'Operario levanta cajas sin ayuda mecánica.',         'Biomecanico', 'Media', 'Media', false, 'Abierto', 'empleado.demo@empresa.com', '2026-11-02 09:00:00+00'),
  ('00000000-0000-4000-8000-000000000003', 'Iluminación baja en pasillo',    'Luminaria intermitente en pasillo secundario.',      'Fisico',      'Baja',  'Baja',  false, 'Abierto', 'empleado.demo@empresa.com', '2026-11-02 10:00:00+00'),
  ('00000000-0000-4000-8000-000000000004', 'Residuos biológicos mal rotulados','Bolsa sin rotular en área de lavado.',             'Biologico',   'Baja',  'Alta',  true,  'Abierto', 'empleado.demo@empresa.com', '2026-11-02 11:00:00+00'),
  ('00000000-0000-4000-8000-000000000005', 'Falla en guarda de prensa',      'Guarda de seguridad retirada en prensa 3.',          'Seguridad',   'Alta',  'Alta',  true,  'Abierto', 'empleado.demo@empresa.com', '2026-11-02 12:00:00+00')
on conflict (id) do update set
  titulo = excluded.titulo,
  descripcion = excluded.descripcion,
  tipo_peligro = excluded.tipo_peligro,
  gravedad = excluded.gravedad,
  prioridad_asignada = excluded.prioridad_asignada,
  requiere_atencion_inmediata = excluded.requiere_atencion_inmediata,
  estado = excluded.estado,
  user_email = excluded.user_email,
  created_at = excluded.created_at;
