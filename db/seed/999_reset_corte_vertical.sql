-- Devuelve la base al estado inicial conocido del corte vertical.
delete from public.incidentes where id::text like '00000000-0000-4000-8000-0000000000%';
-- Luego ejecutar de nuevo db/seed/002_seed_corte_vertical.sql
