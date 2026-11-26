import type { EstadoIncidente, Incidente, Prioridad } from "@/types/incidentes";

export type FiltroPrioridad = "TODOS" | "SIN_CLASIFICAR" | Prioridad;

const ORDEN_PRIORIDAD: Record<Prioridad, number> = {
  Alta: 0,
  Media: 1,
  Baja: 2,
};

export const filtrarIncidentes = (
  incidentes: Incidente[],
  estado: "TODOS" | EstadoIncidente,
  prioridad: FiltroPrioridad
): Incidente[] =>
  incidentes.filter((incidente) => {
    const coincideEstado = estado === "TODOS" || incidente.estado === estado;
    const coincidePrioridad =
      prioridad === "TODOS" ||
      (prioridad === "SIN_CLASIFICAR"
        ? !incidente.prioridad_asignada
        : incidente.prioridad_asignada === prioridad);

    return coincideEstado && coincidePrioridad;
  }).sort((a, b) => {
    const prioridadA = a.prioridad_asignada
      ? ORDEN_PRIORIDAD[a.prioridad_asignada]
      : Number.MAX_SAFE_INTEGER;
    const prioridadB = b.prioridad_asignada
      ? ORDEN_PRIORIDAD[b.prioridad_asignada]
      : Number.MAX_SAFE_INTEGER;

    if (prioridadA !== prioridadB) {
      return prioridadA - prioridadB;
    }

    return Number(Boolean(b.requiere_atencion_inmediata)) - Number(Boolean(a.requiere_atencion_inmediata));
  });
