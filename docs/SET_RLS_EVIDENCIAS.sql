-- Fix RLS policies for table `evidencias`
-- Safe policy: allow authenticated users to insert evidence for an existing incidente
-- and restrict SELECT to admins or the incidente owner.

BEGIN;

DROP POLICY IF EXISTS "evidencias_insert" ON public.evidencias;
DROP POLICY IF EXISTS "evidencias_select" ON public.evidencias;

CREATE POLICY "evidencias_insert"
ON public.evidencias
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = evidencias.incidente_id
  )
);

CREATE POLICY "evidencias_select"
ON public.evidencias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = evidencias.incidente_id
      AND (
        coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
        OR i.user_email = auth.email()
      )
  )
);

COMMIT;

-- How to apply:
-- 1) Open Supabase Dashboard → SQL Editor
-- 2) Paste the contents of this file and run
-- or, if you have Supabase CLI configured:
--    supabase db query docs/SET_RLS_EVIDENCIAS.sql
