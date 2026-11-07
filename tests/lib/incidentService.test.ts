import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorNoEncontrado, ErrorPersistencia, ErrorValidacion } from "@/lib/incidentes/errores";
import { IncidentService } from "@/lib/incidentes/incidentService";
import type { IncidentRepository, IncidenteClasificado, IncidentePersistible } from "@/lib/incidentes/modelo";

const usuario = { id: "11111111-1111-4111-8111-111111111111", email: "empleado@empresa.com" };
const ID = "00000000-0000-4000-8000-000000000001";

/** Repositorio simulado en memoria: sin conexión a base de datos (RNF-02). */
class RepositorioSimulado implements IncidentRepository {
  guardados: IncidentePersistible[] = [];
  almacen = new Map<string, IncidenteClasificado>();

  async guardar(i: IncidentePersistible): Promise<IncidenteClasificado> {
    this.guardados.push(i);
    const guardado: IncidenteClasificado = {
      id: ID, titulo: i.titulo, descripcion: i.descripcion, tipo_peligro: i.tipo_peligro, gravedad: i.gravedad,
      prioridad_asignada: i.prioridad_asignada, requiere_atencion_inmediata: i.requiere_atencion_inmediata,
      estado: i.estado, fecha_registro: "2026-11-02T08:00:00.000Z",
    };
    this.almacen.set(ID, guardado);
    return guardado;
  }

  async buscarPorId(id: string) {
    return this.almacen.get(id) ?? null;
  }
}

const entrada = { titulo: "Derrame", descripcion: "Sustancia en piso", tipo_peligro: "Quimico", gravedad: "Baja" };

describe("IncidentService — RF-01 registrar", () => {
  let repo: RepositorioSimulado;
  let servicio: IncidentService;

  beforeEach(() => {
    repo = new RepositorioSimulado();
    servicio = new IncidentService(repo);
  });

  it("clasifica Alta y persiste junto con la prioridad (peligro químico)", async () => {
    const r = await servicio.registrar(entrada, usuario);
    expect(r.prioridad_asignada).toBe("Alta");
    expect(r.requiere_atencion_inmediata).toBe(true);
    expect(repo.guardados[0]).toMatchObject({ prioridad_asignada: "Alta", user_id: usuario.id, user_email: usuario.email, estado: "Abierto" });
  });

  it("clasifica Media", async () => {
    const r = await servicio.registrar({ ...entrada, tipo_peligro: "Biomecanico", gravedad: "Media" }, usuario);
    expect(r).toMatchObject({ prioridad_asignada: "Media", requiere_atencion_inmediata: false });
  });

  it("clasifica Baja", async () => {
    const r = await servicio.registrar({ ...entrada, tipo_peligro: "Fisico", gravedad: "Baja" }, usuario);
    expect(r).toMatchObject({ prioridad_asignada: "Baja", requiere_atencion_inmediata: false });
  });

  it("ignora la prioridad enviada por el cliente (no hay bypass)", async () => {
    await servicio.registrar({ ...entrada, prioridad_asignada: "Baja", requiere_atencion_inmediata: false }, usuario);
    expect(repo.guardados[0].prioridad_asignada).toBe("Alta");
  });

  it("rechaza datos inválidos SIN llamar al repositorio", async () => {
    await expect(servicio.registrar({ ...entrada, gravedad: "Extrema" }, usuario)).rejects.toBeInstanceOf(ErrorValidacion);
    expect(repo.guardados).toHaveLength(0);
  });

  it("propaga ErrorPersistencia del repositorio", async () => {
    vi.spyOn(repo, "guardar").mockRejectedValue(new ErrorPersistencia("falló"));
    await expect(servicio.registrar(entrada, usuario)).rejects.toBeInstanceOf(ErrorPersistencia);
  });
});

describe("IncidentService — RF-02 consultar", () => {
  it("devuelve un incidente existente", async () => {
    const repo = new RepositorioSimulado();
    const servicio = new IncidentService(repo);
    await servicio.registrar(entrada, usuario);
    expect((await servicio.consultarPorId(ID)).id).toBe(ID);
  });

  it("lanza ErrorNoEncontrado si no existe", async () => {
    const servicio = new IncidentService(new RepositorioSimulado());
    await expect(servicio.consultarPorId("00000000-0000-4000-8000-0000000000ff")).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it("lanza ErrorValidacion con un id inválido y no consulta el repositorio", async () => {
    const repo = new RepositorioSimulado();
    const espia = vi.spyOn(repo, "buscarPorId");
    await expect(new IncidentService(repo).consultarPorId("abc")).rejects.toBeInstanceOf(ErrorValidacion);
    expect(espia).not.toHaveBeenCalled();
  });

  it("la consulta no modifica datos", async () => {
    const repo = new RepositorioSimulado();
    const servicio = new IncidentService(repo);
    await servicio.registrar(entrada, usuario);
    const espia = vi.spyOn(repo, "guardar");
    await servicio.consultarPorId(ID);
    expect(espia).not.toHaveBeenCalled();
  });
});
