import type { Gravedad, TipoPeligro } from "@/types/incidentes";
import type { ClasificacionRiesgo } from "./modelo";

/**
 * MATRIZ DE PRIORIZACIÓN AUTOMÁTICA (única fuente de la regla; no replicar en frontend)
 *
 * | Condición                                   | Prioridad | Atención inmediata |
 * |---------------------------------------------|-----------|--------------------|
 * | Peligro Biologico o Quimico (cualquier gravedad) | Alta | Sí                 |
 * | Gravedad Alta (cualquier peligro)           | Alta      | Sí                 |
 * | Gravedad Media (otros peligros)             | Media     | No                 |
 * | Gravedad Baja (otros peligros)              | Baja      | No                 |
 *
 * Los casos "Media" y "Baja" se derivan de la gravedad (supuesto a confirmar por el equipo).
 */
export const PELIGROS_CRITICOS: readonly TipoPeligro[] = ["Biologico", "Quimico"];

export function evaluarRiesgo(tipoPeligro: TipoPeligro, gravedad: Gravedad): ClasificacionRiesgo {
  if (PELIGROS_CRITICOS.includes(tipoPeligro) || gravedad === "Alta") {
    return { prioridad_asignada: "Alta", requiere_atencion_inmediata: true };
  }

  if (gravedad === "Media") {
    return { prioridad_asignada: "Media", requiere_atencion_inmediata: false };
  }

  return { prioridad_asignada: "Baja", requiere_atencion_inmediata: false };
}

/** Servicio de dominio: sin HTTP, sin base de datos. */
export class EvaluadorRiesgoService {
  evaluar(tipoPeligro: TipoPeligro, gravedad: Gravedad): ClasificacionRiesgo {
    return evaluarRiesgo(tipoPeligro, gravedad);
  }
}
