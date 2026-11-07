import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gravedad, Prioridad, TipoPeligro } from "@/types/incidentes";
import { ErrorPersistencia } from "./errores";
import type { IncidentRepository, IncidentePersistible, IncidenteClasificado } from "./modelo";

const TABLA = "incidentes";
const COLUMNAS =
  "id, titulo, descripcion, tipo_peligro, gravedad, prioridad_asignada, requiere_atencion_inmediata, estado, created_at";

type FilaIncidente = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo_peligro: TipoPeligro;
  gravedad: Gravedad;
  prioridad_asignada: Prioridad;
  requiere_atencion_inmediata: boolean;
  estado: string;
  created_at: string;
};

export const mapearFila = (fila: FilaIncidente): IncidenteClasificado => ({
  id: fila.id,
  titulo: fila.titulo,
  descripcion: fila.descripcion,
  tipo_peligro: fila.tipo_peligro,
  gravedad: fila.gravedad,
  prioridad_asignada: fila.prioridad_asignada,
  requiere_atencion_inmediata: fila.requiere_atencion_inmediata,
  estado: fila.estado,
  fecha_registro: fila.created_at,
});

/**
 * Único componente que habla con la tabla `incidentes`.
 * Recibe el cliente Supabase por constructor: en la API se usa un cliente
 * con el JWT del usuario (RLS activo); en pruebas de integración, otro cliente.
 * Cada operación es una sentencia atómica; no abre transacciones propias.
 */
export class SupabaseIncidentRepository implements IncidentRepository {
  constructor(private readonly cliente: SupabaseClient) {}

  async guardar(incidente: IncidentePersistible): Promise<IncidenteClasificado> {
    const { data, error } = await this.cliente.from(TABLA).insert(incidente).select(COLUMNAS).single();

    if (error || !data) {
      throw new ErrorPersistencia("No fue posible guardar el incidente.", error);
    }

    return mapearFila(data as FilaIncidente);
  }

  async buscarPorId(id: string): Promise<IncidenteClasificado | null> {
    const { data, error } = await this.cliente.from(TABLA).select(COLUMNAS).eq("id", id).maybeSingle();

    if (error) {
      throw new ErrorPersistencia("No fue posible consultar el incidente.", error);
    }

    return data ? mapearFila(data as FilaIncidente) : null;
  }
}
