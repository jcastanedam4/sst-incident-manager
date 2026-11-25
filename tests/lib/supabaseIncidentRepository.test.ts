import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ErrorPersistencia } from "@/lib/incidentes/errores";
import { SupabaseIncidentRepository } from "@/lib/incidentes/supabaseIncidentRepository";

const fila = {
  id: "00000000-0000-4000-8000-000000000001",
  titulo: "Derrame",
  descripcion: "Sustancia en el piso",
  tipo_peligro: "Quimico",
  gravedad: "Alta",
  prioridad_asignada: "Alta",
  requiere_atencion_inmediata: true,
  estado: "Abierto",
  created_at: "2026-11-14T10:00:00.000Z",
};

type ResultadoConsulta = { data: typeof fila[] | null; error: { message: string } | null };

const crearConsulta = (resultado: ResultadoConsulta) => {
  const consulta = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  consulta.select.mockReturnValue(consulta);
  consulta.eq.mockReturnValue(consulta);
  consulta.is.mockReturnValue(consulta);
  consulta.order.mockReturnValue(consulta);
  consulta.limit.mockResolvedValue(resultado);

  return consulta;
};

const crearRepositorio = (resultados: [ResultadoConsulta, ResultadoConsulta]) => {
  const consultas = resultados.map(crearConsulta);
  const from = vi.fn().mockImplementation(() => consultas[from.mock.calls.length - 1]);
  const cliente = { from } as unknown as SupabaseClient;
  return {
    repositorio: new SupabaseIncidentRepository(cliente),
    from,
    consultaUsuario: consultas[0],
    consultaCorreo: consultas[1],
  };
};

describe("SupabaseIncidentRepository.buscarUltimosPorUsuario", () => {
  it("incluye reportes con user_id y filas antiguas asociadas al correo, en orden reciente", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const email = "empleado.demo@empresa.com";
    const filaAntigua = {
      ...fila,
      id: "00000000-0000-4000-8000-000000000002",
      titulo: "Reporte antiguo del seed",
      created_at: "2026-11-13T10:00:00.000Z",
    };
    const { repositorio, from, consultaUsuario, consultaCorreo } = crearRepositorio([
      { data: [fila], error: null },
      { data: [filaAntigua], error: null },
    ]);

    const resultado = await repositorio.buscarUltimosPorUsuario(userId, email, 5);

    expect(from).toHaveBeenCalledTimes(2);
    expect(consultaUsuario.eq).toHaveBeenCalledWith("user_id", userId);
    expect(consultaUsuario.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(consultaUsuario.limit).toHaveBeenCalledWith(5);
    expect(consultaCorreo.is).toHaveBeenCalledWith("user_id", null);
    expect(consultaCorreo.eq).toHaveBeenCalledWith("user_email", email);
    expect(consultaCorreo.limit).toHaveBeenCalledWith(5);
    expect(resultado.map(({ id }) => id)).toEqual([fila.id, filaAntigua.id]);
  });

  it("traduce fallos de lectura a un error controlado de persistencia", async () => {
    const { repositorio } = crearRepositorio([
      { data: null, error: { message: "database unavailable" } },
      { data: [], error: null },
    ]);

    await expect(repositorio.buscarUltimosPorUsuario("user-id", "user@example.com", 5))
      .rejects.toBeInstanceOf(ErrorPersistencia);
  });
});
