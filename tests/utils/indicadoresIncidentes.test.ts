import type { Incidente } from "@/types/incidentes";
import { calcularIndicadoresIncidentes } from "@/utils/indicadoresIncidentes";

const incidentes: Incidente[] = [
  {
    id: "1",
    titulo: "Fuga",
    descripcion: "",
    tipo_peligro: "Quimico",
    estado: "Abierto",
    prioridad_asignada: "Alta",
    requiere_atencion_inmediata: true,
  },
  {
    id: "2",
    titulo: "Ruido",
    descripcion: "",
    tipo_peligro: "Fisico",
    estado: "En Proceso",
    prioridad_asignada: "Media",
  },
  {
    id: "3",
    titulo: "Carga",
    descripcion: "",
    tipo_peligro: "Biomecanico",
    estado: "Cerrado",
    prioridad_asignada: "Baja",
  },
  {
    id: "4",
    titulo: "Otro",
    descripcion: "",
    tipo_peligro: "Fisico",
    estado: "Cerrado",
  },
];

describe("calcularIndicadoresIncidentes", () => {
  it("resume estados, prioridades, urgencias y distribucion por peligro", () => {
    const indicadores = calcularIndicadoresIncidentes(incidentes);

    expect(indicadores).toMatchObject({
      total: 4,
      abiertos: 1,
      enProceso: 1,
      cerrados: 2,
      atencionInmediata: 1,
      porcentajeAtencionInmediata: 25,
    });
    expect(indicadores.porPrioridad).toEqual([
      { nombre: "Alta", cantidad: 1, porcentaje: 25 },
      { nombre: "Media", cantidad: 1, porcentaje: 25 },
      { nombre: "Baja", cantidad: 1, porcentaje: 25 },
      { nombre: "Sin clasificar", cantidad: 1, porcentaje: 25 },
    ]);
    expect(indicadores.porTipo).toEqual([
      { tipo: "Fisico", cantidad: 2, porcentaje: 50 },
      { tipo: "Quimico", cantidad: 1, porcentaje: 25 },
      { tipo: "Biomecanico", cantidad: 1, porcentaje: 25 },
    ]);
  });

  it("devuelve indicadores en cero cuando no hay incidentes", () => {
    const indicadores = calcularIndicadoresIncidentes([]);

    expect(indicadores.total).toBe(0);
    expect(indicadores.porcentajeAtencionInmediata).toBe(0);
    expect(indicadores.porPrioridad.every(({ porcentaje }) => porcentaje === 0)).toBe(true);
    expect(indicadores.porTipo).toEqual([]);
  });
});
