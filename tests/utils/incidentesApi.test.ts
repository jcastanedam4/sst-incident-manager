import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearIncidente, consultarIncidente, listarMisIncidentes } from "@/utils/incidentesApi";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/utils/supabase", () => ({
  supabase: { auth: { getSession } },
}));

const incidente = {
  id: "00000000-0000-4000-8000-000000000001",
  titulo: "Derrame",
  descripcion: "Sustancia en el piso",
  tipo_peligro: "Quimico",
  gravedad: "Alta",
  prioridad_asignada: "Alta",
  requiere_atencion_inmediata: true,
  estado: "Abierto",
  fecha_registro: "2026-11-14T10:00:00.000Z",
};

describe("cliente API de incidentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve la clasificación de un registro válido", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: incidente }), { status: 201, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      crearIncidente({ titulo: "Derrame", descripcion: "Sustancia en el piso", tipo_peligro: "Quimico", gravedad: "Alta" })
    ).resolves.toEqual({ ok: true, data: incidente });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/incidentes/",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer test-token" });
  });

  it("presenta rechazo de validación con los errores por campo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          error: {
            codigo: "VALIDACION",
            mensaje: "Datos inválidos.",
            detalles: [{ campo: "titulo", mensaje: "El título es obligatorio." }],
          },
        }), { status: 400, headers: { "Content-Type": "application/json" } })
      )
    );

    await expect(crearIncidente({ titulo: "", descripcion: "", tipo_peligro: "Quimico", gravedad: "Alta" })).resolves.toMatchObject({
      ok: false,
      tipo: "validacion",
      detalles: [{ campo: "titulo", mensaje: "El título es obligatorio." }],
    });
  });

  it("traduce un incidente ausente a error de negocio 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { codigo: "NO_ENCONTRADO", mensaje: "No existe." } }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(consultarIncidente(incidente.id)).resolves.toMatchObject({
      ok: false,
      tipo: "negocio",
      status: 404,
      mensaje: "No existe.",
    });
  });

  it("solicita el historial reciente con el token de sesión", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [incidente] }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listarMisIncidentes()).resolves.toEqual({ ok: true, data: [incidente] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/incidentes/mis-reportes/",
      expect.objectContaining({ method: "GET", headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" } })
    );
  });

  it("advierte de desconexión sin reintentar el registro automáticamente", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await crearIncidente({
      titulo: "Derrame",
      descripcion: "Sustancia en el piso",
      tipo_peligro: "Quimico",
      gravedad: "Alta",
    });

    expect(resultado).toMatchObject({ ok: false, tipo: "comunicacion" });
    expect(resultado.ok ? "" : resultado.mensaje).toContain("Antes de reintentar");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("presenta un fallo al recuperar la sesión como error de comunicación", async () => {
    getSession.mockRejectedValueOnce(new Error("session unavailable"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      consultarIncidente(incidente.id)
    ).resolves.toMatchObject({ ok: false, tipo: "comunicacion" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
