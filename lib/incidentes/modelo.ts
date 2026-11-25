import type { Gravedad, Prioridad, TipoPeligroRegistrado } from "@/types/incidentes";

/** Resultado de aplicar la matriz de priorización. */
export type ClasificacionRiesgo = {
  prioridad_asignada: Prioridad;
  requiere_atencion_inmediata: boolean;
};

export type ClasificacionPendiente = {
  prioridad_asignada: null;
  requiere_atencion_inmediata: null;
};

export type ClasificacionPersistida = {
  prioridad_asignada: Prioridad | null;
  requiere_atencion_inmediata: boolean | null;
};

/** Datos de entrada ya validados por el servicio. */
export type NuevoIncidenteEntrada = {
  titulo: string;
  descripcion: string;
  tipo_peligro: TipoPeligroRegistrado;
  gravedad: Gravedad;
};

export type ActualizarClasificacionEntrada = {
  tipo_peligro: TipoPeligroRegistrado;
  gravedad: Gravedad;
};

/** Registro que el servicio entrega al repositorio: entrada + clasificación + trazabilidad. */
export type IncidentePersistible = NuevoIncidenteEntrada & ClasificacionPersistida & {
  estado: "Abierto";
  user_id: string | null;
  user_email: string | null;
};

/** Incidente tal como se devuelve al consumidor de la API (RF-01 y RF-02). */
export type IncidenteClasificado = NuevoIncidenteEntrada & ClasificacionPersistida & {
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
 * - buscarUltimosPorUsuario: devuelve los reportes recientes del usuario, incluidos los antiguos
 *   sin user_id cuyo correo de propietario coincide con su sesión autenticada.
 * Cualquier fallo técnico se lanza como ErrorPersistencia.
 */
export interface IncidentRepository {
  guardar(incidente: IncidentePersistible): Promise<IncidenteClasificado>;
  actualizarClasificacion(
    id: string,
    clasificacion: ActualizarClasificacionEntrada & ClasificacionPersistida
  ): Promise<IncidenteClasificado>;
  buscarPorId(id: string): Promise<IncidenteClasificado | null>;
  buscarUltimosPorUsuario(userId: string, email: string, limite: number): Promise<IncidenteClasificado[]>;
}
