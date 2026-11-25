import type { Incidente } from "@/types/incidentes";
import { filtrarIncidentes } from "@/utils/filtrosIncidentes";

const incidentes: Incidente[] = [
  { id: "1", titulo: "Quimico", descripcion: "", tipo_peligro: "Quimico", estado: "Abierto", prioridad_asignada: "Alta" },
  { id: "2", titulo: "Fisico", descripcion: "", tipo_peligro: "Fisico", estado: "Abierto", prioridad_asignada: "Media" },
  { id: "3", titulo: "Sin clasificar", descripcion: "", tipo_peligro: "Fisico", estado: "Cerrado" },
  { id: "4", titulo: "Baja", descripcion: "", tipo_peligro: "Biomecanico", estado: "En Proceso", prioridad_asignada: "Baja" },
];

describe("filtrarIncidentes", () => {
  it("filtra por prioridad asignada", () => {
    expect(filtrarIncidentes(incidentes, "TODOS", "Alta").map(({ id }) => id)).toEqual(["1"]);
  });

  it("permite encontrar registros sin clasificar", () => {
    expect(filtrarIncidentes(incidentes, "TODOS", "SIN_CLASIFICAR").map(({ id }) => id)).toEqual(["3"]);
  });

  it("combina filtros de estado y prioridad", () => {
    expect(filtrarIncidentes(incidentes, "Abierto", "Media").map(({ id }) => id)).toEqual(["2"]);
  });

  it("devuelve todos los incidentes sin filtros", () => {
    expect(filtrarIncidentes(incidentes, "TODOS", "TODOS").map(({ id }) => id)).toEqual([
      "1",
      "2",
      "4",
      "3",
    ]);
  });

  it("ordena prioridad alta antes de media, baja y sin clasificar", () => {
    const resultado = filtrarIncidentes(incidentes, "TODOS", "TODOS");

    expect(resultado.map(({ id }) => id)).toEqual(["1", "2", "4", "3"]);
    expect(incidentes.map(({ id }) => id)).toEqual(["1", "2", "3", "4"]);
  });

  it("prioriza atención inmediata entre incidentes con la misma prioridad", () => {
    const resultado = filtrarIncidentes(
      [
        { ...incidentes[0], id: "5", requiere_atencion_inmediata: null },
        { ...incidentes[0], id: "6", requiere_atencion_inmediata: true },
      ],
      "TODOS",
      "TODOS"
    );

    expect(resultado.map(({ id }) => id)).toEqual(["6", "5"]);
  });
});
