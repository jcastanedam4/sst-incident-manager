// @vitest-environment node
/**
 * Prueba REAL de persistencia (semana 13). Se ejecuta solo si hay base de PRUEBA configurada:
 *   TEST_SUPABASE_URL y TEST_SUPABASE_SERVICE_ROLE_KEY  (ver .env.example)
 * Requiere haber aplicado db/migrations/001 y db/seed/002.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ErrorPersistencia } from "@/lib/incidentes/errores";
import type { IncidentePersistible } from "@/lib/incidentes/modelo";
import { SupabaseIncidentRepository } from "@/lib/incidentes/supabaseIncidentRepository";

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const nuevaConexion = () => createClient(url!, key!, { auth: { persistSession: false } });

const incidente: IncidentePersistible = {
  titulo: `Prueba integración ${randomUUID()}`,
  descripcion: "Registro creado por la prueba de persistencia.",
  tipo_peligro: "Quimico",
  gravedad: "Alta",
  prioridad_asignada: "Alta",
  requiere_atencion_inmediata: true,
  estado: "Abierto",
  user_id: null,
  user_email: "prueba.integracion@empresa.com",
};

describe.skipIf(!url || !key)("IncidentRepository contra Supabase real", () => {
  const creados: string[] = [];

  afterAll(async () => {
    if (creados.length) await nuevaConexion().from("incidentes").delete().in("id", creados);
  });

  it("guarda y recupera desde una conexión nueva, incluyendo la prioridad", async () => {
    const guardado = await new SupabaseIncidentRepository(nuevaConexion()).guardar(incidente);
    creados.push(guardado.id);
    expect(guardado.id).toMatch(/^[0-9a-f-]{36}$/);

    const recuperado = await new SupabaseIncidentRepository(nuevaConexion()).buscarPorId(guardado.id);
    expect(recuperado).toMatchObject({
      id: guardado.id, tipo_peligro: "Quimico", gravedad: "Alta",
      prioridad_asignada: "Alta", requiere_atencion_inmediata: true, estado: "Abierto",
    });
    expect(recuperado?.fecha_registro).toBeTruthy();
  });

  it("devuelve null para un id inexistente", async () => {
    expect(await new SupabaseIncidentRepository(nuevaConexion()).buscarPorId(randomUUID())).toBeNull();
  });

  it("lee un registro del seed con estado inicial conocido", async () => {
    const r = await new SupabaseIncidentRepository(nuevaConexion()).buscarPorId("00000000-0000-4000-8000-000000000004");
    expect(r).toMatchObject({ tipo_peligro: "Biologico", gravedad: "Baja", prioridad_asignada: "Alta", requiere_atencion_inmediata: true });
  });

  it("la base rechaza una gravedad fuera del catálogo (restricción de integridad)", async () => {
    const invalido = { ...incidente, gravedad: "Extrema" } as unknown as IncidentePersistible;
    await expect(new SupabaseIncidentRepository(nuevaConexion()).guardar(invalido)).rejects.toBeInstanceOf(ErrorPersistencia);
  });

  it("la base rechaza atención inmediata incoherente con la prioridad", async () => {
    const incoherente: IncidentePersistible = { ...incidente, prioridad_asignada: "Baja", requiere_atencion_inmediata: true };
    await expect(new SupabaseIncidentRepository(nuevaConexion()).guardar(incoherente)).rejects.toBeInstanceOf(ErrorPersistencia);
  });
});
