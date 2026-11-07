import type { Gravedad, Prioridad, TipoPeligro } from "@/types/incidentes";

/** Resultado de aplicar la matriz de priorización. */
export type ClasificacionRiesgo = {
  prioridad_asignada: Prioridad;
  requiere_atencion_inmediata: boolean;
};

/** Datos de entrada ya validados por el servicio. */
export type NuevoIncidenteEntrada = {
  titulo: string;
  descripcion: string;
  tipo_peligro: TipoPeligro;
  gravedad: Gravedad;
};

/** Registro que el servicio entrega al repositorio: entrada + clasificación + trazabilidad. */
export type IncidentePersistible = NuevoIncidenteEntrada &
  ClasificacionRiesgo & {
    estado: "Abierto";
    user_id: string | null;
    user_email: string | null;
  };

/** Incidente tal como se devuelve al consumidor de la API (RF-01 y RF-02). */
export type IncidenteClasificado = NuevoIncidenteEntrada &
  ClasificacionRiesgo & {
    id: string;
    estado: string;
    fecha_registro: string;
  };

export type UsuarioAutenticado = {
  id: string;
  email: string;
};

/**
 * Contrato de persistencia (semana 13). El servicio depende de esta interfaz,
 * no de Supabase, por lo que puede probarse con un repositorio simulado.
 *
 * - guardar: persiste y devuelve el registro con su id real.
 * - buscarPorId: devuelve null cuando el incidente no existe.
 * Cualquier fallo técnico se lanza como ErrorPersistencia.
 */
export interface IncidentRepository {
  guardar(incidente: IncidentePersistible): Promise<IncidenteClasificado>;
  buscarPorId(id: string): Promise<IncidenteClasificado | null>;
}
