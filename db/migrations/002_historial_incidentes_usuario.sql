-- Índice para recuperar rápidamente los reportes recientes de cada usuario.
begin;

create index if not exists idx_incidentes_user_created_at
  on public.incidentes (user_id, created_at desc);

create index if not exists idx_incidentes_user_email_created_at
  on public.incidentes (user_email, created_at desc)
  where user_id is null;

commit;
