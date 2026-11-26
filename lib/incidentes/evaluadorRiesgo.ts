import type { Gravedad, TipoPeligro } from "@/types/incidentes";
import type { ClasificacionRiesgo } from "./modelo";


/**
MATRIZ DE PRIORIZACIÓN AUTOMÁTICA (única fuente de la regla; no replicar en frontend)
 *
Basada en la clasificación de peligros de la GTC 45. La gravedad actúa como la
consecuencia y el tipo de peligro ajusta la prioridad según su potencial de daño.
 *
| Peligro                      | Gravedad Baja | Gravedad Media | Gravedad Alta | Criterio                                   |
|------------------------------|---------------|----------------|---------------|--------------------------------------------|
| Biologico, Quimico           | Alta          | Alta           | Alta          | Efectos irreversibles, exposición oculta   |
| Seguridad, Fenomeno natural  | Media         | Alta           | Alta          | Daño inmediato o colectivo                 |
| Fisico                       | Media         | Media          | Alta          | Exposición continua, nunca queda en Baja   |
| Biomecanico, Psicosocial     | Baja          | Media          | Alta          | Efecto gradual, se prioriza por gravedad   |
 *
Atención inmediata: Sí cuando la prioridad es Alta.
Los ajustes por tipo de peligro son un supuesto a confirmar por el equipo SST.
 */
export const PELIGROS_CRITICOS: readonly TipoPeligro[] = ["Biologico", "Quimico"];


type Prioridad = ClasificacionRiesgo["prioridad_asignada"];


/** Peligros no críticos con gravedad Baja o Media (la gravedad Alta se resuelve antes). */
const MATRIZ_PELIGROS: Record<string, Record<"Baja" | "Media", Prioridad>> = {
  Seguridad: { Baja: "Media", Media: "Alta" },
  "Fenomeno natural": { Baja: "Media", Media: "Alta" },
  Fisico: { Baja: "Media", Media: "Media" },
  Biomecanico: { Baja: "Baja", Media: "Media" },
  Psicosocial: { Baja: "Baja", Media: "Media" },
};


export function evaluarRiesgo(tipoPeligro: TipoPeligro, gravedad: Gravedad): ClasificacionRiesgo {
  if (PELIGROS_CRITICOS.includes(tipoPeligro) || gravedad === "Alta") {
    return { prioridad_asignada: "Alta", requiere_atencion_inmediata: true };
  }


  const prioridad = MATRIZ_PELIGROS[tipoPeligro][gravedad];


  return { prioridad_asignada: prioridad, requiere_atencion_inmediata: prioridad === "Alta" };
}


/** Servicio de dominio: sin HTTP, sin base de datos. */
export class EvaluadorRiesgoService {
  evaluar(tipoPeligro: TipoPeligro, gravedad: Gravedad): ClasificacionRiesgo {
    return evaluarRiesgo(tipoPeligro, gravedad);
  }
}