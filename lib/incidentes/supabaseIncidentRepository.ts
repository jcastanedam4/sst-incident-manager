import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gravedad, Prioridad } from "@/types/incidentes";
import { ErrorNoEncontrado, ErrorPersistencia } from "./errores";
import type {
  ActualizarClasificacionEntrada,
  ClasificacionPersistida,
  IncidentRepository,
  IncidentePersistible,
  IncidenteClasificado,
} from "./modelo";
import type { TipoPeligroRegistrado } from "@/types/incidentes";

const TABLA = "incidentes";
const COLUMNAS =
  "id, titulo, descripcion, tipo_peligro, gravedad, prioridad_asignada, requiere_atencion_inmediata, estado, created_at";

type FilaIncidente = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo_peligro: TipoPeligroRegistrado;
  gravedad: Gravedad;
  prioridad_asignada: Prioridad | null;
  requiere_atencion_inmediata: boolean | null;
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

  async actualizarClasificacion(
    id: string,
    clasificacion: ActualizarClasificacionEntrada & ClasificacionPersistida
  ): Promise<IncidenteClasificado> {
    const { data, error } = await this.cliente
      .from(TABLA)
      .update(clasificacion)
      .eq("id", id)
      .select(COLUMNAS)
      .maybeSingle();

    if (error) {
      throw new ErrorPersistencia("No fue posible actualizar la clasificación del incidente.", error);
    }

    if (!data) {
      throw new ErrorNoEncontrado();
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

  async buscarUltimosPorUsuario(userId: string, email: string, limite: number): Promise<IncidenteClasificado[]> {
    const [porUsuario, heredados] = await Promise.all([
      this.cliente
        .from(TABLA)
        .select(COLUMNAS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limite),
      this.cliente
        .from(TABLA)
        .select(COLUMNAS)
        .is("user_id", null)
        .eq("user_email", email)
        .order("created_at", { ascending: false })
        .limit(limite),
    ]);

    if (porUsuario.error || heredados.error) {
      throw new ErrorPersistencia(
        "No fue posible consultar el historial de incidentes.",
        porUsuario.error ?? heredados.error
      );
    }

    return [...(porUsuario.data ?? []), ...(heredados.data ?? [])]
      .map((fila) => mapearFila(fila as FilaIncidente))
      .sort((a, b) => Date.parse(b.fecha_registro) - Date.parse(a.fecha_registro))
      .slice(0, limite);
  }
}
