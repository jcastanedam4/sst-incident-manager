import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorNoAutorizado, ErrorPersistencia, ErrorSinPermiso } from "@/lib/incidentes/errores";
import { IncidentService } from "@/lib/incidentes/incidentService";
import type { IncidenteClasificado } from "@/lib/incidentes/modelo";

const ID = "00000000-0000-4000-8000-000000000001";
const guardado: IncidenteClasificado = {
  id: ID, titulo: "Derrame", descripcion: "x", tipo_peligro: "Quimico", gravedad: "Alta",
  prioridad_asignada: "Alta", requiere_atencion_inmediata: true, estado: "Abierto", fecha_registro: "2026-11-02T08:00:00.000Z",
};

const repo = {
  guardar: vi.fn(),
  actualizarClasificacion: vi.fn(),
  buscarPorId: vi.fn(),
  buscarUltimosPorUsuario: vi.fn(),
};

vi.mock("@/lib/incidentes/contexto", () => ({
  autenticar: vi.fn(),
  autenticarAdministrador: vi.fn(),
  crearIncidentService: vi.fn(() => new IncidentService(repo)),
}));

import { autenticar } from "@/lib/incidentes/contexto";
import { autenticarAdministrador } from "@/lib/incidentes/contexto";
import { POST } from "@/app/api/v1/incidentes/route";
import { GET, PATCH } from "@/app/api/v1/incidentes/[id]/route";
import { GET as GETMisReportes } from "@/app/api/v1/incidentes/mis-reportes/route";

const post = (cuerpo: unknown, crudo = false) =>
  POST(new Request("http://localhost/api/v1/incidentes", { method: "POST", body: crudo ? (cuerpo as string) : JSON.stringify(cuerpo) }));
const get = (id: string) =>
  GET(new Request(`http://localhost/api/v1/incidentes/${id}`), { params: Promise.resolve({ id }) });
const patch = (id: string, cuerpo: unknown) =>
  PATCH(
    new Request(`http://localhost/api/v1/incidentes/${id}`, { method: "PATCH", body: JSON.stringify(cuerpo) }),
    { params: Promise.resolve({ id }) }
  );
const getMisReportes = (query = "") =>
  GETMisReportes(new Request(`http://localhost/api/v1/incidentes/mis-reportes${query}`));

const valido = { titulo: "Derrame", descripcion: "x", tipo_peligro: "Quimico", gravedad: "Alta" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(autenticar).mockResolvedValue({ usuario: { id: "u1", email: "e@empresa.com" }, cliente: {} as never });
  vi.mocked(autenticarAdministrador).mockResolvedValue({
    usuario: { id: "admin1", email: "encargado.sst@empresa.com" },
    cliente: {} as never,
    rol: "ADMIN",
  });
  repo.buscarUltimosPorUsuario.mockResolvedValue([]);
});

describe("POST /api/v1/incidentes (RF-01)", () => {
  it("201 con clasificación e id real", async () => {
    repo.guardar.mockResolvedValue(guardado);
    const r = await post(valido);
    expect(r.status).toBe(201);
    expect(r.headers.get("Location")).toBe(`/api/v1/incidentes/${ID}`);
    expect((await r.json()).data).toMatchObject({ id: ID, prioridad_asignada: "Alta", requiere_atencion_inmediata: true });
  });

  it("400 por datos inválidos y no persiste", async () => {
    const r = await post({ ...valido, gravedad: "Extrema" });
    expect(r.status).toBe(400);
    expect((await r.json()).error.codigo).toBe("VALIDACION");
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it("permite registrar Sin clasificar con prioridad y atención pendientes", async () => {
    repo.guardar.mockResolvedValue({
      ...guardado,
      tipo_peligro: "Sin clasificar",
      prioridad_asignada: null,
      requiere_atencion_inmediata: null,
    });

    const r = await post({ ...valido, tipo_peligro: "Sin clasificar" });

    expect(r.status).toBe(201);
    expect((await r.json()).data).toMatchObject({
      tipo_peligro: "Sin clasificar",
      prioridad_asignada: null,
      requiere_atencion_inmediata: null,
    });
    expect(repo.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo_peligro: "Sin clasificar",
        prioridad_asignada: null,
        requiere_atencion_inmediata: null,
      })
    );
  });

  it("400 por JSON malformado", async () => {
    expect((await post("{no-json", true)).status).toBe(400);
  });

  it("401 sin sesión", async () => {
    vi.mocked(autenticar).mockRejectedValue(new ErrorNoAutorizado());
    expect((await post(valido)).status).toBe(401);
  });

  it("500 controlado sin exponer detalles técnicos", async () => {
    repo.guardar.mockRejectedValue(new ErrorPersistencia("x", { message: "password authentication failed" }));
    const r = await post(valido);
    const texto = await r.text();
    expect(r.status).toBe(500);
    expect(texto).not.toContain("password");
    expect(JSON.parse(texto).error.codigo).toBe("ERROR_INTERNO");
  });
});

describe("GET /api/v1/incidentes/{id} (RF-02)", () => {
  it("200 si existe", async () => {
    repo.buscarPorId.mockResolvedValue(guardado);
    const r = await get(ID);
    expect(r.status).toBe(200);
    expect((await r.json()).data.id).toBe(ID);
  });

  describe("PATCH /api/v1/incidentes/{id}", () => {
    it("requiere admin y recalcula prioridad según tipo y gravedad", async () => {
      repo.actualizarClasificacion.mockResolvedValue({
        ...guardado,
        tipo_peligro: "Seguridad",
        gravedad: "Baja",
        prioridad_asignada: "Media",
        requiere_atencion_inmediata: false,
      });

      const r = await patch(ID, { tipo_peligro: "Seguridad", gravedad: "Baja" });

      expect(r.status).toBe(200);
      expect((await r.json()).data).toMatchObject({
        tipo_peligro: "Seguridad",
        gravedad: "Baja",
        prioridad_asignada: "Media",
        requiere_atencion_inmediata: false,
      });
      expect(repo.actualizarClasificacion).toHaveBeenCalledWith(ID, {
        tipo_peligro: "Seguridad",
        gravedad: "Baja",
        prioridad_asignada: "Media",
        requiere_atencion_inmediata: false,
      });
    });

    it("rechaza datos inválidos y usuarios sin permisos", async () => {
      expect((await patch(ID, { tipo_peligro: "Quimico", gravedad: "Crítica" })).status).toBe(400);
      expect(repo.actualizarClasificacion).not.toHaveBeenCalled();

      vi.mocked(autenticarAdministrador).mockRejectedValue(new ErrorSinPermiso());
      expect((await patch(ID, { tipo_peligro: "Quimico", gravedad: "Media" })).status).toBe(403);
      expect(repo.actualizarClasificacion).not.toHaveBeenCalled();
    });
  });

  it("404 si no existe", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    expect((await get("00000000-0000-4000-8000-0000000000ff")).status).toBe(404);
  });

  it("400 con identificador inválido", async () => {
    expect((await get("abc")).status).toBe(400);
    expect(repo.buscarPorId).not.toHaveBeenCalled();
  });

  it("no ejecuta escrituras", async () => {
    repo.buscarPorId.mockResolvedValue(guardado);
    await get(ID);
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it("401 sin sesión", async () => {
    vi.mocked(autenticar).mockRejectedValue(new ErrorNoAutorizado());
    expect((await get(ID)).status).toBe(401);
  });
});

describe("GET /api/v1/incidentes/mis-reportes", () => {
  it("devuelve el historial del usuario autenticado e ignora un user_id del cliente", async () => {
    repo.buscarUltimosPorUsuario.mockResolvedValue([guardado]);

    const r = await getMisReportes("?user_id=otro-usuario");

    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual([guardado]);
    expect(repo.buscarUltimosPorUsuario).toHaveBeenCalledWith("u1", "e@empresa.com", 5);
  });

  it("requiere sesión autenticada", async () => {
    vi.mocked(autenticar).mockRejectedValue(new ErrorNoAutorizado());

    expect((await getMisReportes()).status).toBe(401);
    expect(repo.buscarUltimosPorUsuario).not.toHaveBeenCalled();
  });
});
