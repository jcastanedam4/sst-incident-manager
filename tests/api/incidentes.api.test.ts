import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorNoAutorizado, ErrorPersistencia } from "@/lib/incidentes/errores";
import { IncidentService } from "@/lib/incidentes/incidentService";
import type { IncidenteClasificado } from "@/lib/incidentes/modelo";

const ID = "00000000-0000-4000-8000-000000000001";
const guardado: IncidenteClasificado = {
  id: ID, titulo: "Derrame", descripcion: "x", tipo_peligro: "Quimico", gravedad: "Alta",
  prioridad_asignada: "Alta", requiere_atencion_inmediata: true, estado: "Abierto", fecha_registro: "2026-11-02T08:00:00.000Z",
};

const repo = { guardar: vi.fn(), buscarPorId: vi.fn() };

vi.mock("@/lib/incidentes/contexto", () => ({
  autenticar: vi.fn(),
  crearIncidentService: vi.fn(() => new IncidentService(repo)),
}));

import { autenticar } from "@/lib/incidentes/contexto";
import { POST } from "@/app/api/v1/incidentes/route";
import { GET } from "@/app/api/v1/incidentes/[id]/route";

const post = (cuerpo: unknown, crudo = false) =>
  POST(new Request("http://localhost/api/v1/incidentes", { method: "POST", body: crudo ? (cuerpo as string) : JSON.stringify(cuerpo) }));
const get = (id: string) =>
  GET(new Request(`http://localhost/api/v1/incidentes/${id}`), { params: Promise.resolve({ id }) });

const valido = { titulo: "Derrame", descripcion: "x", tipo_peligro: "Quimico", gravedad: "Alta" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(autenticar).mockResolvedValue({ usuario: { id: "u1", email: "e@empresa.com" }, cliente: {} as never });
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
});
